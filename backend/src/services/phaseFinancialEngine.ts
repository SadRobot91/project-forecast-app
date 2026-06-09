import { query as defaultQuery, QueryFn } from '../db';
import {
  calculateRevisedForecast,
  calculateRAGStatus,
  RAGStatus,
} from './computations';

export interface PhaseFinancial {
  phase_id: number;
  phase_type: string;
  display_name: string;
  status: 'not_started' | 'in_progress' | 'completed';
  budget: number;
  cost_spent: number;
  hours_spent: number;
  working_days_used: number;
  working_days_total: number;
  pct_complete: number;
  revised_forecast: number;
  variance: number;
  rag_status: RAGStatus;
  forecast_basis: 'completed' | 'in_progress' | 'not_started';
}

export interface ProjectFinancialRollup {
  phases: PhaseFinancial[];
  total_budget: number;
  total_cost_spent: number;
  total_hours_spent: number;
  total_working_days_used: number;
  total_revised_forecast: number;
  total_variance: number;
  rag_status: RAGStatus;
}

export async function computeProjectFinancials(
  projectId: number,
  opts?: { query?: QueryFn }
): Promise<ProjectFinancialRollup> {
  const q = opts?.query ?? defaultQuery;

  const phasesRes = await q(
    `SELECT id, phase_type, display_name, status,
            planned_start, planned_end, working_days, planned_hours, contingency_pct
     FROM "ProjectPhase"
     WHERE project_id = $1
     ORDER BY "order"`,
    [projectId]
  );

  const phaseIds: number[] = phasesRes.rows.map((r: any) => r.id);

  // Budget per tutte le fasi in una query
  const budgetBatchRes = await q(
    `SELECT ae.phase_id, COALESCE(SUM(ae.weekly_cost), 0)::numeric AS budget
     FROM "AllocationEntry" ae
     WHERE ae.phase_id = ANY($1::int[])
     GROUP BY ae.phase_id`,
    [phaseIds]
  );
  const budgetMap = new Map<number, number>(
    budgetBatchRes.rows.map((r: any) => [r.phase_id as number, parseFloat(r.budget)])
  );

  // Snapshot più recente per ciascuna fase in una query
  const snapshotBatchRes = await q(
    `SELECT DISTINCT ON (phase_id)
            phase_id, hours_spent_to_date, cost_spent_to_date, working_days_used
     FROM "OngoingSnapshot"
     WHERE project_id = $1 AND phase_id IS NOT NULL
     ORDER BY phase_id, reporting_date DESC, created_at DESC`,
    [projectId]
  );
  const snapshotMap = new Map<number, any>(
    snapshotBatchRes.rows.map((r: any) => [r.phase_id as number, r])
  );

  // Fallback for projects that predate phase_id enforcement (snapshots with phase_id NULL).
  // Only queried when there are no per-phase snapshots at all.
  let legacySnapshot: any = null;
  if (snapshotMap.size === 0 && phaseIds.length > 0) {
    const legacyRes = await q(
      `SELECT cost_spent_to_date, hours_spent_to_date, working_days_used
       FROM "OngoingSnapshot"
       WHERE project_id = $1 AND phase_id IS NULL
       ORDER BY reporting_date DESC, created_at DESC
       LIMIT 1`,
      [projectId]
    );
    if (legacyRes.rows.length > 0) {
      legacySnapshot = legacyRes.rows[0];
    }
  }

  const phases: PhaseFinancial[] = [];

  for (const row of phasesRes.rows) {
    const phaseId: number = row.id;

    const budget = budgetMap.get(phaseId) ?? 0;
    const snap   = snapshotMap.get(phaseId) ?? null;
    const cost_spent = snap ? parseFloat(snap.cost_spent_to_date) : 0;
    const hours_spent = snap ? parseFloat(snap.hours_spent_to_date) : 0;
    const working_days_used = snap ? (snap.working_days_used ?? 0) : 0;

    const working_days_total: number = row.working_days ?? 0;
    const pct_complete =
      working_days_total > 0 ? working_days_used / working_days_total : 0;

    const phaseStatus: 'not_started' | 'in_progress' | 'completed' = row.status;

    let revised_forecast: number;
    let forecast_basis: 'completed' | 'in_progress' | 'not_started';

    if (phaseStatus === 'completed') {
      revised_forecast = cost_spent;
      forecast_basis = 'completed';
    } else if (phaseStatus === 'in_progress') {
      const daysRemaining = Math.max(0, working_days_total - working_days_used);
      const dailyBurnRate = working_days_total > 0 ? budget / working_days_total : 0;
      const avgCostPerHour = hours_spent > 0 ? cost_spent / hours_spent : 0;
      const plannedHours: number = row.planned_hours ?? working_days_total * 8;
      const hoursRemaining = Math.max(0, plannedHours - hours_spent);

      revised_forecast = calculateRevisedForecast(
        hours_spent,
        cost_spent,
        dailyBurnRate,
        daysRemaining,
        avgCostPerHour,
        hoursRemaining
      );
      forecast_basis = 'in_progress';
    } else {
      revised_forecast = budget;
      forecast_basis = 'not_started';
    }

    const rag_status =
      budget === 0 && revised_forecast === 0
        ? RAGStatus.IN_LINEA
        : calculateRAGStatus(revised_forecast, budget);

    const variance = revised_forecast - budget;

    phases.push({
      phase_id: phaseId,
      phase_type: row.phase_type,
      display_name: row.display_name ?? row.phase_type,
      status: phaseStatus,
      budget,
      cost_spent,
      hours_spent,
      working_days_used,
      working_days_total,
      pct_complete,
      revised_forecast,
      variance,
      rag_status,
      forecast_basis,
    });
  }

  const total_budget = phases.reduce((s, p) => s + p.budget, 0);
  let total_cost_spent = phases.reduce((s, p) => s + p.cost_spent, 0);
  let total_hours_spent = phases.reduce((s, p) => s + p.hours_spent, 0);
  let total_working_days_used = phases.reduce((s, p) => s + p.working_days_used, 0);
  // When no per-phase actuals exist, surface the legacy project-level snapshot totals.
  if (legacySnapshot !== null) {
    if (total_cost_spent === 0) total_cost_spent = parseFloat(legacySnapshot.cost_spent_to_date) || 0;
    if (total_hours_spent === 0) total_hours_spent = parseFloat(legacySnapshot.hours_spent_to_date) || 0;
    if (total_working_days_used === 0) total_working_days_used = legacySnapshot.working_days_used || 0;
  }
  const total_revised_forecast = phases.reduce((s, p) => s + p.revised_forecast, 0);
  const total_variance = total_revised_forecast - total_budget;
  const rollup_rag =
    total_budget === 0 && total_revised_forecast === 0
      ? RAGStatus.IN_LINEA
      : calculateRAGStatus(total_revised_forecast, total_budget);

  return {
    phases,
    total_budget,
    total_cost_spent,
    total_hours_spent,
    total_working_days_used,
    total_revised_forecast,
    total_variance,
    rag_status: rollup_rag,
  };
}
