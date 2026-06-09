/**
 * Route-level unit tests — all DB calls are mocked so no real DB is needed.
 * Tests verify: correct SQL field names, response shape, error handling.
 */

// ── Mock the DB module ────────────────────────────────────────────────────────
const mockQuery = jest.fn();
jest.mock('../db', () => ({
  query: (...args: any[]) => mockQuery(...args),
  withTransaction: async (fn: (q: any) => Promise<any>) => fn((...args: any[]) => mockQuery(...args)),
}));

// ── Mock computations (only where routes use them) ────────────────────────────
jest.mock('../services/computations', () => ({
  calculateNetworkDays: jest.fn(() => 5),
  validateFTE: jest.fn(() => ({ isValid: true, warnings: [] })),
  calculateRevisedForecast: jest.fn(() => 64600),
  calculateRAGStatus: jest.fn(() => 'IN_LINEA'),
}));

// ── Mock allocationAggregator: the routes delegate to it ──────────────────────
const mockGetWeeklyTotal = jest.fn();
const mockGetRegistryAggregate = jest.fn();
const mockCanAllocate = jest.fn().mockResolvedValue({ ok: true, excess: 0, breakdown: {} });
jest.mock('../services/allocationAggregator', () => ({
  getWeeklyTotal:        (...args: any[]) => mockGetWeeklyTotal(...args),
  getRegistryAggregate:  (...args: any[]) => mockGetRegistryAggregate(...args),
  canAllocate:           (...args: any[]) => mockCanAllocate(...args),
}));

import express from 'express';
import request from 'supertest';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeApp(router: any, mountPath = '/') {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  return app;
}

function dbOk(rows: any[], rowCount = rows.length) {
  return { rows, rowCount };
}

beforeEach(() => {
  mockQuery.mockReset();
  mockGetWeeklyTotal.mockReset();
  mockGetRegistryAggregate.mockReset();
  mockCanAllocate.mockReset();
  mockCanAllocate.mockResolvedValue({ ok: true, excess: 0, breakdown: {} });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/projects', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./projects');
    app = makeApp(router, '/api/projects');
  });

  it('returns project list', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([
      { id: 1, name: 'RXI Platform', status: 'active', currency: 'GBP',
        current_phase: 'build', budget_spent: '36200', budget_total: '64600',
        working_days_total: '120' },
    ]));

    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 1, name: 'RXI Platform', status: 'active' });
  });
});

describe('PATCH /api/projects/:id/status', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./projects');
    app = makeApp(router, '/api/projects');
  });

  it('updates status to on_hold', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{ id: 1, status: 'on_hold' }]));
    const res = await request(app).patch('/api/projects/1/status').send({ status: 'on_hold' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('on_hold');
  });

  it('updates status to closed', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{ id: 1, status: 'closed' }]));
    const res = await request(app).patch('/api/projects/1/status').send({ status: 'closed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('closed');
  });

  it('rejects invalid status', async () => {
    const res = await request(app).patch('/api/projects/1/status').send({ status: 'paused' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid status/i);
  });

  it('returns 404 when project not found', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([], 0));
    const res = await request(app).patch('/api/projects/999/status').send({ status: 'closed' });
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ALLOCATION — field names must be week_start / weekly_cost (not month/monthly_cost)
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/projects/:id/allocation', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./allocations');
    const outer = express();
    outer.use(express.json());
    outer.use('/api/projects/:id/allocation', router);
    app = outer;
  });

  it('returns week_start and weekly_cost (not month/monthly_cost)', async () => {
    // 1. project exists
    mockQuery.mockResolvedValueOnce(dbOk([{ name: 'RXI Platform' }]));
    // 2. phases
    mockQuery.mockResolvedValueOnce(dbOk([
      { phase_id: 1, phase_type: 'build', order: 3, planned_start: new Date('2026-03-02'), planned_end: new Date('2026-06-19'), status: 'in_progress' },
    ]));
    // 3. allocation entries — must use week_start + weekly_cost field names
    mockQuery.mockResolvedValueOnce(dbOk([
      { phase_id: 1, resource_id: 2, week_start: '2026-03-02', fte: '0.8', working_days: 5, weekly_cost: '2400', name: 'Vishal', role: 'Dev', day_rate: '600' },
    ]));
    // 4. all resources
    mockQuery.mockResolvedValueOnce(dbOk([
      { id: 2, name: 'Vishal', role: 'Dev', day_rate: '600' },
    ]));

    const res = await request(app).get('/api/projects/1/allocation');
    expect(res.status).toBe(200);
    const cell = res.body.phases[0].cells[0];
    expect(cell).toHaveProperty('week_start', '2026-03-02');
    expect(cell).toHaveProperty('weekly_cost', 2400);
    expect(cell).not.toHaveProperty('month');
    expect(cell).not.toHaveProperty('monthly_cost');
  });

  it('returns 404 for unknown project', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([], 0));
    const res = await request(app).get('/api/projects/999/allocation');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/projects/:id/allocation', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./allocations');
    const outer = express();
    outer.use(express.json());
    outer.use('/api/projects/:id/allocation', router);
    app = outer;
  });

  it('saves with week_start (not month) in INSERT', async () => {
    // withTransaction calls fn(mockQuery) directly — no BEGIN/COMMIT through mockQuery
    mockQuery.mockResolvedValueOnce(dbOk([])); // pg_advisory_xact_lock
    mockQuery.mockResolvedValueOnce(dbOk([])); // DELETE
    // canAllocate is mocked separately — no mockQuery call
    mockQuery.mockResolvedValueOnce(dbOk([{ day_rate: '600' }])); // SELECT day_rate (resource first)
    mockQuery.mockResolvedValueOnce(dbOk([{ planned_start: new Date('2026-03-02'), planned_end: new Date('2026-06-19') }])); // calculatePhaseWeekWorkingDays
    mockQuery.mockResolvedValueOnce(dbOk([{ id: 1, resource_id: 2, project_id: 1, phase_id: 1, week_start: '2026-03-02', fte: 0.8, working_days: 5, weekly_cost: 2400 }])); // INSERT RETURNING

    const res = await request(app)
      .put('/api/projects/1/allocation')
      .send({ phase_id: 1, allocations: [{ resource_id: 2, week_start: '2026-03-02', fte: 0.8 }] });

    // Verify INSERT SQL uses week_start and weekly_cost
    const insertCall = mockQuery.mock.calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('INSERT INTO "AllocationEntry"') && c[0].includes('week_start')
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![0]).toContain('weekly_cost');
    expect(insertCall![0]).not.toContain('monthly_cost');
    expect(insertCall![0]).not.toContain('"month"');
  });

  // Step B: AllocationEntry is the working copy and stays mutable after
  // baseline lock. The BAC is preserved as a snapshot on the Baseline row.
  it('allows updates even when baseline is locked (working copy)', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([])); // pg_advisory_xact_lock
    mockQuery.mockResolvedValueOnce(dbOk([])); // DELETE
    // canAllocate mocked separately
    mockQuery.mockResolvedValueOnce(dbOk([{ day_rate: '600' }])); // SELECT day_rate
    mockQuery.mockResolvedValueOnce(dbOk([{ planned_start: new Date('2026-03-02'), planned_end: new Date('2026-06-19') }])); // calculatePhaseWeekWorkingDays
    mockQuery.mockResolvedValueOnce(dbOk([{ id: 1, resource_id: 2, project_id: 1, phase_id: 1, week_start: '2026-03-09', fte: 0.5, working_days: 5, weekly_cost: 1500 }])); // INSERT

    const res = await request(app)
      .put('/api/projects/1/allocation')
      .send({ phase_id: 1, allocations: [{ resource_id: 2, week_start: '2026-03-09', fte: 0.5 }] });

    expect(res.status).toBe(200);
    // No SELECT on Baseline.locked_at gate any more
    const lockCheck = mockQuery.mock.calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('SELECT locked_at FROM "Baseline"')
    );
    expect(lockCheck).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCE REGISTRY — must use week_start (not month) and include project_status
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/resources/registry', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./resources');
    app = makeApp(router, '/api/resources');
  });

  it('delegates to AllocationAggregator and returns its response verbatim', async () => {
    const aggregate = {
      weeks: ['2026-03-02'],
      rows: [{
        resource: { id: 1, name: 'Giuseppe', role: 'PM', day_rate: 680 },
        allocations: [{
          project_id: 1, project_name: 'RXI Platform', project_status: 'active',
          week_start: '2026-03-02', fte: 0.3,
        }],
        totals: { '2026-03-02': 0.3 },
      }],
      has_overallocation: false,
    };
    mockGetRegistryAggregate.mockResolvedValueOnce(aggregate);

    const res = await request(app).get('/api/resources/registry');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(aggregate);
    expect(mockGetRegistryAggregate).toHaveBeenCalledTimes(1);
  });

  // Step B: PUT /resources/:id always proceeds. The locked BAC is
  // protected by the snapshot, not by blocking day_rate changes.
  describe('PUT /api/resources/:id', () => {
    it('updates day_rate, records history, and cascades only to future entries', async () => {
      // withTransaction calls fn(mockQuery) directly — no BEGIN/COMMIT through mockQuery
      mockQuery.mockResolvedValueOnce(dbOk([{ id: 2, name: 'Vishal', role: 'Dev', day_rate: '700' }])); // UPDATE Resource RETURNING
      mockQuery.mockResolvedValueOnce(dbOk([])); // INSERT ResourceDayRateHistory
      mockQuery.mockResolvedValueOnce(dbOk([], 0)); // UPDATE AllocationEntry (future only)

      const res = await request(app)
        .put('/api/resources/2')
        .send({ name: 'Vishal', role: 'Dev', day_rate: 700 });

      expect(res.status).toBe(200);
      expect(parseFloat(res.body.day_rate)).toBe(700);

      // History INSERT must target ResourceDayRateHistory
      const historyCall = mockQuery.mock.calls.find((c: any[]) =>
        typeof c[0] === 'string' && c[0].includes('ResourceDayRateHistory')
      );
      expect(historyCall).toBeDefined();

      // Cascade must be limited to current/future entries only
      const cascadeCall = mockQuery.mock.calls.find((c: any[]) =>
        typeof c[0] === 'string' && c[0].includes('UPDATE "AllocationEntry"')
      );
      expect(cascadeCall).toBeDefined();
      expect(cascadeCall![0]).toContain("week_start >= DATE_TRUNC('week', CURRENT_DATE)");

      // The locked-baseline join must NOT be issued
      const lockCheck = mockQuery.mock.calls.find((c: any[]) =>
        typeof c[0] === 'string' && c[0].includes('locked_at IS NOT NULL')
      );
      expect(lockCheck).toBeUndefined();
    });
  });

  it('propagates has_overallocation from the aggregator', async () => {
    mockGetRegistryAggregate.mockResolvedValueOnce({
      weeks: ['2026-06-01'],
      rows: [{
        resource: { id: 2, name: 'Vishal', role: 'Dev', day_rate: 600 },
        allocations: [],
        totals: { '2026-06-01': 1.3 },
      }],
      has_overallocation: true,
    });
    const res = await request(app).get('/api/resources/registry');
    expect(res.status).toBe(200);
    expect(res.body.has_overallocation).toBe(true);
    expect(res.body.rows[0].totals['2026-06-01']).toBeCloseTo(1.3, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PHASES — Step I: working-copy schedule edits (planned dates, status)
// Allowed even when the baseline is locked. Does NOT touch BAC parameters.
// ═══════════════════════════════════════════════════════════════════════════════

describe('PATCH /api/projects/:id/phases/:phase_id', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./phases');
    const outer = express();
    outer.use(express.json());
    outer.use('/api/projects/:id/phases', router);
    app = outer;
  });

  it('updates planned_end and recomputes working_days even on a locked baseline', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{                          // phase lookup
      planned_start: new Date('2026-03-02'),
      planned_end:   new Date('2026-06-19'),
    }]));
    mockQuery.mockResolvedValueOnce(dbOk([                            // holidays
      { date: new Date('2026-04-06') },
    ]));
    mockQuery.mockResolvedValueOnce(dbOk([{                           // UPDATE RETURNING
      id: 3, project_id: 1, planned_start: new Date('2026-03-02'),
      planned_end: new Date('2026-07-10'), working_days: 5, planned_hours: 40,
      status: 'in_progress',
    }]));

    const res = await request(app)
      .patch('/api/projects/1/phases/3')
      .send({ planned_end: '2026-07-10' });

    expect(res.status).toBe(200);
    expect(res.body.planned_end).toContain('2026-07-10');

    // Crucially: NO query against Baseline.locked_at — this endpoint
    // is the working-copy escape hatch
    const lockCheck = mockQuery.mock.calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('Baseline')
    );
    expect(lockCheck).toBeUndefined();

    // UPDATE must include planned_end, working_days, planned_hours
    const updateCall = mockQuery.mock.calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('UPDATE "ProjectPhase"')
    );
    expect(updateCall![0]).toContain('planned_end');
    expect(updateCall![0]).toContain('working_days');
    expect(updateCall![0]).toContain('planned_hours');
  });

  it('updates status alone without touching dates', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{
      planned_start: new Date('2026-03-02'),
      planned_end:   new Date('2026-06-19'),
    }]));
    mockQuery.mockResolvedValueOnce(dbOk([{ id: 3, status: 'completed' }]));

    const res = await request(app)
      .patch('/api/projects/1/phases/3')
      .send({ status: 'completed' });

    expect(res.status).toBe(200);

    // No holidays query — dates didn't change, so working_days
    // recomputation is skipped
    const holidaysCall = mockQuery.mock.calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('PublicHoliday')
    );
    expect(holidaysCall).toBeUndefined();

    const updateCall = mockQuery.mock.calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('UPDATE "ProjectPhase"')
    );
    expect(updateCall![0]).toContain('status');
    expect(updateCall![0]).not.toContain('working_days');
  });

  it('rejects invalid status', async () => {
    const res = await request(app)
      .patch('/api/projects/1/phases/3')
      .send({ status: 'archived' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status must be one of/);
  });

  it('rejects when planned_end is before planned_start (using current value for the other side)', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{
      planned_start: new Date('2026-03-02'),
      planned_end:   new Date('2026-06-19'),
    }]));

    const res = await request(app)
      .patch('/api/projects/1/phases/3')
      .send({ planned_end: '2026-02-01' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/planned_end must be on or after planned_start/);
  });

  it('returns 404 when phase does not belong to the project', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([], 0));
    const res = await request(app)
      .patch('/api/projects/1/phases/999')
      .send({ status: 'completed' });
    expect(res.status).toBe(404);
  });

  it('rejects empty body', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{
      planned_start: new Date('2026-03-02'),
      planned_end:   new Date('2026-06-19'),
    }]));
    const res = await request(app).patch('/api/projects/1/phases/3').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no fields to update/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GANTT — task CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/projects/:id/gantt', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./gantt');
    const outer = express();
    outer.use(express.json());
    outer.use('/api/projects/:id/gantt', router);
    app = outer;
  });

  it('returns gantt data with tasks and phases', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{ name: 'RXI Platform' }])); // project
    mockQuery.mockResolvedValueOnce(dbOk([                              // phases
      { phase_id: 1, phase_type: 'build', planned_start: new Date('2026-03-02'), planned_end: new Date('2026-06-19'), status: 'in_progress' },
    ]));
    mockQuery.mockResolvedValueOnce(dbOk([                              // tasks
      { id: 7, project_id: 1, phase_id: 1, name: 'Sprint 1', owner: 'Vishal',
        start_date: new Date('2026-03-02'), end_date: new Date('2026-03-27'),
        working_days: 20, is_milestone: false, actual_date: null },
    ]));

    const res = await request(app).get('/api/projects/1/gantt');
    expect(res.status).toBe(200);
    expect(res.body.phases).toHaveLength(1);
    expect(res.body.phases[0].tasks).toHaveLength(1);
    expect(res.body.phases[0].tasks[0].name).toBe('Sprint 1');
  });
});

describe('POST /api/projects/:id/gantt/tasks', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./gantt');
    const outer = express();
    outer.use(express.json());
    outer.use('/api/projects/:id/gantt', router);
    app = outer;
  });

  it('creates a task and returns 201', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{                           // phase lookup (with bounds)
      phase_type: 'build',
      planned_start: new Date('2026-03-01'), planned_end: new Date('2026-03-31'),
    }]));
    mockQuery.mockResolvedValueOnce(dbOk([{                           // INSERT RETURNING
      id: 99, project_id: 1, phase_id: 1, name: 'New Task', owner: null,
      start_date: new Date('2026-03-02'), end_date: new Date('2026-03-06'),
      working_days: 5, is_milestone: false, status: 'not_started',
    }]));

    const res = await request(app)
      .post('/api/projects/1/gantt/tasks')
      .send({ phase_id: 1, name: 'New Task', start_date: '2026-03-02', end_date: '2026-03-06', is_milestone: false });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Task');
    expect(res.body.phase_type).toBe('build');
  });

  it('returns 404 for unknown phase', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([], 0));
    const res = await request(app)
      .post('/api/projects/1/gantt/tasks')
      .send({ phase_id: 999, name: 'X', start_date: '2026-03-02', end_date: '2026-03-06' });
    expect(res.status).toBe(404);
  });

  // BUG-15: date validation paths for POST
  it('rejects end_date before start_date', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{
      phase_type: 'build',
      planned_start: new Date('2026-03-01'), planned_end: new Date('2026-03-31'),
    }]));
    const res = await request(app)
      .post('/api/projects/1/gantt/tasks')
      .send({ phase_id: 1, name: 'Bad', start_date: '2026-03-10', end_date: '2026-03-05' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/end_date.*must be.*start_date/);
  });

  it('rejects start_date before phase start', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{
      phase_type: 'build',
      planned_start: new Date('2026-03-01'), planned_end: new Date('2026-03-31'),
    }]));
    const res = await request(app)
      .post('/api/projects/1/gantt/tasks')
      .send({ phase_id: 1, name: 'Bad', start_date: '2026-02-20', end_date: '2026-03-05' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/precede/);
  });

  it('rejects end_date after phase end', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{
      phase_type: 'build',
      planned_start: new Date('2026-03-01'), planned_end: new Date('2026-03-31'),
    }]));
    const res = await request(app)
      .post('/api/projects/1/gantt/tasks')
      .send({ phase_id: 1, name: 'Bad', start_date: '2026-03-20', end_date: '2026-04-05' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/supera/);
  });
});

describe('PUT /api/projects/:id/gantt/tasks/:tid', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./gantt');
    const outer = express();
    outer.use(express.json());
    outer.use('/api/projects/:id/gantt', router);
    app = outer;
  });

  it('updates name and status', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{ id: 7 }]));
    const res = await request(app)
      .put('/api/projects/1/gantt/tasks/7')
      .send({ name: 'Updated', status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain('name');
    expect(sql).toContain('status');
  });

  it('returns 400 with no fields', async () => {
    const res = await request(app).put('/api/projects/1/gantt/tasks/7').send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown task', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([], 0));
    const res = await request(app).put('/api/projects/1/gantt/tasks/999').send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  // BUG-14: date validation paths for PUT
  it('rejects end_date before start_date', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{
      start_date: new Date('2026-03-02'), end_date: new Date('2026-03-06'),
      is_milestone: false, planned_start: new Date('2026-03-01'), planned_end: new Date('2026-03-31'),
    }]));
    const res = await request(app)
      .put('/api/projects/1/gantt/tasks/7')
      .send({ start_date: '2026-03-10', end_date: '2026-03-05' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/end_date.*must be.*start_date/);
  });

  it('rejects start_date before phase start', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{
      start_date: new Date('2026-03-05'), end_date: new Date('2026-03-10'),
      is_milestone: false, planned_start: new Date('2026-03-03'), planned_end: new Date('2026-03-31'),
    }]));
    const res = await request(app)
      .put('/api/projects/1/gantt/tasks/7')
      .send({ start_date: '2026-03-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/precede/);
  });

  it('rejects end_date after phase end', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{
      start_date: new Date('2026-03-05'), end_date: new Date('2026-03-10'),
      is_milestone: false, planned_start: new Date('2026-03-01'), planned_end: new Date('2026-03-20'),
    }]));
    const res = await request(app)
      .put('/api/projects/1/gantt/tasks/7')
      .send({ end_date: '2026-03-25' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/supera/);
  });

  it('accepts valid date update within phase bounds', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{
      start_date: new Date('2026-03-05'), end_date: new Date('2026-03-10'),
      is_milestone: false, planned_start: new Date('2026-03-01'), planned_end: new Date('2026-03-31'),
    }]));
    mockQuery.mockResolvedValueOnce(dbOk([{ id: 7 }]));
    const res = await request(app)
      .put('/api/projects/1/gantt/tasks/7')
      .send({ start_date: '2026-03-08', end_date: '2026-03-15' });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/projects/:id/gantt/tasks/:tid', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./gantt');
    const outer = express();
    outer.use(express.json());
    outer.use('/api/projects/:id/gantt', router);
    app = outer;
  });

  it('deletes a task', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{ id: 7 }]));
    const res = await request(app).delete('/api/projects/1/gantt/tasks/7');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for unknown task', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([], 0));
    const res = await request(app).delete('/api/projects/1/gantt/tasks/999');
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BASELINE
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/projects/:id/baseline', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./baseline');
    const outer = express();
    outer.use(express.json());
    outer.use('/api/projects/:id/baseline', router);
    app = outer;
  });

  it('returns baseline with weekly_cost-based budget (not monthly) when unlocked', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{ name: 'RXI Platform' }]));       // project
    mockQuery.mockResolvedValueOnce(dbOk([{ locked_at: null, phase_snapshot_at_lock: null }])); // baseline row
    mockQuery.mockResolvedValueOnce(dbOk([                                     // phases with SUM(weekly_cost)
      { phase_id: 1, phase_type: 'feasibility', display_name: 'Feasibility', order: 1,
        planned_start: new Date('2026-01-05'), planned_end: new Date('2026-01-20'),
        working_days: 12, planned_hours: 96, status: 'completed', budget: '4080', contingency_pct: '10' },
    ]));

    const res = await request(app).get('/api/projects/1/baseline');
    expect(res.status).toBe(200);
    expect(res.body.phases[0].budget).toBe(4080);
    expect(res.body.is_locked).toBe(false);
    expect(res.body.served_from_snapshot).toBe(false);
    expect(res.body.phases[0].contingency_pct).toBe(10);

    // The SQL must reference weekly_cost, not monthly_cost
    const phaseQuery = mockQuery.mock.calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('weekly_cost')
    );
    expect(phaseQuery).toBeDefined();
    expect(phaseQuery![0]).not.toContain('monthly_cost');
  });

  // Step B: when baseline is locked AND snapshot exists, GET returns the
  // frozen BAC rather than the current SUM. This is what makes variance
  // meaningful — the working copy can evolve, the baseline does not.
  it('returns frozen snapshot when baseline is locked', async () => {
    const lockedAt = '2026-02-01T10:00:00Z';
    const snapshot = [
      { phase_id: 1, phase_type: 'build', display_name: 'Build', order: 3,
        planned_start: '2026-03-02', planned_end: '2026-06-19',
        working_days: 80, planned_hours: 640, status: 'in_progress',
        budget: 42500, contingency_pct: 10 },
    ];
    mockQuery.mockResolvedValueOnce(dbOk([{ name: 'RXI Platform' }]));
    mockQuery.mockResolvedValueOnce(dbOk([{
      locked_at: lockedAt,
      total_budget_at_lock: '42500',
      total_forecast_at_lock: '46750',
      total_working_days_at_lock: 80,
      phase_snapshot_at_lock: snapshot,
    }]));

    const res = await request(app).get('/api/projects/1/baseline');
    expect(res.status).toBe(200);
    expect(res.body.is_locked).toBe(true);
    expect(res.body.served_from_snapshot).toBe(true);
    expect(res.body.total_budget).toBe(42500);
    expect(res.body.total_forecast).toBe(46750);
    expect(res.body.phases).toHaveLength(1);
    expect(res.body.phases[0].budget).toBe(42500);

    // Live SUM query must NOT be issued when snapshot is served
    const liveQuery = mockQuery.mock.calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('SUM(ae.weekly_cost)')
    );
    expect(liveQuery).toBeUndefined();
  });

  it('falls back to live SUM when locked but snapshot is missing (pre-Step-B lock)', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{ name: 'RXI Platform' }]));
    mockQuery.mockResolvedValueOnce(dbOk([{
      locked_at: '2025-12-01T00:00:00Z',
      total_budget_at_lock: null,
      phase_snapshot_at_lock: null,
    }]));
    mockQuery.mockResolvedValueOnce(dbOk([
      { phase_id: 1, phase_type: 'build', display_name: 'Build', order: 3,
        planned_start: new Date('2026-03-02'), planned_end: new Date('2026-06-19'),
        working_days: 80, planned_hours: 640, status: 'in_progress',
        budget: '42500', contingency_pct: '10' },
    ]));

    const res = await request(app).get('/api/projects/1/baseline');
    expect(res.status).toBe(200);
    expect(res.body.is_locked).toBe(true);
    expect(res.body.served_from_snapshot).toBe(false);
    expect(res.body.total_budget).toBe(42500);
  });
});

describe('POST /api/projects/:id/baseline/lock', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./baseline');
    const outer = express();
    outer.use(express.json());
    outer.use('/api/projects/:id/baseline', router);
    app = outer;
  });

  it('locks baseline and stores the BAC snapshot', async () => {
    const now = new Date().toISOString();
    mockQuery.mockResolvedValueOnce(dbOk([{ locked_at: null }]));    // existing lock check
    mockQuery.mockResolvedValueOnce(dbOk([                            // readLivePhases
      { phase_id: 1, phase_type: 'build', display_name: 'Build', order: 3,
        planned_start: new Date('2026-03-02'), planned_end: new Date('2026-06-19'),
        working_days: 80, planned_hours: 640, status: 'in_progress',
        budget: '42500', contingency_pct: '10' },
    ]));
    mockQuery.mockResolvedValueOnce(dbOk([])); // BEGIN
    mockQuery.mockResolvedValueOnce(dbOk([])); // INSERT/UPDATE Baseline with snapshot
    mockQuery.mockResolvedValueOnce(dbOk([])); // COMMIT
    mockQuery.mockResolvedValueOnce(dbOk([{
      locked_at: now,
      total_budget_at_lock: '42500',
      total_forecast_at_lock: '46750',
      total_working_days_at_lock: 80,
    }]));

    const res = await request(app).post('/api/projects/1/baseline/lock');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('locked_at');
    expect(res.body.total_budget_at_lock).toBe(42500);
    expect(res.body.total_forecast_at_lock).toBe(46750);
    expect(res.body.total_working_days_at_lock).toBe(80);

    // The INSERT must reference all four snapshot columns
    const insertCall = mockQuery.mock.calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('INSERT INTO "Baseline"') &&
      c[0].includes('phase_snapshot_at_lock')
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![0]).toContain('total_budget_at_lock');
    expect(insertCall![0]).toContain('total_forecast_at_lock');
    expect(insertCall![0]).toContain('total_working_days_at_lock');
    // And the JSONB array must include the per-phase data we read
    const snapshotArg = JSON.parse(insertCall![1][4]);
    expect(snapshotArg).toHaveLength(1);
    expect(snapshotArg[0].phase_id).toBe(1);
    expect(snapshotArg[0].budget).toBe(42500);
  });

  it('is idempotent — returns existing locked_at if already locked', async () => {
    const ts = '2026-01-20T12:00:00Z';
    mockQuery.mockResolvedValueOnce(dbOk([{ locked_at: ts }]));
    const res = await request(app).post('/api/projects/1/baseline/lock');
    expect(res.status).toBe(200);
    expect(res.body.locked_at).toBe(ts);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ALLOCATION WARNINGS — must use week_start (not month)
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/projects/:id/allocation/warnings', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./allocations');
    const outer = express();
    outer.use(express.json());
    outer.use('/api/projects/:id/allocation', router);
    app = outer;
  });

  it('returns 400 when week_start is missing', async () => {
    const res = await request(app).get('/api/projects/1/allocation/warnings?resource_id=2');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('week_start');
  });

  it('returns isValid=true when total stays within 1.0', async () => {
    // Two calls: one with excludeProjectId, one without (to derive self total)
    mockGetWeeklyTotal.mockResolvedValueOnce(0.5).mockResolvedValueOnce(0.8);

    const res = await request(app).get('/api/projects/1/allocation/warnings?resource_id=2&week_start=2026-06-01');
    expect(res.status).toBe(200);
    expect(res.body.isValid).toBe(true);
    expect(res.body.warnings).toEqual([]);
  });

  it('returns isValid=false with excess when total exceeds 1.0', async () => {
    mockGetWeeklyTotal.mockResolvedValueOnce(0.5).mockResolvedValueOnce(1.3);

    const res = await request(app).get('/api/projects/1/allocation/warnings?resource_id=2&week_start=2026-06-01');
    expect(res.status).toBe(200);
    expect(res.body.isValid).toBe(false);
    expect(res.body.warnings[0]).toHaveProperty('week_start', '2026-06-01');
    expect(res.body.warnings[0].excess).toBeCloseTo(0.3, 5);
    expect(res.body.warnings[0]).not.toHaveProperty('month');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCES — GET list, POST create, PUT validation, DELETE
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/resources', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./resources');
    app = makeApp(router, '/api/resources');
  });

  it('returns full resource list ordered by name', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([
      { id: 1, name: 'Alice', role: 'PM', day_rate: '500' },
      { id: 2, name: 'Bob',   role: 'Dev', day_rate: '600' },
    ]));
    const res = await request(app).get('/api/resources');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe('Alice');
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain('ORDER BY name ASC');
  });
});

describe('POST /api/resources', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./resources');
    app = makeApp(router, '/api/resources');
  });

  it('creates a resource and returns 201', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{ id: 3, name: 'Charlie', role: 'Dev', day_rate: '600' }]));
    const res = await request(app).post('/api/resources').send({ name: 'Charlie', role: 'Dev', day_rate: 600 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Charlie');
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain('INSERT INTO "Resource"');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/api/resources').send({ role: 'Dev', day_rate: 600 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('name');
  });

  it('returns 400 when name is empty string', async () => {
    const res = await request(app).post('/api/resources').send({ name: '   ', role: 'Dev', day_rate: 600 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when day_rate is not a number', async () => {
    const res = await request(app).post('/api/resources').send({ name: 'Alice', day_rate: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('day_rate');
  });

  it('returns 400 when day_rate is zero', async () => {
    const res = await request(app).post('/api/resources').send({ name: 'Alice', day_rate: 0 });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/resources/:id — validation and 404', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./resources');
    app = makeApp(router, '/api/resources');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app).put('/api/resources/1').send({ role: 'Dev', day_rate: 600 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('name');
  });

  it('returns 400 when day_rate is invalid', async () => {
    const res = await request(app).put('/api/resources/1').send({ name: 'Alice', day_rate: -10 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('day_rate');
  });

  it('returns 404 when resource not found', async () => {
    // withTransaction calls fn(mockQuery) directly — ROLLBACK handled by withTransaction internally
    mockQuery.mockResolvedValueOnce(dbOk([], 0));       // UPDATE Resource → rowCount 0
    const res = await request(app).put('/api/resources/99').send({ name: 'Ghost', day_rate: 500 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/resources/:id', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./resources');
    app = makeApp(router, '/api/resources');
  });

  it('deletes a resource that has no allocations', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([], 0));                        // SELECT allocCheck → empty
    mockQuery.mockResolvedValueOnce(dbOk([{ id: 1 }], 1));              // DELETE RETURNING
    const res = await request(app).delete('/api/resources/1');
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Deleted');
  });

  it('returns 400 when resource has existing allocations', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{ id: 5 }], 1));              // SELECT allocCheck → found
    const res = await request(app).delete('/api/resources/1');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('allocated');
  });

  it('returns 404 when resource does not exist', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([], 0));                        // SELECT allocCheck → empty
    mockQuery.mockResolvedValueOnce(dbOk([], 0));                        // DELETE → rowCount 0
    const res = await request(app).delete('/api/resources/99');
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BASELINE — PUT (save phases)
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/projects/:id/baseline', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./baseline');
    const outer = express();
    outer.use(express.json());
    outer.use('/api/projects/:id/baseline', router);
    app = outer;
  });

  it('returns 400 when phases is empty array', async () => {
    const res = await request(app).put('/api/projects/1/baseline').send({ phases: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('phases');
  });

  it('returns 400 when a phase has non-numeric phase_id', async () => {
    const res = await request(app)
      .put('/api/projects/1/baseline')
      .send({ phases: [{ phase_id: 'abc', planned_start: '2026-01-01', planned_end: '2026-03-31' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('phase_id');
  });

  it('returns 400 when contingency_pct is out of range', async () => {
    const res = await request(app)
      .put('/api/projects/1/baseline')
      .send({ phases: [{ phase_id: 1, contingency_pct: 150 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('contingency_pct');
  });

  it('returns 400 when baseline is already locked', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{ locked_at: '2026-01-01T00:00:00Z' }]));
    const res = await request(app)
      .put('/api/projects/1/baseline')
      .send({ phases: [{ phase_id: 1, planned_start: '2026-01-05', planned_end: '2026-03-28' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('locked');
  });

  it('saves phases without display_name and returns success', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([]));          // SELECT locked_at → no row (not locked)
    mockQuery.mockResolvedValueOnce(dbOk([]));          // SELECT holidays
    mockQuery.mockResolvedValueOnce(dbOk([]));          // BEGIN
    mockQuery.mockResolvedValueOnce(dbOk([]));          // UPDATE ProjectPhase (no display_name branch)
    mockQuery.mockResolvedValueOnce(dbOk([]));          // INSERT INTO Baseline ON CONFLICT
    mockQuery.mockResolvedValueOnce(dbOk([]));          // COMMIT

    const res = await request(app)
      .put('/api/projects/1/baseline')
      .send({ phases: [{ phase_id: 1, planned_start: '2026-01-05', planned_end: '2026-03-28', contingency_pct: 10 }] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updateCall = mockQuery.mock.calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('UPDATE "ProjectPhase"')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![0]).not.toContain('display_name');
  });

  it('saves phases with display_name using the display_name SQL branch', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([]));          // SELECT locked_at → no row
    mockQuery.mockResolvedValueOnce(dbOk([]));          // SELECT holidays
    mockQuery.mockResolvedValueOnce(dbOk([]));          // BEGIN
    mockQuery.mockResolvedValueOnce(dbOk([]));          // UPDATE ProjectPhase (with display_name)
    mockQuery.mockResolvedValueOnce(dbOk([]));          // INSERT INTO Baseline ON CONFLICT
    mockQuery.mockResolvedValueOnce(dbOk([]));          // COMMIT

    const res = await request(app)
      .put('/api/projects/1/baseline')
      .send({ phases: [{ phase_id: 1, planned_start: '2026-01-05', planned_end: '2026-03-28', display_name: 'Kick-off' }] });
    expect(res.status).toBe(200);

    const updateCall = mockQuery.mock.calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('display_name')
    );
    expect(updateCall).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GANTT — GET 404 project not found
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/projects/:id/gantt — 404', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./gantt');
    const outer = express();
    outer.use(express.json());
    outer.use('/api/projects/:id/gantt', router);
    app = outer;
  });

  it('returns 404 when project does not exist', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([], 0));       // SELECT name FROM Project → not found
    const res = await request(app).get('/api/projects/99/gantt');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PHASES — type validation edge cases (planned_start / planned_end non-string)
// ═══════════════════════════════════════════════════════════════════════════════

describe('PATCH /api/projects/:id/phases/:phase_id — input type checks', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./phases');
    const outer = express();
    outer.use(express.json());
    outer.use('/api/projects/:id/phases', router);
    app = outer;
  });

  it('returns 400 when planned_start is a number (not a string)', async () => {
    const res = await request(app)
      .patch('/api/projects/1/phases/1')
      .send({ planned_start: 20260101 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('planned_start');
  });

  it('returns 400 when planned_end is a number (not a string)', async () => {
    const res = await request(app)
      .patch('/api/projects/1/phases/1')
      .send({ planned_end: 20260301 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('planned_end');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ALLOCATION — PUT 409 FTE cap exceeded
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/projects/:id/allocation — FTE cap 409', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./allocations');
    const outer = express();
    outer.use(express.json());
    outer.use('/api/projects/:id/allocation', router);
    app = outer;
  });

  it('returns 409 with FTE breakdown when cap is exceeded', async () => {
    mockCanAllocate.mockResolvedValueOnce({
      ok: false,
      excess: 0.5,
      breakdown: [{ project_id: 2, project_name: 'Other Project', fte: 0.8 }],
    });
    mockQuery.mockResolvedValueOnce(dbOk([]));           // pg_advisory_xact_lock
    mockQuery.mockResolvedValueOnce(dbOk([]));           // DELETE AllocationEntry

    const res = await request(app)
      .put('/api/projects/1/allocation')
      .send({ phase_id: 10, allocations: [{ resource_id: 5, week_start: '2026-03-02', fte: 0.8 }] });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('FTE cap');
    expect(res.body.resource_id).toBe(5);
    expect(res.body.excess).toBeCloseTo(0.5);
    expect(res.body.breakdown).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECTS — GET with PM role filter
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/projects — PM role filter', () => {
  let pmApp: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./projects');
    const app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: any) => {
      req.auth = { role: 'pm', userId: 42, email: 'pm@test.com', supabaseUid: 'uid-42' };
      next();
    });
    app.use('/api/projects', router);
    pmApp = app;
  });

  it('adds WHERE pm_id = $1 clause and passes userId as parameter', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{
      id: 3, name: 'PM Project', status: 'active', currency: 'GBP',
      current_phase: 'build', current_phase_display_name: 'Build',
      budget_total: '50000', budget_spent: '10000', budget_pct: 20,
      days_remaining: 30, revised_forecast: 55000, rag_status: 'IN_LINEA',
      variance: 5000,
    }]));

    const res = await request(pmApp).get('/api/projects');
    expect(res.status).toBe(200);

    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain('WHERE p.pm_id = $1');
    const params: any[] = mockQuery.mock.calls[0][1];
    expect(params[0]).toBe(42);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ONGOING — POST snapshot requires phase_id (Bug 2.1 fix)
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/projects/:id/ongoing — phase_id enforcement', () => {
  let app: express.Express;
  beforeAll(async () => {
    jest.mock('../services/ongoing/ManualFallbackProvider', () => ({
      ManualFallbackProvider: jest.fn().mockImplementation(() => ({
        getLatestSnapshot: jest.fn(),
        getHistory: jest.fn(),
        saveSnapshot: jest.fn().mockResolvedValue({ id: 1 }),
      })),
    }));
    jest.mock('../services/ongoing/KeyedinApiProvider', () => ({
      KeyedinApiProvider: jest.fn().mockImplementation(() => ({
        syncData: jest.fn(),
      })),
    }));
    const { default: router } = await import('./ongoing');
    const outer = express();
    outer.use(express.json());
    outer.use('/api/projects/:id/ongoing', router);
    app = outer;
  });

  it('returns 400 when phase_id is missing', async () => {
    const res = await request(app)
      .post('/api/projects/1/ongoing')
      .send({ reporting_date: '2026-06-09', cost_spent_to_date: 50000, hours_spent_to_date: 400 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('phase_id');
  });

  it('returns 400 when phase_id is null', async () => {
    const res = await request(app)
      .post('/api/projects/1/ongoing')
      .send({ reporting_date: '2026-06-09', cost_spent_to_date: 50000, hours_spent_to_date: 400, phase_id: null });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('phase_id');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE GRAPH routes
// ═══════════════════════════════════════════════════════════════════════════════

describe('Knowledge Graph routes', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./knowledge');
    const outer = express();
    outer.use(express.json());
    outer.use('/api/projects/:id', router);
    app = outer;
  });

  describe('POST /api/projects/:id/decisions', () => {
    it('returns 201 on valid decision', async () => {
      mockQuery.mockResolvedValueOnce(dbOk([{ id: 1 }])); // project check
      mockQuery.mockResolvedValueOnce(dbOk([{
        id: 1, project_id: 1, title: 'Usa microservizi', rationale: 'scalabilità',
        expected_consequence: null, phase_id: null, decided_at: new Date().toISOString(), created_at: new Date().toISOString()
      }])); // INSERT
      const res = await request(app).post('/api/projects/1/decisions').send({ title: 'Usa microservizi', rationale: 'scalabilità' });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Usa microservizi');
    });

    it('returns 400 when title is missing', async () => {
      const res = await request(app).post('/api/projects/1/decisions').send({ rationale: 'test' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('title');
    });

    it('returns 404 when project not found', async () => {
      mockQuery.mockResolvedValueOnce(dbOk([], 0)); // project check → not found
      const res = await request(app).post('/api/projects/999/decisions').send({ title: 'Test' });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/projects/:id/slippage', () => {
    it('returns 201 with expected=false and cause', async () => {
      mockQuery.mockResolvedValueOnce(dbOk([{ id: 1 }]));
      mockQuery.mockResolvedValueOnce(dbOk([{ id: 1, project_id: 1, expected: false, cause: 'Scope creep', phase_id: null }]));
      const res = await request(app).post('/api/projects/1/slippage').send({ expected: false, cause: 'Scope creep' });
      expect(res.status).toBe(201);
      expect(res.body.expected).toBe(false);
    });

    it('returns 400 when expected is missing', async () => {
      const res = await request(app).post('/api/projects/1/slippage').send({ cause: 'Test' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('expected');
    });
  });

  describe('POST /api/projects/:id/retrospectives', () => {
    it('returns 201 with valid answer', async () => {
      mockQuery.mockResolvedValueOnce(dbOk([{ id: 1 }]));
      mockQuery.mockResolvedValueOnce(dbOk([{ id: 1, project_id: 1, question: 'Cosa è andato bene?', answer: 'Team collaborativo', phase_id: null }]));
      const res = await request(app).post('/api/projects/1/retrospectives').send({ question: 'Cosa è andato bene?', answer: 'Team collaborativo' });
      expect(res.status).toBe(201);
      expect(res.body.answer).toBe('Team collaborativo');
    });

    it('returns 400 when answer is missing', async () => {
      const res = await request(app).post('/api/projects/1/retrospectives').send({ question: 'Test' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('answer');
    });
  });

  describe('PATCH /api/projects/:id (scoping)', () => {
    it('updates description and tags', async () => {
      mockQuery.mockResolvedValueOnce(dbOk([{ id: 1, name: 'RXI', description: 'Piattaforma', tags: ['microservizi'] }]));
      const res = await request(app).patch('/api/projects/1').send({ description: 'Piattaforma', tags: ['microservizi'] });
      expect(res.status).toBe(200);
      expect(res.body.description).toBe('Piattaforma');
    });

    it('returns 400 when no fields provided', async () => {
      const res = await request(app).patch('/api/projects/1').send({});
      expect(res.status).toBe(400);
    });

    it('returns 404 when project not found', async () => {
      mockQuery.mockResolvedValueOnce(dbOk([], 0));
      const res = await request(app).patch('/api/projects/999').send({ description: 'Test' });
      expect(res.status).toBe(404);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/projects/similar
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/projects/similar', () => {
  let app: express.Express;
  beforeAll(async () => {
    const { default: router } = await import('./projects');
    app = makeApp(router, '/api/projects');
  });

  it('returns empty array when no tags provided', async () => {
    const res = await request(app).get('/api/projects/similar');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns projects ordered by matching_tag_count DESC', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([
      { id: 2, name: 'Alpha', status: 'closed', tags: ['microservizi', 'react'], description: null, matching_tag_count: 2 },
      { id: 3, name: 'Beta',  status: 'active', tags: ['microservizi'],         description: null, matching_tag_count: 1 },
    ]));
    const res = await request(app).get('/api/projects/similar?tags[]=microservizi&tags[]=react&exclude_id=1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].matching_tag_count).toBeGreaterThanOrEqual(res.body[1].matching_tag_count);
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain('?|');
  });
});
