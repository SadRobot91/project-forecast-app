/**
 * Unit tests for AllocationAggregator.
 *
 * The service is the single source of truth for the cross-project FTE
 * rule. Each method is tested in isolation by injecting a stub `query`
 * function — no real DB, no module mocks, fast and deterministic.
 */

import {
  getWeeklyTotal,
  canAllocate,
  getRegistryAggregate,
} from './allocationAggregator';

// Helper: build a fake query function whose responses are queued up in
// order. Each call returns the next queued result.
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

describe('getWeeklyTotal', () => {
  it('sums fte for the given (resource, week)', async () => {
    const q = makeStubQuery([{ rows: [{ total: '0.85' }] }]);
    const total = await getWeeklyTotal(2, '2026-06-01', { query: q });
    expect(total).toBe(0.85);
    expect(q.calls[0].params).toEqual([2, '2026-06-01']);
    expect(q.calls[0].sql).not.toContain('project_id != $3');
  });

  it('excludes a given project_id when requested', async () => {
    const q = makeStubQuery([{ rows: [{ total: '0.3' }] }]);
    const total = await getWeeklyTotal(2, '2026-06-01', {
      excludeProjectId: 1,
      query: q,
    });
    expect(total).toBe(0.3);
    expect(q.calls[0].params).toEqual([2, '2026-06-01', 1]);
    expect(q.calls[0].sql).toContain('project_id != $3');
  });

  it('returns 0 when no allocation exists', async () => {
    const q = makeStubQuery([{ rows: [{ total: '0' }] }]);
    const total = await getWeeklyTotal(99, '2099-01-01', { query: q });
    expect(total).toBe(0);
  });
});

describe('canAllocate', () => {
  it('returns ok=true when the new total fits under 1.0', async () => {
    const q = makeStubQuery([{ rows: [{ total: '0.3' }] }]);
    const decision = await canAllocate(2, '2026-06-01', 0.5, {
      excludeProjectId: 1,
      query: q,
    });
    expect(decision.ok).toBe(true);
    expect(decision.current_total).toBe(0.3);
    expect(decision.requested).toBe(0.5);
    expect(decision.would_be).toBe(0.8);
    expect(decision.excess).toBeUndefined();
    expect(decision.breakdown).toBeUndefined();
  });

  it('returns ok=true at exactly 1.0 (boundary)', async () => {
    const q = makeStubQuery([{ rows: [{ total: '0.7' }] }]);
    const decision = await canAllocate(2, '2026-06-01', 0.3, { query: q });
    expect(decision.ok).toBe(true);
    expect(decision.would_be).toBe(1.0);
  });

  it('returns ok=false with breakdown when total exceeds 1.0', async () => {
    const q = makeStubQuery([
      { rows: [{ total: '0.8' }] }, // getWeeklyTotal
      { rows: [                       // breakdown SELECT
        { project_id: 5, project_name: 'RXI', fte: '0.5' },
        { project_id: 7, project_name: 'PChal', fte: '0.3' },
      ] },
    ]);
    const decision = await canAllocate(2, '2026-06-01', 0.4, { query: q });
    expect(decision.ok).toBe(false);
    expect(decision.current_total).toBe(0.8);
    expect(decision.would_be).toBeCloseTo(1.2, 5);
    expect(decision.excess).toBeCloseTo(0.2, 5);
    expect(decision.breakdown).toEqual([
      { project_id: 5, project_name: 'RXI', fte: 0.5 },
      { project_id: 7, project_name: 'PChal', fte: 0.3 },
    ]);
  });

  it('forwards excludeProjectId to the breakdown query too', async () => {
    const q = makeStubQuery([
      { rows: [{ total: '0.9' }] },
      { rows: [] },
    ]);
    await canAllocate(2, '2026-06-01', 0.3, {
      excludeProjectId: 1,
      query: q,
    });
    expect(q.calls[0].params).toEqual([2, '2026-06-01', 1]);
    expect(q.calls[1].params).toEqual([2, '2026-06-01', 1]);
    expect(q.calls[1].sql).toContain('ae.project_id != $3');
  });
});

describe('getRegistryAggregate', () => {
  it('groups allocations by resource and computes weekly totals', async () => {
    const q = makeStubQuery([{
      rows: [
        { resource_id: 2, resource_name: 'Vishal', role: 'Dev', day_rate: '600',
          project_id: 1, project_name: 'RXI', project_status: 'active',
          week_start: '2026-06-01', fte: '0.8' },
        { resource_id: 2, resource_name: 'Vishal', role: 'Dev', day_rate: '600',
          project_id: 2, project_name: 'PChal', project_status: 'active',
          week_start: '2026-06-01', fte: '0.5' },
        { resource_id: 3, resource_name: 'Giuseppe', role: 'PM', day_rate: '680',
          project_id: 1, project_name: 'RXI', project_status: 'active',
          week_start: '2026-06-08', fte: '0.3' },
      ],
    }]);

    const agg = await getRegistryAggregate({ query: q });

    expect(agg.weeks).toEqual(['2026-06-01', '2026-06-08']);
    expect(agg.rows).toHaveLength(2);

    const vishal = agg.rows.find((r) => r.resource.name === 'Vishal')!;
    expect(vishal.totals['2026-06-01']).toBeCloseTo(1.3, 5);
    expect(vishal.allocations).toHaveLength(2);

    expect(agg.has_overallocation).toBe(true);
  });

  it('reports has_overallocation=false when all weeks are <= 1.0', async () => {
    const q = makeStubQuery([{
      rows: [
        { resource_id: 2, resource_name: 'Vishal', role: 'Dev', day_rate: '600',
          project_id: 1, project_name: 'RXI', project_status: 'active',
          week_start: '2026-06-01', fte: '0.7' },
      ],
    }]);
    const agg = await getRegistryAggregate({ query: q });
    expect(agg.has_overallocation).toBe(false);
  });
});
