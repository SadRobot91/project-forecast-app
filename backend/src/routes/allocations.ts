import { Router } from 'express';
import { query, withTransaction } from '../db';
import type { QueryFn } from '../db';
import { calculateNetworkDays } from '../services/computations';
import { canAllocate, getWeeklyTotal, getWeeklyTotalsBatch } from '../services/allocationAggregator';

interface FteCapError extends Error {
  code: 'FTE_CAP';
  resource_id: number;
  week_start: string;
  excess: number;
  breakdown: { project_id: number; project_name: string; fte: number }[];
}

function makeFteCapError(
  resource_id: number,
  week_start: string,
  excess: number,
  breakdown: { project_id: number; project_name: string; fte: number }[]
): FteCapError {
  const err = new Error('FTE cap exceeded') as FteCapError;
  err.code = 'FTE_CAP';
  err.resource_id = resource_id;
  err.week_start = week_start;
  err.excess = excess;
  err.breakdown = breakdown;
  return err;
}

function isFteCapError(err: unknown): err is FteCapError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as FteCapError).code === 'FTE_CAP'
  );
}

const router = Router({ mergeParams: true });

/** Compute working days within a phase that fall in the given ISO week (Mon–Sun). */
function phaseWeekWorkingDays(
  phase: { planned_start: Date | string | null; planned_end: Date | string | null },
  weekStart: string
): number {
  if (!phase.planned_start || !phase.planned_end) return 0;

  const weekStartDate = new Date(weekStart);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 4); // Friday of that week

  const phaseStart = new Date(phase.planned_start);
  const phaseEnd = new Date(phase.planned_end);

  const start = phaseStart > weekStartDate ? phaseStart : weekStartDate;
  const end = phaseEnd < weekEndDate ? phaseEnd : weekEndDate;

  if (start > end) return 0;
  return calculateNetworkDays(start, end, []);
}

// GET /api/projects/:id/allocation
router.get('/', async (req, res) => {
  const projectId = (req.params as { id: string }).id;
  try {
    const projRes = await query('SELECT name FROM "Project" WHERE id = $1', [projectId]);
    if (!projRes.rowCount) return res.status(404).json({ error: 'Project not found' });
    const projectName = projRes.rows[0].name;

    const phasesRes = await query(
      `SELECT id as phase_id, phase_type, display_name, "order", planned_start, planned_end, status, working_days
       FROM "ProjectPhase" WHERE project_id = $1 ORDER BY "order"`,
      [projectId]
    );

    const allocRes = await query(
      `SELECT ae.phase_id, ae.resource_id,
              to_char(ae.week_start, 'YYYY-MM-DD') as week_start,
              ae.fte::numeric as fte,
              ae.working_days, ae.weekly_cost::numeric as weekly_cost,
              r.name, r.role, r.day_rate::numeric as day_rate
       FROM "AllocationEntry" ae
       JOIN "Resource" r ON r.id = ae.resource_id
       WHERE ae.project_id = $1
       ORDER BY ae.phase_id, r.name, ae.week_start`,
      [projectId]
    );

    const resourcesRes = await query('SELECT * FROM "Resource" ORDER BY name');

    function isoDate(d: Date | null): string {
      if (!d) return '';
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    const phases = phasesRes.rows.map((ph: any) => {
      const phAllocs = allocRes.rows.filter((a: any) => a.phase_id === ph.phase_id);

      const resourceMap = new Map<number, any>();
      phAllocs.forEach((a: any) => {
        if (!resourceMap.has(a.resource_id)) {
          resourceMap.set(a.resource_id, {
            id: a.resource_id,
            name: a.name,
            role: a.role,
            day_rate: parseFloat(a.day_rate),
          });
        }
      });

      const cells = phAllocs.map((a: any) => ({
        resource_id: a.resource_id,
        phase_id: a.phase_id,
        week_start: a.week_start,
        fte: parseFloat(a.fte),
        working_days: a.working_days,
        weekly_cost: parseFloat(a.weekly_cost),
      }));

      const phaseBudget = cells.reduce((s: number, c: any) => s + c.weekly_cost, 0);
      const ftesWithValue = cells.map((c: any) => c.fte).filter((f: number) => f > 0);
      const avgFte =
        ftesWithValue.length > 0
          ? ftesWithValue.reduce((s: number, f: number) => s + f, 0) / ftesWithValue.length
          : 0;

      return {
        phase_id: ph.phase_id,
        phase_type:   ph.phase_type,
        display_name: ph.display_name,
        planned_start: isoDate(ph.planned_start),
        planned_end: isoDate(ph.planned_end),
        resources: Array.from(resourceMap.values()),
        cells,
        phase_budget: phaseBudget,
        avg_fte: avgFte,
        burn_rate_per_day: ph.working_days > 0 ? Math.round(phaseBudget / ph.working_days) : 0,
      };
    });

    res.json({
      project_id: parseInt(projectId, 10),
      project_name: projectName,
      phases,
      all_resources: resourcesRes.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        role: r.role,
        day_rate: parseFloat(r.day_rate),
      })),
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// PUT /api/projects/:id/allocation
router.put('/', async (req, res) => {
  const projectId = (req.params as { id: string }).id;
  const { phase_id, allocations } = (req.body ?? {}) as { phase_id?: unknown; allocations?: unknown };

  // ── Validazione input ──────────────────────────────────────────────────
  if (!Number.isInteger(phase_id)) {
    return res.status(400).json({ error: 'phase_id is required and must be an integer' });
  }
  if (!Array.isArray(allocations)) {
    return res.status(400).json({ error: 'allocations is required and must be an array' });
  }
  for (const alloc of allocations) {
    if (typeof alloc !== 'object' || alloc === null) {
      return res.status(400).json({ error: 'each allocation must be an object' });
    }
    const { resource_id, week_start, fte } = alloc as Record<string, unknown>;
    if (!Number.isInteger(resource_id)) {
      return res.status(400).json({ error: 'each allocation must have an integer resource_id' });
    }
    if (typeof week_start !== 'string' || !ISO_DATE_RE.test(week_start) || isNaN(new Date(week_start).getTime())) {
      return res.status(400).json({ error: 'each allocation must have a valid week_start (YYYY-MM-DD)' });
    }
    if (typeof fte !== 'number' || isNaN(fte) || fte < 0 || fte > 1) {
      return res.status(400).json({ error: 'each allocation must have a numeric fte between 0 and 1' });
    }
  }

  try {
    // Ownership: la fase deve appartenere al progetto :id, altrimenti si
    // scriverebbero AllocationEntry cross-progetto (corruzione dei budget).
    const phaseCheck = await query(
      'SELECT planned_start, planned_end FROM "ProjectPhase" WHERE id = $1 AND project_id = $2',
      [phase_id, projectId]
    );
    if (!phaseCheck.rowCount) {
      return res.status(404).json({ error: 'Phase not found' });
    }
    const phase = phaseCheck.rows[0];

    // Step B: after lock, AllocationEntry is the working copy and remains
    // mutable. The locked baseline is preserved as a snapshot on the
    // Baseline row (total_budget_at_lock + phase_snapshot_at_lock), so
    // updates here do not retroactively alter the BAC.
    const inserted = await withTransaction(async (q: QueryFn) => {
      // 1. Acquire advisory locks in deterministic order to prevent deadlocks.
      type LockPair = { resource_id: number; week_start: string; week_epoch: number };
      const seen = new Set<string>();
      const lockPairs: LockPair[] = [];
      for (const alloc of allocations) {
        const key = `${alloc.resource_id}:${alloc.week_start}`;
        if (!seen.has(key)) {
          seen.add(key);
          const week_epoch = Math.floor(new Date(alloc.week_start).getTime() / 86400000);
          lockPairs.push({ resource_id: Number(alloc.resource_id), week_start: alloc.week_start, week_epoch });
        }
      }
      lockPairs.sort((a, b) =>
        a.resource_id !== b.resource_id ? a.resource_id - b.resource_id : a.week_epoch - b.week_epoch
      );
      for (const pair of lockPairs) {
        await q('SELECT pg_advisory_xact_lock($1, $2)', [pair.resource_id, pair.week_epoch]);
      }

      // 2. Delete existing allocations for this phase.
      await q('DELETE FROM "AllocationEntry" WHERE project_id = $1 AND phase_id = $2', [projectId, phase_id]);

      // 3. Aggregate requested FTE per (resource_id, week_start).
      const fteMap = new Map<string, number>();
      for (const alloc of allocations) {
        const key = `${alloc.resource_id}:${alloc.week_start}`;
        fteMap.set(key, (fteMap.get(key) ?? 0) + alloc.fte);
      }

      // 4. Check FTE cap: una sola query batch per tutte le coppie
      //    (resource, week); canAllocate resta usato solo nel ramo di
      //    errore per costruire il breakdown diagnostico.
      const existingTotals = await getWeeklyTotalsBatch(
        lockPairs.map((p) => ({ resource_id: p.resource_id, week_start: p.week_start })),
        { query: q }
      );
      for (const [key, totalFte] of fteMap) {
        const [rid, ws] = key.split(':');
        const resource_id = Number(rid);
        const wouldBe = (existingTotals.get(key) ?? 0) + totalFte;
        if (wouldBe > 1.0) {
          const decision = await canAllocate(resource_id, ws, totalFte, { query: q });
          throw makeFteCapError(
            resource_id,
            ws,
            decision.excess ?? parseFloat((wouldBe - 1.0).toFixed(4)),
            decision.breakdown ?? []
          );
        }
      }

      // 5. Day rate di tutte le risorse coinvolte in una query.
      const resourceIds = Array.from(new Set(allocations.map((a: any) => a.resource_id)));
      const ratesRes = await q(
        'SELECT id, day_rate FROM "Resource" WHERE id = ANY($1::int[])',
        [resourceIds]
      );
      const rateMap = new Map<number, number>(
        ratesRes.rows.map((r: any) => [r.id as number, parseFloat(r.day_rate)])
      );
      for (const rid of resourceIds) {
        if (!rateMap.has(rid)) throw new Error(`Resource ${rid} not found`);
      }

      // 6. INSERT multi-riga in una query (prima: un INSERT per cella).
      if (allocations.length === 0) return [];
      const values: any[] = [];
      const tuples: string[] = [];
      let i = 1;
      for (const alloc of allocations) {
        const { resource_id, week_start, fte } = alloc;
        const workingDays = phaseWeekWorkingDays(phase, week_start);
        const weeklyCost = rateMap.get(resource_id)! * fte * workingDays;
        tuples.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
        values.push(resource_id, projectId, phase_id, week_start, fte, workingDays, weeklyCost);
      }
      const result = await q(
        `INSERT INTO "AllocationEntry"
         (resource_id, project_id, phase_id, week_start, fte, working_days, weekly_cost)
         VALUES ${tuples.join(', ')} RETURNING *`,
        values
      );
      return result.rows;
    });

    res.json(inserted);
  } catch (err: unknown) {
    console.error(err);
    if (isFteCapError(err)) {
      return res.status(409).json({
        error: 'FTE cap exceeded',
        resource_id: err.resource_id,
        week_start: err.week_start,
        excess: err.excess,
        breakdown: err.breakdown,
      });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/allocation/warnings
// Step C: delegated to AllocationAggregator. The rule Σ FTE ≤ 1.0 lives
// in canAllocate; this endpoint exposes the same logic in informational
// form (warnings before an actual write).
router.get('/warnings', async (req, res) => {
  const projectId = (req.params as { id: string }).id;
  const { week_start, resource_id } = req.query;

  if (!week_start || !resource_id) {
    return res.status(400).json({ error: 'Missing week_start or resource_id query parameters' });
  }

  try {
    // Total of OTHER projects on this (resource, week) — this is the
    // headroom the current project can request without overflowing
    const otherProjectsTotal = await getWeeklyTotal(
      Number(resource_id),
      String(week_start),
      { excludeProjectId: Number(projectId) }
    );
    const selfTotal = await getWeeklyTotal(
      Number(resource_id),
      String(week_start)
    ) - otherProjectsTotal;
    const total = otherProjectsTotal + selfTotal;
    const isValid = total <= 1.0;

    res.json({
      isValid,
      warnings: isValid ? [] : [
        {
          projectId: Number(projectId),
          week_start: String(week_start),
          excess: parseFloat((total - 1.0).toFixed(4)),
        },
      ],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
