/**
 * AllocationAggregator — single source of truth for cross-project FTE
 * aggregations.
 *
 * Before this service the rule "Σ FTE ≤ 1.0 per (resource, week)" lived
 * distributed in three endpoints (registry, warnings, write enforcement)
 * each doing its own SUM. Drift was just a matter of time. This module
 * centralises every read of that aggregate; the write-side cap check
 * (Step D) builds on top of `canAllocate`.
 *
 * Storage is unchanged: AllocationEntry remains the only source of
 * truth. No materialised table, no sync code, no drift risk. If volume
 * ever justifies a materialised aggregate, the public API of this module
 * stays identical and only the implementations of the read methods are
 * swapped.
 */

import { query as defaultQuery } from '../db';

type QueryFn = typeof defaultQuery;

export interface AllocationDecision {
  ok: boolean;
  current_total: number;     // Σ fte on (resource, week) excluding requesting project
  requested: number;         // fte the caller wants to commit
  would_be: number;          // current_total + requested
  excess?: number;           // would_be - 1.0, when ok === false
  breakdown?: {              // for diagnostics; populated when ok === false
    project_id: number;
    project_name: string;
    fte: number;
  }[];
}

export interface RegistryAllocation {
  project_id: number;
  project_name: string;
  project_status: string;
  week_start: string;
  fte: number;
}

export interface RegistryResourceRow {
  resource: {
    id: number;
    name: string;
    role: string;
    day_rate: number;
  };
  allocations: RegistryAllocation[];
  totals: Record<string, number>; // week_start → total fte
}

export interface RegistryAggregate {
  weeks: string[];
  rows: RegistryResourceRow[];
  has_overallocation: boolean;
}

/**
 * Σ fte on (resource_id, week_start) across all projects.
 * When `excludeProjectId` is provided, that project's contribution is
 * subtracted — used by the write-side cap check to compute "what else is
 * already committed" before adding the requested fte.
 */
export async function getWeeklyTotal(
  resource_id: number,
  week_start: string,
  opts: { excludeProjectId?: number; query?: QueryFn } = {}
): Promise<number> {
  const q = opts.query ?? defaultQuery;
  const params: any[] = [resource_id, week_start];
  let sql = `
    SELECT COALESCE(SUM(fte), 0)::numeric AS total
    FROM "AllocationEntry"
    WHERE resource_id = $1 AND week_start = $2
  `;
  if (opts.excludeProjectId !== undefined) {
    params.push(opts.excludeProjectId);
    sql += ` AND project_id != $3`;
  }
  const res = await q(sql, params);
  return parseFloat(res.rows[0].total);
}

/**
 * Decide whether `requested_fte` may be committed on (resource, week).
 * Returns an AllocationDecision; the caller is responsible for choosing
 * the response status (Step D uses 409 on `ok === false`).
 */
export async function canAllocate(
  resource_id: number,
  week_start: string,
  requested_fte: number,
  opts: { excludeProjectId?: number; query?: QueryFn } = {}
): Promise<AllocationDecision> {
  const q = opts.query ?? defaultQuery;
  const current = await getWeeklyTotal(resource_id, week_start, {
    excludeProjectId: opts.excludeProjectId,
    query: q,
  });
  const wouldBe = current + requested_fte;
  if (wouldBe <= 1.0) {
    return {
      ok: true,
      current_total: current,
      requested: requested_fte,
      would_be: wouldBe,
    };
  }
  // Over-cap: pull breakdown for the diagnostic payload
  const params: any[] = [resource_id, week_start];
  let sql = `
    SELECT ae.project_id, p.name AS project_name, ae.fte::numeric AS fte
    FROM "AllocationEntry" ae
    JOIN "Project" p ON p.id = ae.project_id
    WHERE ae.resource_id = $1 AND ae.week_start = $2
  `;
  if (opts.excludeProjectId !== undefined) {
    params.push(opts.excludeProjectId);
    sql += ` AND ae.project_id != $3`;
  }
  const rows = (await q(sql, params)).rows;
  return {
    ok: false,
    current_total: current,
    requested: requested_fte,
    would_be: wouldBe,
    excess: parseFloat((wouldBe - 1.0).toFixed(4)),
    breakdown: rows.map((r: any) => ({
      project_id: r.project_id,
      project_name: r.project_name,
      fte: parseFloat(r.fte),
    })),
  };
}

/**
 * Build the full cross-project registry aggregate used by
 * GET /api/resources/registry. Closed/archived projects can be filtered
 * upstream by the caller — this function returns everything.
 */
export async function getRegistryAggregate(
  opts: { query?: QueryFn } = {}
): Promise<RegistryAggregate> {
  const q = opts.query ?? defaultQuery;
  const allocRes = await q(
    `SELECT r.id AS resource_id, r.name AS resource_name, r.role,
            r.day_rate::numeric AS day_rate,
            p.id AS project_id, p.name AS project_name, p.status AS project_status,
            to_char(ae.week_start, 'YYYY-MM-DD') AS week_start,
            ae.fte::numeric AS fte
       FROM "AllocationEntry" ae
       JOIN "Resource" r ON r.id = ae.resource_id
       JOIN "Project" p ON p.id = ae.project_id
       ORDER BY r.name, p.name, ae.week_start`,
    []
  );

  const resourceMap = new Map<number, RegistryResourceRow>();
  const weekSet = new Set<string>();

  for (const row of allocRes.rows) {
    weekSet.add(row.week_start);
    if (!resourceMap.has(row.resource_id)) {
      resourceMap.set(row.resource_id, {
        resource: {
          id: row.resource_id,
          name: row.resource_name,
          role: row.role,
          day_rate: parseFloat(row.day_rate),
        },
        allocations: [],
        totals: {},
      });
    }
    const entry = resourceMap.get(row.resource_id)!;
    const fte = parseFloat(row.fte);
    entry.allocations.push({
      project_id: row.project_id,
      project_name: row.project_name,
      project_status: row.project_status,
      week_start: row.week_start,
      fte,
    });
    entry.totals[row.week_start] = parseFloat(
      ((entry.totals[row.week_start] ?? 0) + fte).toFixed(4)
    );
  }

  const rows = Array.from(resourceMap.values());
  const has_overallocation = rows.some((r) =>
    Object.values(r.totals).some((t) => t > 1.0)
  );

  return {
    weeks: Array.from(weekSet).sort(),
    rows,
    has_overallocation,
  };
}
