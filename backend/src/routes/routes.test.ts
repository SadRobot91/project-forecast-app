/**
 * Route-level unit tests — all DB calls are mocked so no real DB is needed.
 * Tests verify: correct SQL field names, response shape, error handling.
 */

// ── Mock the DB module ────────────────────────────────────────────────────────
const mockQuery = jest.fn();
jest.mock('../db', () => ({ query: (...args: any[]) => mockQuery(...args) }));

// ── Mock computations (only where routes use them) ────────────────────────────
jest.mock('../services/computations', () => ({
  calculateNetworkDays: jest.fn(() => 5),
  validateFTE: jest.fn(() => ({ isValid: true, warnings: [] })),
  calculateRevisedForecast: jest.fn(() => 64600),
  calculateRAGStatus: jest.fn(() => 'IN_LINEA'),
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

beforeEach(() => mockQuery.mockReset());

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
    mockQuery.mockResolvedValue(dbOk([])); // BEGIN, DELETE, COMMIT
    // phase query for working days
    mockQuery.mockResolvedValueOnce(dbOk([])); // BEGIN
    mockQuery.mockResolvedValueOnce(dbOk([])); // DELETE
    mockQuery.mockResolvedValueOnce(dbOk([{ planned_start: new Date('2026-03-02'), planned_end: new Date('2026-06-19') }])); // phase
    mockQuery.mockResolvedValueOnce(dbOk([{ day_rate: '600' }])); // resource day_rate
    mockQuery.mockResolvedValueOnce(dbOk([{ id: 1, resource_id: 2, project_id: 1, phase_id: 1, week_start: '2026-03-02', fte: 0.8, working_days: 5, weekly_cost: 2400 }])); // INSERT RETURNING
    mockQuery.mockResolvedValueOnce(dbOk([])); // COMMIT

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

  it('returns weeks array (not months) and project_status in allocations', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([
      { resource_id: 1, resource_name: 'Giuseppe', role: 'PM', day_rate: '680',
        project_id: 1, project_name: 'RXI Platform', project_status: 'active',
        week_start: '2026-03-02', fte: '0.3' },
    ]));

    const res = await request(app).get('/api/resources/registry');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('weeks');
    expect(res.body).not.toHaveProperty('months');
    expect(res.body.rows[0].allocations[0]).toHaveProperty('week_start', '2026-03-02');
    expect(res.body.rows[0].allocations[0]).toHaveProperty('project_status', 'active');
    expect(res.body.rows[0].allocations[0]).not.toHaveProperty('month');
  });

  it('detects overallocation across projects', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([
      { resource_id: 2, resource_name: 'Vishal', role: 'Dev', day_rate: '600',
        project_id: 1, project_name: 'RXI', project_status: 'active', week_start: '2026-06-01', fte: '0.8' },
      { resource_id: 2, resource_name: 'Vishal', role: 'Dev', day_rate: '600',
        project_id: 2, project_name: 'PChal', project_status: 'active', week_start: '2026-06-01', fte: '0.5' },
    ]));

    const res = await request(app).get('/api/resources/registry');
    expect(res.status).toBe(200);
    expect(res.body.has_overallocation).toBe(true);
    expect(res.body.rows[0].totals['2026-06-01']).toBeCloseTo(1.3, 1);
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

  it('returns baseline with weekly_cost-based budget (not monthly)', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([{ name: 'RXI Platform' }]));       // project
    mockQuery.mockResolvedValueOnce(dbOk([{ locked_at: null }]));              // baseline row
    mockQuery.mockResolvedValueOnce(dbOk([                                     // phases with SUM(weekly_cost)
      { phase_id: 1, phase_type: 'feasibility', display_name: 'Feasibility', order: 1,
        planned_start: new Date('2026-01-05'), planned_end: new Date('2026-01-20'),
        working_days: 12, planned_hours: 96, status: 'completed', budget: '4080', contingency_pct: '10' },
    ]));

    const res = await request(app).get('/api/projects/1/baseline');
    expect(res.status).toBe(200);
    expect(res.body.phases[0].budget).toBe(4080);
    expect(res.body.is_locked).toBe(false);
    expect(res.body.phases[0].contingency_pct).toBe(10);

    // The SQL must reference weekly_cost, not monthly_cost
    const phaseQuery: string = mockQuery.mock.calls[2][0];
    expect(phaseQuery).toContain('weekly_cost');
    expect(phaseQuery).not.toContain('monthly_cost');
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

  it('locks baseline and returns locked_at', async () => {
    const now = new Date().toISOString();
    mockQuery.mockResolvedValueOnce(dbOk([{ locked_at: null }]));    // existing check
    mockQuery.mockResolvedValueOnce(dbOk([]));                        // INSERT/UPDATE
    mockQuery.mockResolvedValueOnce(dbOk([{ locked_at: now }]));     // SELECT locked_at

    const res = await request(app).post('/api/projects/1/baseline/lock');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('locked_at');
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

  it('validates FTE for a given week_start', async () => {
    mockQuery.mockResolvedValueOnce(dbOk([
      { project_id: 1, week_start: '2026-06-01', fte: '0.8' },
      { project_id: 2, week_start: '2026-06-01', fte: '0.5' },
    ]));

    const { validateFTE } = require('../services/computations');
    (validateFTE as jest.Mock).mockReturnValueOnce({
      isValid: false,
      warnings: [{ projectId: 1, week_start: '2026-06-01', excess: 0.3 }],
    });

    const res = await request(app).get('/api/projects/1/allocation/warnings?resource_id=2&week_start=2026-06-01');
    expect(res.status).toBe(200);
    expect(res.body.isValid).toBe(false);
    expect(res.body.warnings[0]).toHaveProperty('week_start', '2026-06-01');
    expect(res.body.warnings[0]).not.toHaveProperty('month');
  });
});
