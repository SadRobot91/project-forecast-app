import { computeProjectFinancials } from './phaseFinancialEngine';
import { RAGStatus } from './computations';

function makeStubQuery(queued: Array<{ rows: any[] }>) {
  const calls: Array<{ sql: string; params: any[] }> = [];
  let i = 0;
  const fn: any = (sql: string, params: any[]) => {
    calls.push({ sql, params });
    if (i >= queued.length) {
      throw new Error(`Unexpected query #${i + 1}: ${sql}`);
    }
    return Promise.resolve(queued[i++]);
  };
  fn.calls = calls;
  return fn;
}

describe('computeProjectFinancials', () => {
  it('completed phase: revised_forecast equals cost_spent, RAG computed from cost_spent vs budget', async () => {
    const q = makeStubQuery([
      // phases query
      { rows: [{ id: 10, phase_type: 'feasibility', display_name: 'Feasibility', status: 'completed', working_days: 12, planned_hours: 96, contingency_pct: 0 }] },
      // budget batch for [10]
      { rows: [{ phase_id: 10, budget: '4080' }] },
      // snapshot batch for project (phase_id 10)
      { rows: [{ phase_id: 10, cost_spent_to_date: '4200', hours_spent_to_date: '80', working_days_used: 12 }] },
    ]);

    const rollup = await computeProjectFinancials(1, { query: q });

    expect(rollup.phases).toHaveLength(1);
    const p = rollup.phases[0];
    expect(p.forecast_basis).toBe('completed');
    expect(p.revised_forecast).toBe(4200);
    expect(p.cost_spent).toBe(4200);
    expect(p.budget).toBe(4080);
    expect(p.variance).toBeCloseTo(120, 5);
    // 4200 / 4080 = 1.0294 <= 1.05 → IN_LINEA
    expect(p.rag_status).toBe(RAGStatus.IN_LINEA);
  });

  it('in_progress phase with actuals: forecast > budget when burn rate is high', async () => {
    const q = makeStubQuery([
      // phases
      { rows: [{ id: 20, phase_type: 'build', display_name: 'Build', status: 'in_progress', working_days: 80, planned_hours: 640, contingency_pct: 0 }] },
      // budget batch for [20]
      { rows: [{ phase_id: 20, budget: '41600' }] },
      // snapshot batch for project (phase_id 20): 58 days used, cost = 36200, hours = 320
      { rows: [{ phase_id: 20, cost_spent_to_date: '36200', hours_spent_to_date: '320', working_days_used: 58 }] },
    ]);

    const rollup = await computeProjectFinancials(1, { query: q });

    const p = rollup.phases[0];
    expect(p.forecast_basis).toBe('in_progress');
    expect(p.working_days_used).toBe(58);
    expect(p.working_days_total).toBe(80);
    // dailyBurnRate = 41600/80 = 520, daysRemaining = 22
    // timeBasedForecast = 36200 + 520*22 = 47640
    // avgCostPerHour = 36200/320 = 113.125
    // hoursRemaining = max(0, 640-320) = 320
    // costBasedForecast = 36200 + 113.125*320 = 72400
    // revised = (47640 + 72400) / 2 = 60020
    expect(p.revised_forecast).toBeCloseTo(60020, 2);
    expect(p.revised_forecast).toBeGreaterThan(p.budget);
    // 60020 / 41600 = 1.4428 > 1.15 → FUORI_BUDGET
    expect(p.rag_status).toBe(RAGStatus.FUORI_BUDGET);
  });

  it('not_started phase without snapshot: revised_forecast equals budget', async () => {
    const q = makeStubQuery([
      // phases
      { rows: [{ id: 30, phase_type: 'deployment', display_name: 'Deployment', status: 'not_started', working_days: 15, planned_hours: 120, contingency_pct: 0 }] },
      // budget batch for [30]
      { rows: [{ phase_id: 30, budget: '6000' }] },
      // snapshot batch: no per-phase snapshots
      { rows: [] },
      // legacy fallback: no project-level snapshots either
      { rows: [] },
    ]);

    const rollup = await computeProjectFinancials(1, { query: q });

    const p = rollup.phases[0];
    expect(p.forecast_basis).toBe('not_started');
    expect(p.revised_forecast).toBe(6000);
    expect(p.budget).toBe(6000);
    expect(p.variance).toBe(0);
    expect(p.cost_spent).toBe(0);
    expect(p.rag_status).toBe(RAGStatus.IN_LINEA);
  });

  it('rollup: total_revised_forecast is sum of per-phase EAC', async () => {
    const q = makeStubQuery([
      // phases: one completed + one not_started
      {
        rows: [
          { id: 1, phase_type: 'feasibility', display_name: 'Feasibility', status: 'completed', working_days: 12, planned_hours: 96, contingency_pct: 0 },
          { id: 2, phase_type: 'closure',     display_name: 'Closure',     status: 'not_started', working_days: 8, planned_hours: 64, contingency_pct: 0 },
        ],
      },
      // budget batch for [1, 2]
      { rows: [{ phase_id: 1, budget: '4080' }, { phase_id: 2, budget: '2600' }] },
      // snapshot batch: only phase 1 has a snapshot (completed)
      { rows: [{ phase_id: 1, cost_spent_to_date: '4200', hours_spent_to_date: '80', working_days_used: 12 }] },
    ]);

    const rollup = await computeProjectFinancials(1, { query: q });

    expect(rollup.phases).toHaveLength(2);
    // phase 1: revised = 4200 (completed, cost_spent)
    // phase 2: revised = 2600 (not_started, budget)
    expect(rollup.total_revised_forecast).toBeCloseTo(4200 + 2600, 5);
    expect(rollup.total_budget).toBeCloseTo(4080 + 2600, 5);
    expect(rollup.total_cost_spent).toBeCloseTo(4200, 5);
    expect(rollup.total_variance).toBeCloseTo((4200 + 2600) - (4080 + 2600), 5);
  });

  it('zero budget and zero forecast: RAG is IN_LINEA', async () => {
    const q = makeStubQuery([
      { rows: [{ id: 99, phase_type: 'feasibility', display_name: 'Feasibility', status: 'not_started', working_days: 0, planned_hours: 0, contingency_pct: 0 }] },
      // budget batch for [99]
      { rows: [{ phase_id: 99, budget: '0' }] },
      // snapshot batch: no per-phase snapshots
      { rows: [] },
      // legacy fallback: no project-level snapshots either
      { rows: [] },
    ]);

    const rollup = await computeProjectFinancials(1, { query: q });

    const p = rollup.phases[0];
    expect(p.budget).toBe(0);
    expect(p.revised_forecast).toBe(0);
    expect(p.rag_status).toBe(RAGStatus.IN_LINEA);
    expect(rollup.rag_status).toBe(RAGStatus.IN_LINEA);
  });
});
