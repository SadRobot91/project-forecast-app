# API Design & Patterns

This document describes the architectural patterns, conventions, and best practices for building API routes and services in the Project Forecast App.

---

## Layered Architecture

All request handling follows this three-layer pattern:

```
┌──────────────────────────────────────────────────────┐
│ Layer 1: Routes (routes/*.ts)                        │
│  • Express Router with HTTP semantics                │
│  • Input validation (body, params, query)            │
│  • Error handling (try/catch, status codes)          │
│  • Delegates to services                             │
└───────────────────┬──────────────────────────────────┘
                    │
┌───────────────────▼──────────────────────────────────┐
│ Layer 2: Services (services/*.ts)                    │
│  • Pure business logic (no side effects)             │
│  • Testable without database                         │
│  • Dependency injection (query function param)       │
│  • Reusable across routes                            │
└───────────────────┬──────────────────────────────────┘
                    │
┌───────────────────▼──────────────────────────────────┐
│ Layer 3: Database (db/index.ts, db/supabase.ts)      │
│  • pg Pool for PostgreSQL queries                    │
│  • Transaction wrapper with advisory locks           │
│  • Supabase Auth client (login only)                 │
│  • No application logic                              │
└──────────────────────────────────────────────────────┘
```

---

## Route Pattern

### Basic Route Structure

**File:** `backend/src/routes/example.ts`

```typescript
import { Router } from 'express';
import { query } from '../db/index';

const router = Router({ mergeParams: true });

/**
 * GET /api/projects/:id/example
 * Retrieve example resource for a project.
 */
router.get('/', async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { userId } = req.auth;

    // Validation
    if (!projectId) {
      return res.status(400).json({ error: 'Missing project ID' });
    }

    // Query (with pm_id filtering for PM ownership)
    const result = await query(
      `SELECT * FROM "Project" WHERE id = $1 AND pm_id = $2`,
      [projectId, userId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error fetching project:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/projects/:id/example/:exampleId
 * Update an example resource with transaction support.
 */
router.put('/:exampleId', async (req, res) => {
  try {
    const { id: projectId, exampleId } = req.params;
    const { userId } = req.auth;
    const { name, status } = req.body;

    // Validation
    if (!name || !status) {
      return res.status(400).json({ error: 'Missing required fields: name, status' });
    }

    // Ownership check
    const projectRes = await query(
      `SELECT id FROM "Project" WHERE id = $1 AND pm_id = $2`,
      [projectId, userId]
    );
    if (!projectRes.rowCount) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update with transaction
    const result = await query(
      `UPDATE "Example"
       SET name = $1, status = $2, updated_at = NOW()
       WHERE id = $3 AND project_id = $4
       RETURNING *`,
      [name, status, exampleId, projectId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Example not found' });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error updating example:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/projects/:id/example
 * Create a new example resource.
 */
router.post('/', async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { userId } = req.auth;
    const { name, status } = req.body;

    // Validation
    if (!name || !status) {
      return res.status(400).json({ error: 'Missing required fields: name, status' });
    }

    // Create
    const result = await query(
      `INSERT INTO "Example" (project_id, name, status, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [projectId, name, status, userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Error creating example:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/projects/:id/example/:exampleId
 * Delete an example resource.
 */
router.delete('/:exampleId', async (req, res) => {
  try {
    const { id: projectId, exampleId } = req.params;

    const result = await query(
      `DELETE FROM "Example"
       WHERE id = $1 AND project_id = $2
       RETURNING id`,
      [exampleId, projectId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Example not found' });
    }

    res.status(204).send();
  } catch (err: any) {
    console.error('Error deleting example:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

### Mounting Routes

**File:** `backend/src/index.ts`

```typescript
import exampleRouter from './routes/example';

app.use('/api/projects/:id/example', requireAuth, exampleRouter);
```

---

## HTTP Status Codes

```
200 OK              — Request succeeded, data returned
201 Created         — Resource created successfully
204 No Content      — Request succeeded, no body (DELETE)
400 Bad Request     — Missing or invalid input (validation error)
401 Unauthorized    — Missing or invalid token
403 Forbidden       — User not authorized (pm_id mismatch, insufficient role)
404 Not Found       — Resource does not exist
409 Conflict        — Business rule violation (FTE cap, duplicate entry)
500 Internal Error  — Unexpected server error
503 Unavailable     — Service down (Supabase, database)
```

### Examples

```typescript
// 400 — Invalid input
if (!email || !email.includes('@')) {
  return res.status(400).json({ error: 'Invalid email format' });
}

// 401 — Missing token (handled by requireAuth middleware)
// 403 — Not authorized for this resource
if (project.pm_id !== userId) {
  return res.status(403).json({ error: 'Not authorized' });
}

// 404 — Resource not found
if (!projectRes.rowCount) {
  return res.status(404).json({ error: 'Project not found' });
}

// 409 — Business rule violation
if (fte > 1.0) {
  return res.status(409).json({
    error: 'FTE allocation exceeds 1.0',
    allocated: 0.8,
    requested: 0.4,
    total: 1.2,
  });
}

// 500 — Unexpected error
catch (err: any) {
  res.status(500).json({ error: err.message });
}
```

---

## Service Pattern

Services contain pure business logic, separated from HTTP concerns.

### Basic Service

**File:** `backend/src/services/example.ts`

```typescript
import { QueryFn } from '../db/index';

/**
 * Calculate example metric.
 * Pure function — no database access.
 * @param input Raw data
 * @returns Computed result
 */
export function computeMetric(input: { value: number; factor: number }): number {
  return input.value * input.factor;
}

/**
 * Get aggregated data for a project.
 * Requires injected query function for testability.
 * @param projectId
 * @param query Database query function
 * @returns Aggregated result
 */
export async function getAggregateData(
  projectId: number,
  query: QueryFn
): Promise<{ total: number; average: number }> {
  const result = await query(
    `SELECT SUM(amount) as total, AVG(amount) as average
     FROM "ExampleData"
     WHERE project_id = $1`,
    [projectId]
  );

  return result.rows[0] || { total: 0, average: 0 };
}
```

### Using Services in Routes

```typescript
import { computeMetric, getAggregateData } from '../services/example';

router.get('/', async (req, res) => {
  try {
    const { id: projectId } = req.params;

    // Call service with injected query function
    const aggregate = await getAggregateData(projectId, query);

    // Call pure function
    const metric = computeMetric({
      value: aggregate.total,
      factor: 1.5,
    });

    res.json({ metric, aggregate });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

### Testing Services

```typescript
import { computeMetric, getAggregateData } from '../services/example';
import { makeStubQuery } from '../db/test-helpers';

describe('computeMetric', () => {
  it('should calculate correctly', () => {
    const result = computeMetric({ value: 10, factor: 2 });
    expect(result).toBe(20);
  });
});

describe('getAggregateData', () => {
  it('should return aggregated data', async () => {
    const stubQuery = makeStubQuery({
      rows: [{ total: 100, average: 50 }],
      rowCount: 1,
    });

    const result = await getAggregateData(1, stubQuery);
    expect(result.total).toBe(100);
  });
});
```

---

## Database Query Pattern

### Query Helper

**File:** `backend/src/db/index.ts`

```typescript
import { Pool, QueryResult } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export type QueryFn = (sql: string, params?: any[]) => Promise<QueryResult>;

/**
 * Execute a query against the database.
 * @param sql SQL string with $1, $2, etc. placeholders
 * @param params Parameter array for parameterized query
 * @returns QueryResult with rows and rowCount
 */
export async function query(sql: string, params?: any[]): Promise<QueryResult> {
  try {
    return await pool.query(sql, params);
  } catch (err: any) {
    console.error('Database error:', err.message);
    throw err;
  }
}

/**
 * Execute a function within a transaction.
 * All queries are rolled back if the function throws.
 * @param callback Function to execute within transaction
 * @returns Result of callback
 */
export async function withTransaction<T>(
  callback: (txQuery: QueryFn) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback((sql, params) => client.query(sql, params));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get an advisory lock for row-level locking.
 * Used to prevent race conditions on concurrent writes.
 * @param lockKey Numeric identifier for the lock
 */
export async function acquireAdvisoryLock(lockKey: number, txQuery: QueryFn) {
  await txQuery('SELECT pg_advisory_xact_lock($1)', [lockKey]);
}
```

### Parameterized Queries

**Always use parameterized queries to prevent SQL injection:**

```typescript
// ✗ WRONG — vulnerable to SQL injection
const query = `SELECT * FROM "User" WHERE email = '${email}'`;

// ✓ RIGHT — safe parameterized query
const result = await query(
  'SELECT * FROM "User" WHERE email = $1',
  [email]
);
```

### Transaction Pattern

Used for operations that require atomicity (multiple inserts, concurrent writes).

```typescript
await withTransaction(async (txQuery) => {
  // All queries here are atomic
  
  // Lock for row-level safety
  await acquireAdvisoryLock(projectId, txQuery);

  // Update allocation
  await txQuery(
    `UPDATE "AllocationEntry" SET fte = $1 WHERE id = $2`,
    [0.5, allocationId]
  );

  // Insert log entry
  await txQuery(
    `INSERT INTO "AuditLog" (project_id, action) VALUES ($1, $2)`,
    [projectId, 'allocation_updated']
  );

  // If any query throws, entire transaction rolls back
});
```

---

## Error Handling Convention

### Consistent Error Responses

```typescript
// Input validation error
res.status(400).json({
  error: 'Invalid input',
  field: 'email',
  message: 'Email is required',
});

// Authorization error
res.status(403).json({
  error: 'Not authorized',
  reason: 'Project not owned by user',
});

// Business rule violation
res.status(409).json({
  error: 'FTE allocation exceeds 1.0',
  current: 0.8,
  requested: 0.4,
  capacity: 1.0,
});

// Server error
res.status(500).json({
  error: 'Internal server error',
  message: err.message, // Only in dev; omit in prod
});
```

### Error Logging

```typescript
catch (err: any) {
  // Log full error for debugging
  console.error('Error in PUT /allocation:', {
    projectId: req.params.id,
    userId: req.auth.userId,
    error: err.message,
    stack: err.stack,
  });

  // Return safe error to client
  res.status(500).json({
    error: 'Internal server error',
    // Don't expose stack trace or sensitive details in prod
  });
}
```

---

## Request/Response Patterns

### GET (List)

```typescript
// Endpoint
GET /api/projects?page=1&limit=10&status=active

// Handler
router.get('/', async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  
  let sql = 'SELECT * FROM "Project" WHERE pm_id = $1';
  const params = [userId];
  
  if (status) {
    sql += ' AND status = $' + (params.length + 1);
    params.push(status);
  }
  
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);
  
  const result = await query(sql, params);
  res.json({ data: result.rows, count: result.rowCount });
});
```

### GET (Single)

```typescript
// Endpoint
GET /api/projects/:id

// Handler
router.get('/', async (req, res) => {
  const { id } = req.params;
  const result = await query(
    'SELECT * FROM "Project" WHERE id = $1 AND pm_id = $2',
    [id, userId]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});
```

### POST (Create)

```typescript
// Endpoint
POST /api/projects
Content-Type: application/json

{
  "name": "New Project",
  "budget": 100000
}

// Handler
router.post('/', async (req, res) => {
  const { name, budget } = req.body;
  
  if (!name || !budget) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const result = await query(
    `INSERT INTO "Project" (name, budget, pm_id, created_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING *`,
    [name, budget, userId]
  );
  
  res.status(201).json(result.rows[0]);
});
```

### PUT (Update)

```typescript
// Endpoint
PUT /api/projects/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "budget": 120000
}

// Handler
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, budget } = req.body;
  
  const result = await query(
    `UPDATE "Project"
     SET name = COALESCE($1, name), budget = COALESCE($2, budget), updated_at = NOW()
     WHERE id = $3 AND pm_id = $4
     RETURNING *`,
    [name || null, budget || null, id, userId]
  );
  
  if (!result.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});
```

### DELETE

```typescript
// Endpoint
DELETE /api/projects/:id

// Handler
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  const result = await query(
    'DELETE FROM "Project" WHERE id = $1 AND pm_id = $2 RETURNING id',
    [id, userId]
  );
  
  if (!result.rowCount) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});
```

---

## Input Validation Pattern

### Centralized Validation

**File:** `backend/src/utils/validation.ts`

```typescript
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateFTE(fte: number): boolean {
  return fte >= 0 && fte <= 1.0;
}

export function validateProjectName(name: string): boolean {
  return name && name.length > 0 && name.length <= 100;
}
```

### Using Validators

```typescript
import { validateEmail, validateFTE } from '../utils/validation';

router.post('/', async (req, res) => {
  const { email, fte } = req.body;

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (!validateFTE(fte)) {
    return res.status(400).json({ error: 'FTE must be between 0 and 1.0' });
  }

  // Proceed...
});
```

---

## Pagination Pattern

```typescript
router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 10);
  const offset = (page - 1) * limit;

  const totalRes = await query('SELECT COUNT(*) as count FROM "Project" WHERE pm_id = $1', [userId]);
  const dataRes = await query(
    'SELECT * FROM "Project" WHERE pm_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [userId, limit, offset]
  );

  res.json({
    data: dataRes.rows,
    pagination: {
      page,
      limit,
      total: totalRes.rows[0].count,
      pages: Math.ceil(totalRes.rows[0].count / limit),
    },
  });
});
```

---

## Filtering Pattern

```typescript
router.get('/', async (req, res) => {
  const { status, phase_id, resource_id } = req.query;
  
  let sql = 'SELECT * FROM "AllocationEntry" WHERE project_id = $1';
  const params = [projectId];
  
  if (status) {
    sql += ` AND status = $${params.length + 1}`;
    params.push(status);
  }
  
  if (phase_id) {
    sql += ` AND phase_id = $${params.length + 1}`;
    params.push(phase_id);
  }
  
  if (resource_id) {
    sql += ` AND resource_id = $${params.length + 1}`;
    params.push(resource_id);
  }
  
  const result = await query(sql, params);
  res.json(result.rows);
});
```

---

## Authorization Pattern

### pm_id Filtering

Ensures a PM only sees their own projects:

```typescript
// Get project with ownership check
const result = await query(
  'SELECT * FROM "Project" WHERE id = $1 AND pm_id = $2',
  [projectId, userId]
);

if (!result.rowCount) {
  return res.status(403).json({ error: 'Not authorized' });
}
```

### Role-Based Access

```typescript
import { requireRole } from '../middleware/requireAuth';

// DMs only
app.use('/api/dm/portfolio', requireAuth, requireRole('dm'), dmRouter);

// PMs and DMs
app.use('/api/projects', requireAuth, projectsRouter);
```

---

## Response Format Convention

All responses follow this structure:

```typescript
// Success (GET, PUT)
res.json(data)
// {
//   id: 1,
//   name: "Project A",
//   ...
// }

// Success (POST)
res.status(201).json(data)

// Success (DELETE)
res.status(204).send()

// Error
res.status(code).json({ error: 'message', ...details })
// {
//   error: "FTE allocation exceeds 1.0",
//   allocated: 0.8,
//   requested: 0.4
// }

// List
res.json({ data: [...], pagination: { page, limit, total } })
```

---

## Testing APIs

### Unit Test Example

```typescript
describe('POST /api/projects', () => {
  it('should create a project', async () => {
    const response = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Project',
        budget: 100000,
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('New Project');
  });

  it('should reject invalid input', async () => {
    const response = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ budget: 100000 }); // missing name

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });
});
```

