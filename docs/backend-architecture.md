# Backend Architecture

Comprehensive guide to the Project Forecast App backend — Express routes, services layer, database access patterns, and test setup.

## Table of Contents

1. [Overview](#overview)
2. [Layered Architecture](#layered-architecture)
3. [Database Access](#database-access)
4. [Express Routes](#express-routes)
5. [Services Layer](#services-layer)
6. [Authentication & Middleware](#authentication--middleware)
7. [Testing Strategy](#testing-strategy)
8. [Patterns & Conventions](#patterns--conventions)
9. [Error Handling](#error-handling)
10. [Common Workflows](#common-workflows)

---

## Overview

The backend is a Node.js + Express application that:
- Exposes RESTful APIs for frontend consumption
- Implements core business logic (budget calculation, FTE allocation, forecasting)
- Manages PostgreSQL database access via pg pool
- Enforces authentication via Supabase and Bearer tokens
- Supports transactions for multi-step operations

**Core files:**
- `backend/src/index.ts` — Express app, route registration, middleware
- `backend/src/db/` — Database pool, transaction helper, Supabase client
- `backend/src/routes/` — Domain-specific API endpoints
- `backend/src/services/` — Pure business logic
- `backend/src/middleware/` — Authentication and authorization

---

## Layered Architecture

```
HTTP Request
    ↓
Express Router (routes/*.ts)
    ├─ Parse request (params, body, headers)
    ├─ Call service methods or query DB
    └─ Return JSON response
    ↓
Services (services/*.ts)
    ├─ Pure functions (no side effects)
    ├─ Accept query function as parameter (DI)
    └─ Return computed results
    ↓
Database Layer (db/index.ts)
    ├─ pg Pool for connection management
    ├─ query() wrapper for single statements
    └─ withTransaction() wrapper for multi-step operations
    ↓
PostgreSQL
```

### Why This Separation?

1. **Routes** — HTTP concerns only (request parsing, response formatting)
2. **Services** — Business logic (computation, validation, aggregation)
3. **Database** — SQL execution and transaction coordination

This separation makes services **unit-testable** without a real database (inject mock query function), while routes can be **integration-tested** with mocked DB.

---

## Database Access

### Pool Management (`backend/src/db/index.ts`)

```typescript
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/project_forecast',
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export type QueryFn = typeof query;

export async function withTransaction<T>(fn: (q: QueryFn) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  await client.query('BEGIN');
  try {
    const result = await fn(client.query.bind(client) as QueryFn);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

**Usage:**

```typescript
// Single query
const result = await query('SELECT * FROM "Project" WHERE id = $1', [projectId]);

// Multi-step transaction
await withTransaction(async (q) => {
  await q('UPDATE "AllocationEntry" SET fte = $1 WHERE id = $2', [newFte, entryId]);
  await q('INSERT INTO "AuditLog" ... VALUES ...');
});
```

**Key points:**
- `query()` is parameterized to prevent SQL injection
- `QueryFn` type enables dependency injection in services
- `withTransaction()` handles connection management, BEGIN/COMMIT/ROLLBACK
- Client is released to pool in finally block

### Query Patterns

**SELECT with JOIN:**
```typescript
const result = await query(`
  SELECT ae.id, ae.fte, r.name, r.day_rate, ae.weekly_cost
  FROM "AllocationEntry" ae
  JOIN "Resource" r ON r.id = ae.resource_id
  WHERE ae.project_id = $1
  ORDER BY ae.week_start
`, [projectId]);
```

**INSERT with RETURNING:**
```typescript
const result = await query(`
  INSERT INTO "AllocationEntry" (project_id, phase_id, resource_id, week_start, fte, weekly_cost)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING id, fte, weekly_cost
`, [projectId, phaseId, resourceId, weekStart, fte, weeklyCoast]);
const newEntry = result.rows[0];
```

**UPDATE with CTE (Common Table Expression):**
```typescript
const result = await query(`
  WITH updated AS (
    UPDATE "ProjectPhase"
    SET working_days = $1, planned_hours = $2
    WHERE id = $3
    RETURNING id, working_days, planned_hours
  )
  SELECT * FROM updated
`, [workingDays, plannedHours, phaseId]);
```

**Aggregation (used by AllocationAggregator):**
```typescript
const result = await query(`
  SELECT COALESCE(SUM(fte), 0)::numeric AS total
  FROM "AllocationEntry"
  WHERE resource_id = $1 AND week_start = $2
`, [resourceId, weekStart]);
const total = parseFloat(result.rows[0].total);
```

---

## Express Routes

### Entry Point (`backend/src/index.ts`)

```typescript
import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/requireAuth';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Auth routes (no middleware)
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api/projects', requireAuth, projectsRouter);
app.use('/api/resources', requireAuth, resourcesRouter);
app.use('/api/projects/:id/dashboard', requireAuth, dashboardRouter);
app.use('/api/projects/:id/allocation', requireAuth, allocationsRouter);
// ... other routes

app.listen(port, () => console.log(`Server on port ${port}`));
```

**Key observations:**
- `express.json()` middleware parses request bodies
- `cors()` allows cross-origin requests
- Auth routes skip `requireAuth` middleware
- Protected routes use `requireAuth` middleware to validate Bearer token

### Route File Structure

Each route file follows a consistent pattern:

```typescript
import { Router } from 'express';
import { query, withTransaction } from '../db';
import type { QueryFn } from '../db';
import { someService } from '../services/someService';

const router = Router({ mergeParams: true });

// GET
router.get('/', async (req, res) => {
  const projectId = (req.params as { id: string }).id;
  try {
    const result = await query('SELECT * FROM "Project" WHERE id = $1', [projectId]);
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST
router.post('/', async (req, res) => {
  const { name, status } = req.body;
  if (!name || !status) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await query(
      'INSERT INTO "Project" (name, status) VALUES ($1, $2) RETURNING *',
      [name, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT
router.put('/:pid', async (req, res) => {
  const { pid } = req.params;
  const { status } = req.body;
  try {
    const result = await query(
      'UPDATE "Project" SET status = $1 WHERE id = $2 RETURNING *',
      [status, pid]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH
router.patch('/:pid/status', async (req, res) => {
  const { pid } = req.params;
  const { status } = req.body;
  try {
    await withTransaction(async (q) => {
      // Multi-step operation
      await q('UPDATE "Project" SET status = $1 WHERE id = $2', [status, pid]);
      await q('INSERT INTO "AuditLog" (project_id, action) VALUES ($1, $2)', [pid, 'status_change']);
    });
    res.json({ message: 'Status updated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:pid', async (req, res) => {
  const { pid } = req.params;
  try {
    const result = await query('DELETE FROM "Project" WHERE id = $1 RETURNING id', [pid]);
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Deleted', id: result.rows[0].id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

### Key Routes

#### Authentication (`routes/auth.ts`)

```
POST /api/auth/login
  Body: { email, password }
  Returns: { token, user: { id, role, email, name } }

POST /api/auth/logout
  Returns: { message: 'Logged out' }
```

#### Projects (`routes/projects.ts`)

```
GET /api/projects
  Returns: [ { id, name, status, rag_status, budget_total, budget_spent, ... } ]

GET /api/projects/:id
  Returns: { id, name, status, pm_id, keyedin_code, ... }

POST /api/projects
  Body: { name, status, pm_id, currency, keyedin_code? }
  Returns: { id, name, ... }

PATCH /api/projects/:id/status
  Body: { status }
  Returns: { message: 'Status updated' }
```

#### Allocations (`routes/allocations.ts`)

```
GET /api/projects/:id/allocation
  Returns: {
    projectName,
    phases: [ { phase_id, display_name, budget, allocations: [...] } ],
    registry: { weeks, rows: [ { resource, allocations, totals } ] }
  }

POST /api/projects/:id/allocation
  Body: { phase_id, resource_id, week_start, fte }
  Returns: { id, fte, weekly_cost, project_budget_used_pct }

PUT /api/projects/:id/allocation/:aid
  Body: { fte }
  Returns: { id, fte, weekly_cost }
  Note: Enforces FTE cap (canAllocate check)

DELETE /api/projects/:id/allocation/:aid
  Returns: { message: 'Deleted' }
```

#### Dashboard (`routes/dashboard.ts`)

```
GET /api/projects/:id/dashboard
  Returns: {
    phases: [ { phase_id, display_name, budget, cost_spent, pct_complete, ... } ],
    kpis: { cost_spent, budget_total, revised_forecast, rag_status, variance, ... },
    milestones: [ { id, name, planned_date, actual_date, status } ],
    rollup: { total_budget, total_revised_forecast, rag_status, total_variance, ... }
  }
```

#### Baseline (`routes/baseline.ts`)

```
GET /api/projects/:id/baseline
  Returns: { baseline_id, locked_at, total_budget_at_lock, phase_snapshot_at_lock }

POST /api/projects/:id/baseline/lock
  Body: {}
  Returns: { baseline_id, locked_at, total_budget_at_lock }
```

#### Resources (`routes/resources.ts`)

```
GET /api/resources
  Returns: [ { id, name, role, day_rate } ]

POST /api/resources
  Body: { name, role, day_rate }
  Returns: { id, name, role, day_rate }

PUT /api/resources/:rid
  Body: { day_rate }
  Returns: { id, day_rate }
```

#### Ongoing (`routes/ongoing.ts`)

```
GET /api/projects/:id/ongoing
  Returns: { id, cost_spent_to_date, hours_spent_to_date, working_days_used, source, created_at }

POST /api/projects/:id/ongoing/snapshot
  Body: { cost_spent_to_date, hours_spent_to_date, working_days_used, source }
  Returns: { id, ... }

POST /api/projects/:id/ongoing/sync-keyedin
  Returns: { synced_at, new_snapshot: { ... } }
```

#### Gantt (`routes/gantt.ts`)

```
GET /api/projects/:id/gantt
  Returns: [ { id, name, phase_id, start_date, end_date, is_milestone, status } ]

POST /api/projects/:id/gantt
  Body: { name, phase_id, start_date, end_date?, is_milestone, status }
  Returns: { id, ... }

PUT /api/projects/:id/gantt/:tid
  Body: { actual_date?, status }
  Returns: { id, ... }
```

#### Phases (`routes/phases.ts`)

```
GET /api/projects/:id/phases
  Returns: [ { id, phase_type, display_name, planned_start, planned_end, working_days, status } ]

PUT /api/projects/:id/phases/:pid
  Body: { planned_start, planned_end, status }
  Returns: { id, working_days, ... }
```

#### Phase Templates (`routes/phaseTemplates.ts`)

```
GET /api/phase-templates
  Returns: [ { id, name, display_name, order, default_contingency_pct, active } ]

PUT /api/phase-templates/:tid
  Body: { display_name, default_contingency_pct, active }
  Returns: { id, ... }
```

---

## Services Layer

Pure functions for business logic, independent of routes.

### computations.ts

**calculateNetworkDays(startDate, endDate, publicHolidays)**
- Counts business days (Mon–Fri) excluding public holidays
- Used for phase working days, burn rate calculation

**validateFTE(allocations, targetWeekStart)**
- Checks if total FTE for a week ≤ 1.0
- Returns validation result with warnings if exceeded

**calculateRevisedForecast(hoursSpent, costSpent, dailyBurnRate, daysRemaining, avgCostPerHour, hoursRemaining)**
- Dual-method forecast: average of time-based and cost-based
- Time-based: `costSpent + (dailyBurnRate × daysRemaining)`
- Cost-based: `costSpent + (avgCostPerHour × hoursRemaining)`

**calculateRAGStatus(forecast, baseline)**
- Returns `IN_LINEA`, `A_RISCHIO`, or `FUORI_BUDGET`
- Thresholds: 1.05× and 1.15× baseline

### allocationAggregator.ts

**getWeeklyTotal(resourceId, weekStart, opts)**
- Returns sum of FTE for (resource, week) across all projects
- Optionally excludes one project (for write-side cap check)
- Pure read operation, no mutations

```typescript
const total = await getWeeklyTotal(resourceId, weekStart);
// 0.8 (80% allocated)

const totalExcludingProject1 = await getWeeklyTotal(resourceId, weekStart, {
  excludeProjectId: 1,
});
// 0.5 (other projects using 50%)
```

**canAllocate(resourceId, weekStart, requestedFte, opts)**
- Decides if `requestedFte` can be committed on (resource, week)
- Returns `AllocationDecision` with details
- Used by `PUT /allocation` to enforce cap (Step D)

```typescript
const decision = await canAllocate(resourceId, weekStart, 0.5);
// {
//   ok: true,
//   current_total: 0.8,
//   requested: 0.5,
//   would_be: 1.3,
//   excess: 0.3,
//   breakdown: [...]
// }
```

**getRegistryAggregate(opts)**
- Returns full allocation registry: all resources, weeks, totals, breakdowns
- Used by allocation matrix UI
- Highlights overallocations

### phaseFinancialEngine.ts

**computeProjectFinancials(projectId, opts)**
- Computes phase-level and project-level financials
- Returns rollup: total_budget, total_revised_forecast, total_variance, rag_status
- Per-phase: budget, cost_spent, hours_spent, revised_forecast, variance, rag_status

```typescript
const rollup = await computeProjectFinancials(projectId);
// {
//   phases: [
//     {
//       phase_id: 1,
//       budget: 50000,
//       revised_forecast: 52000,
//       variance: 2000,
//       rag_status: 'A_RISCHIO',
//       ...
//     }
//   ],
//   total_budget: 150000,
//   total_revised_forecast: 155000,
//   total_variance: 5000,
//   rag_status: 'A_RISCHIO'
// }
```

### Ongoing Providers

**OngoingDataProvider (interface)**
- Abstraction for actuals sources (Keyedin, manual)
- Enables testing without real Keyedin API

**KeyedinApiProvider (stub)**
- Calls Keyedin API to fetch actuals
- Returns: { costSpent, hoursSpent, workingDaysUsed, workingDaysRemaining }

**ManualFallbackProvider**
- Always available for manual entry
- No external dependencies

---

## Authentication & Middleware

### Supabase Integration (`backend/src/db/supabase.ts`)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
```

**Usage in auth.ts:**
```typescript
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
```

**Note:** Supabase is **only** for authentication. All data queries use the pg pool.

### requireAuth Middleware (`backend/src/middleware/requireAuth.ts`)

```typescript
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // In test mode, inject mock auth
  if (process.env.NODE_ENV === 'test') {
    req.auth = { userId: 1, role: 'dm', email: 'test@test.com', supabaseUid: 'test-uid' };
    return next();
  }

  // Extract Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const token = authHeader.slice(7);

  // Validate token with Supabase
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Look up user in DB
  const result = await query(
    'SELECT id, role FROM "User" WHERE supabase_uid = $1',
    [data.user.id]
  );
  if (!result.rowCount) {
    return res.status(403).json({ error: 'User not provisioned' });
  }

  // Attach auth info to request
  req.auth = {
    userId: result.rows[0].id,
    role: result.rows[0].role,
    email: data.user.email ?? '',
    supabaseUid: data.user.id,
  };

  next();
}
```

**Type augmentation** (in `types/express.d.ts` or at route file top):
```typescript
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: number;
        role: string;
        email: string;
        supabaseUid: string;
      };
    }
  }
}
```

### requireRole Middleware

```typescript
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
```

**Usage:**
```typescript
app.use('/api/admin', requireAuth, requireRole('dm'), adminRouter);
```

---

## Testing Strategy

### Unit Tests (services)

Services are tested **without a database** via dependency injection:

```typescript
// services/computations.test.ts
describe('calculateRAGStatus', () => {
  it('returns IN_LINEA when forecast <= 1.05 * baseline', () => {
    const status = calculateRAGStatus(50000, 48000);
    expect(status).toBe('IN_LINEA');
  });

  it('returns A_RISCHIO when forecast > 1.05 * baseline and <= 1.15 * baseline', () => {
    const status = calculateRAGStatus(52000, 48000);
    expect(status).toBe('A_RISCHIO');
  });
});
```

### Service Tests with Query Injection

```typescript
// services/allocationAggregator.test.ts
describe('canAllocate', () => {
  it('returns ok: false when requested FTE exceeds cap', async () => {
    const mockQuery = jest.fn().mockResolvedValueOnce({
      rows: [{ total: 0.8 }],
      rowCount: 1,
    });

    const decision = await canAllocate(1, '2025-01-13', 0.5, { query: mockQuery });
    expect(decision.ok).toBe(false);
    expect(decision.excess).toBe(0.3);
  });
});
```

### Integration Tests (routes)

Routes are tested with Supertest, mocking the database:

```typescript
// routes/routes.test.ts
jest.mock('../db', () => ({
  query: (...args) => mockQuery(...args),
  withTransaction: async (fn) => fn((...args) => mockQuery(...args)),
}));

describe('GET /api/projects', () => {
  it('returns project list', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Project A', status: 'active' }],
      rowCount: 1,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/projects', projectsRouter);

    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
```

### Running Tests

```bash
cd backend

# All tests, in-band (no race conditions)
pnpm test

# Watch mode
pnpm run test:watch

# Single file
pnpm test -- src/services/computations.test.ts
```

**Why in-band?** Tests run sequentially to avoid race conditions on the (mocked) database.

### Consistency Tests

`consistency.test.ts` documents edge cases and expected behavior:

```typescript
describe('RAGStatus floating point near 1.05', () => {
  it('handles IEEE 754 rounding for near-boundary ratios', () => {
    // This test documents the behavior when forecast / baseline
    // rounds to exactly 1.05 due to floating point imprecision
    const status = calculateRAGStatus(52500, 50000); // = 1.05 exactly
    expect(status).toBe('IN_LINEA');
  });
});
```

---

## Patterns & Conventions

### TypeScript Strictness

- `strict: true` in `tsconfig.json`
- No implicit `any` in service methods
- Use explicit types for function parameters and returns

### Naming Conventions

| Category | Example | Notes |
|---|---|---|
| Tables | `"Project"`, `"AllocationEntry"` | PascalCase with double quotes in SQL |
| Columns | `project_id`, `week_start`, `fte` | snake_case |
| Variables | `projectId`, `weekStart`, `fte` | camelCase |
| Functions | `calculateRAGStatus`, `getWeeklyTotal` | camelCase, verb-first |
| Constants | `RAG_THRESHOLD`, `FTE_CAP` | SCREAMING_SNAKE_CASE |
| Env vars | `DATABASE_URL`, `SUPABASE_URL` | SCREAMING_SNAKE_CASE |

### Parameter Order Convention

Functions usually follow this order:
1. Identifiers (id, resourceId, projectId)
2. Main input (fte, forecast, allocation)
3. Context (date, weekStart)
4. Options object `{ excludeProjectId?, query? }`

```typescript
function canAllocate(
  resource_id: number,              // identifier
  week_start: string,               // context
  requested_fte: number,            // main input
  opts: { excludeProjectId?, query? }  // options
) { ... }
```

### Error Types

Define custom error types for domain-specific errors:

```typescript
interface FteCapError extends Error {
  code: 'FTE_CAP';
  resource_id: number;
  week_start: string;
  excess: number;
  breakdown: { project_id: number; project_name: string; fte: number }[];
}

function isFteCapError(err: unknown): err is FteCapError {
  return typeof err === 'object' && err !== null && (err as FteCapError).code === 'FTE_CAP';
}

// Usage in route
try {
  // ... allocation logic
} catch (err) {
  if (isFteCapError(err)) {
    return res.status(409).json({
      error: 'FTE cap exceeded',
      excess: err.excess,
      breakdown: err.breakdown,
    });
  }
  res.status(500).json({ error: err.message });
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | When to Use |
|---|---|---|
| 200 | OK | Successful GET, successful modification returned in body |
| 201 | Created | POST successfully created resource |
| 204 | No Content | DELETE or operation with no response body |
| 400 | Bad Request | Missing/invalid input, malformed body, type mismatch |
| 401 | Unauthorized | Missing token, invalid token, expired token |
| 403 | Forbidden | User not provisioned, insufficient role, no pm_id match |
| 404 | Not Found | Resource doesn't exist (project, phase, allocation, etc.) |
| 409 | Conflict | Business logic violation (FTE cap, duplicate entry, etc.) |
| 500 | Internal Server Error | Unexpected error, database error, service down |

### Response Format

**Success (2xx):**
```json
{
  "id": 1,
  "name": "Project A",
  "status": "active"
}
```

**Error (4xx/5xx):**
```json
{
  "error": "FTE cap exceeded",
  "excess": 0.3,
  "breakdown": [
    { "project_id": 1, "project_name": "Project A", "fte": 0.8 }
  ]
}
```

### Try/Catch Pattern

Standard wrapper for all route handlers:

```typescript
router.get('/:id', async (req, res) => {
  try {
    // 1. Validate input
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    // 2. Query/compute
    const result = await query('SELECT * FROM "Project" WHERE id = $1', [id]);

    // 3. Check not found
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // 4. Return
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## Common Workflows

### Adding a New Route

1. **Create the route file** (`routes/myFeature.ts`):

```typescript
import { Router } from 'express';
import { query, withTransaction } from '../db';
import type { QueryFn } from '../db';

const router = Router({ mergeParams: true });

router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM "MyTable"');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

2. **Mount in `index.ts`**:

```typescript
import myFeatureRouter from './routes/myFeature';
app.use('/api/my-feature', requireAuth, myFeatureRouter);
```

3. **Add types to `frontend/src/types/index.ts`** (if frontend-facing)

4. **Create API module** (`frontend/src/api/myFeature.ts`):

```typescript
import { apiClient } from './client';

export async function getMyFeatures() {
  return apiClient('/my-feature');
}

export async function createMyFeature(data: any) {
  return apiClient('/my-feature', { method: 'POST', body: JSON.stringify(data) });
}
```

5. **Update tests** (`routes/routes.test.ts` and `services/*.test.ts`)

### Adding a Business Logic Function

1. **Add to service** (`services/myLogic.ts`):

```typescript
export async function computeSomething(
  projectId: number,
  opts: { query?: QueryFn } = {}
): Promise<number> {
  const q = opts.query ?? defaultQuery;
  const result = await q('SELECT ...');
  return result.rows[0].computed_value;
}
```

2. **Add unit test** (`services/myLogic.test.ts`):

```typescript
describe('computeSomething', () => {
  it('returns correct value', async () => {
    const mockQuery = jest.fn().mockResolvedValueOnce({
      rows: [{ computed_value: 100 }],
      rowCount: 1,
    });

    const result = await computeSomething(1, { query: mockQuery });
    expect(result).toBe(100);
  });
});
```

3. **Use in route** (`routes/myFeature.ts`):

```typescript
import { computeSomething } from '../services/myLogic';

router.get('/:id', async (req, res) => {
  try {
    const value = await computeSomething(parseInt(req.params.id));
    res.json({ value });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

### Using Transactions

```typescript
router.post('/multi-step', async (req, res) => {
  try {
    await withTransaction(async (q) => {
      // Step 1
      const proj = await q('INSERT INTO "Project" ... RETURNING id', [...]);
      const projectId = proj.rows[0].id;

      // Step 2
      await q('INSERT INTO "ProjectPhase" (project_id, ...) VALUES ($1, ...) RETURNING id', [projectId, ...]);

      // Step 3 — if any step fails, all rollback
      await q('INSERT INTO "AuditLog" ... VALUES ...', [...]);
    });
    res.json({ message: 'Success' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## Summary

The backend architecture emphasizes:
- **Separation of concerns** — routes, services, database layers
- **Testability** — pure functions with dependency injection
- **Single source of truth** — one place per domain (allocation aggregator, phase engine)
- **Type safety** — strict TypeScript, explicit types
- **Error clarity** — specific HTTP codes, detailed error messages
- **Transactions** — multi-step operations with rollback guarantee

This design scales from POC to production with minimal refactoring.
