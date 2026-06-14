# Code Conventions & Development Guidelines

Consistency guidelines for Project Forecast App development. Follow these patterns to maintain code quality and readability across the monorepo.

---

## Table of Contents

1. [TypeScript & Naming](#typescript--naming)
2. [File Organization](#file-organization)
3. [API Design](#api-design)
4. [Error Handling](#error-handling)
5. [Testing](#testing)
6. [Database Patterns](#database-patterns)
7. [Frontend Components](#frontend-components)
8. [Commit Messages](#commit-messages)

---

## TypeScript & Naming

### Type Safety

- **Strict Mode Required**: Both frontend and backend use `strict: true` in `tsconfig.json`
- **No explicit `any`**: Avoid `any` type except in pg query parameters where necessary
- **Type Exports**: Export types from `frontend/src/types/index.ts` (single source of truth for domain types)
- **Backend Types**: Define inline in route files; no separate types directory needed (keep cohesion with routes)

### Naming Conventions

| Category | Convention | Example |
|---|---|---|
| **Files** | `camelCase.ts` for utilities/services | `computations.ts`, `allocationAggregator.ts` |
| **Components** | `PascalCase.tsx` for React | `AppNav.tsx`, `FTECell.tsx` |
| **Routes** | `kebab-case` in URL, `camelCase` in file | `/api/phase-templates` → `phaseTemplates.ts` |
| **Interfaces** | `PascalCase`, descriptive | `AllocationCell`, `ProjectSummary`, `BaselineData` |
| **Functions** | `camelCase`, verb-first | `computeRAGStatus()`, `validateFTE()` |
| **Constants** | `SCREAMING_SNAKE_CASE` | `MAX_FTE = 1.0`, `BATCH_SIZE = 100` |
| **Database Tables** | `PascalCase` with double quotes | `"ProjectPhase"`, `"AllocationEntry"` |
| **Database Columns** | `snake_case` with underscores | `planned_start`, `phase_id`, `week_start` |
| **Env Variables** | Backend: `SCREAMING_SNAKE_CASE`, Frontend: `VITE_*` | `SUPABASE_URL`, `VITE_API_URL` |

### Type Patterns

**Domain Models:**
```typescript
// types/index.ts - shared across app
export interface ProjectSummary {
  id: number;
  name: string;
  rag_status: RAGStatus;
  budget_total: number;
  // ...
}

export type RAGStatus = 'IN_LINEA' | 'A_RISCHIO' | 'FUORI_BUDGET';
export type PhaseType = 'feasibility' | 'planning_design' | 'build' | 'deployment' | 'closure';
```

**Service Layer:**
```typescript
// services/computations.ts - pure functions with dependency injection
interface QueryFunc {
  (sql: string, params?: unknown[]): Promise<any[]>;
}

export function calculateRAGStatus(
  revisedForecast: number,
  bac: number
): RAGStatus {
  const ratio = revisedForecast / bac;
  if (ratio <= 1.05) return 'IN_LINEA';
  if (ratio <= 1.15) return 'A_RISCHIO';
  return 'FUORI_BUDGET';
}
```

**Route Handlers:**
```typescript
// routes/projects.ts - stateless, synchronous response
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await query('SELECT * FROM "Project" WHERE id = $1', [id]);
    res.json(project[0] || { error: 'Not found' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
```

---

## File Organization

### Backend Structure

```
backend/
├── src/
│   ├── index.ts                 # Express app entry, middleware, CORS
│   ├── db/
│   │   ├── index.ts             # Pool init + query() helper
│   │   ├── supabase.ts          # Supabase client (auth only)
│   │   ├── migrate.ts           # Migration runner
│   │   ├── seed.ts              # Demo data seeder
│   │   └── migrations/          # SQL migration files (001–010+)
│   ├── routes/
│   │   ├── auth.ts              # POST /api/auth/login | logout
│   │   ├── projects.ts          # GET /api/projects, POST, etc.
│   │   ├── phases.ts            # GET /api/projects/:id/phases
│   │   ├── baseline.ts          # GET /api/projects/:id/baseline
│   │   ├── allocations.ts       # GET /api/projects/:id/allocations, PUT
│   │   ├── resources.ts         # GET /api/resources (with utilization)
│   │   ├── ongoing.ts           # GET /api/projects/:id/ongoing, POST, sync-keyedin
│   │   ├── gantt.ts             # GET /api/projects/:id/gantt
│   │   ├── dashboard.ts         # GET /api/projects/:id/dashboard (KPIs)
│   │   ├── phaseTemplates.ts    # GET /api/phase-templates
│   │   └── routes.test.ts       # Integration tests (supertest)
│   ├── services/
│   │   ├── computations.ts      # Pure business logic: RAG, NETWORKDAYS, forecast
│   │   ├── computations.test.ts # Unit tests (zero DB dependency)
│   │   ├── consistency.test.ts  # Edge cases: floating point, RAG near thresholds
│   │   ├── allocationAggregator.ts      # Cross-project FTE tracking
│   │   ├── allocationAggregator.test.ts
│   │   └── ongoing/
│   │       ├── OngoingDataProvider.ts      # Interface
│   │       ├── KeyedinApiProvider.ts       # Stub implementation
│   │       └── ManualFallbackProvider.ts   # Manual entry fallback
│   └── dist/                    # Build output (after `pnpm run build`)
└── package.json
```

**File Creation Checklist:**
1. New feature → Create route file in `routes/` (e.g., `myFeature.ts`)
2. Business logic → Extract to `services/` if shared or complex
3. Tests → Adjacent file: `routes.test.ts` or `myFeature.test.ts`
4. Mount in `index.ts`: `app.use('/api/path', myFeatureRouter)`
5. Update `CLAUDE.md` if architecture changes

### Frontend Structure

```
frontend/
├── src/
│   ├── App.tsx                  # BrowserRouter + AuthProvider + Routes
│   ├── main.tsx                 # React entry point
│   ├── types/
│   │   └── index.ts             # All domain types (shared with backend conceptually)
│   ├── api/
│   │   ├── client.ts            # fetch() wrapper + Bearer token
│   │   ├── auth.ts              # Supabase Auth methods
│   │   ├── supabase.ts          # Supabase client config
│   │   ├── projects.ts          # GET /api/projects wrapper
│   │   ├── baseline.ts          # GET /api/baseline wrapper
│   │   ├── allocation.ts        # GET /api/allocations wrapper
│   │   ├── ongoing.ts           # GET /api/ongoing wrapper
│   │   ├── gantt.ts
│   │   └── phaseTemplates.ts
│   ├── contexts/
│   │   └── AuthContext.tsx      # token + user in localStorage
│   ├── components/              # Reusable UI primitives
│   │   ├── AppNav.tsx           # Main navbar
│   │   ├── FTECell.tsx          # Editable FTE input cell
│   │   ├── RAGBadge.tsx         # Green/Amber/Red status
│   │   ├── BudgetBar.tsx        # Progress bar
│   │   ├── DateInput.tsx        # Date picker wrapper
│   │   ├── ConfirmModal.tsx     # Delete/confirm dialog
│   │   └── ProtectedRoute.tsx   # Auth guard wrapper
│   ├── pages/                   # Feature pages (one per major route)
│   │   ├── Login.tsx            # /login
│   │   ├── Projects.tsx         # /projects (list view)
│   │   ├── Dashboard.tsx        # /projects/:id/dashboard (KPIs + phase budgets)
│   │   ├── Pianificazione.tsx   # /projects/:id/planning (phases + allocations)
│   │   ├── Avanzamento.tsx      # /projects/:id/ongoing (progress + sync)
│   │   ├── Gantt.tsx            # /projects/:id/gantt
│   │   ├── Resources.tsx        # /projects/:id/resources (utilization matrix)
│   │   └── Settings.tsx         # /settings
│   ├── test/
│   │   └── setup.ts             # Vitest setup + global mocks
│   ├── utils/
│   │   ├── networkDays.ts       # Date utilities (weeksInRange, fmtWeek, NETWORKDAYS)
│   │   └── *.ts                 # Other helpers (formatting, validation)
│   ├── mocks/
│   │   └── mockData.ts          # Demo data for VITE_USE_MOCK=true
│   └── index.css                # Global Tailwind styles
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
├── tailwind.config.js
└── package.json
```

**Component Creation Checklist:**
1. Define types in `frontend/src/types/index.ts` (shared interface)
2. Create page or component in `pages/` or `components/`
3. Create API client wrapper in `api/` if calling backend
4. Use `apiClient()` from `api/client.ts` for fetch with Bearer token
5. Pull data in `useEffect` or on component mount
6. Write tests alongside in `*.test.tsx` files

---

## API Design

### Route Structure

All routes follow Express `Router` pattern with `mergeParams: true`:

```typescript
// backend/src/routes/projects.ts
import { Router, Request, Response } from 'express';
import { query } from '../db/index';

const router = Router({ mergeParams: true });

// GET /api/projects
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;
    const projects = await query(
      'SELECT * FROM "Project" WHERE pm_id = $1',
      [user_id]
    );
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
```

Then mount in `index.ts`:
```typescript
app.use('/api/projects', projectsRouter);
```

### Request/Response Patterns

**Successful Response:**
```json
{
  "id": 1,
  "name": "Q2 Portal",
  "rag_status": "IN_LINEA"
}
```

**Error Response (400):**
```json
{
  "error": "Missing required field: phase_id"
}
```

**Error Response (409 - Business Logic):**
```json
{
  "error": "FTE allocation exceeds maximum of 1.0",
  "resource_id": 5,
  "week_start": "2026-06-08",
  "proposed_fte": 1.1,
  "available_fte": 0.3
}
```

**Error Response (500):**
```json
{
  "error": "Database connection timeout"
}
```

### Status Code Usage

| Code | Condition | Example |
|---|---|---|
| `200 OK` | Successful GET, PUT, DELETE | Return updated resource |
| `201 Created` | POST creates resource | Return created object with `id` |
| `204 No Content` | DELETE with no response body | - |
| `400 Bad Request` | Missing/invalid input | Missing date, invalid enum value |
| `404 Not Found` | Resource doesn't exist | Project ID not found in DB |
| `409 Conflict` | Business rule violation | FTE cap exceeded, duplicate allocation |
| `500 Internal Error` | Server error (DB, unexpected) | Connection timeout, null ref error |
| `401 Unauthorized` | Auth token missing/invalid | (Step H: to be implemented) |
| `403 Forbidden` | Authenticated but no permission | PM accessing another PM's project (Step H) |

### Parameter Handling

**URL Params:**
```typescript
// GET /api/projects/:id/allocations
const { id } = req.params;  // type: string (convert to number if needed)
```

**Query Params:**
```typescript
// GET /api/allocations?resource_id=5&date_from=2026-06-01
const { resource_id, date_from } = req.query;
```

**Body (JSON):**
```typescript
// PUT /api/projects/:id/allocations
const { resource_id, phase_id, week_start, fte } = req.body;
```

**Validation Example:**
```typescript
if (!resource_id || !phase_id || !week_start || fte === undefined) {
  return res.status(400).json({ error: 'Missing required fields' });
}
if (fte < 0 || fte > 1.0) {
  return res.status(400).json({ error: 'FTE must be between 0.0 and 1.0' });
}
```

---

## Error Handling

### Backend Error Pattern

All route handlers follow `try/catch` with consistent status codes:

```typescript
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;

    // Validation
    if (!name || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Business logic
    if (status === 'archived' && !baselineExists) {
      return res.status(409).json({
        error: 'Cannot archive project without baseline'
      });
    }

    // Database operation
    const updated = await query(
      'UPDATE "Project" SET name = $1, status = $2 WHERE id = $3 RETURNING *',
      [name, status, id]
    );

    res.json(updated[0]);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: String(err) });
  }
});
```

### Frontend Error Handling

Use try/catch in API calls and display user-friendly messages:

```typescript
// pages/Dashboard.tsx
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  (async () => {
    try {
      const data = await getDashboardData(projectId);
      setDashboard(data);
      setError(null);
    } catch (err) {
      setError(String(err));
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  })();
}, [projectId]);

if (error) {
  return <div className="bg-rag-red text-white p-4">{error}</div>;
}
```

### Logging

**Backend:**
```typescript
console.error('Failed to sync Keyedin:', err);  // Errors
console.log('Seeded 10 resources');             // Info
```

**Frontend:**
```typescript
console.error('API call failed:', error);
console.log('User logged in:', user.email);
```

No structured logging (winston, pino) at this stage; keep it simple.

---

## Testing

### Backend Testing (Jest + Supertest)

**Unit Tests (services):**
```typescript
// services/computations.test.ts
import { calculateRAGStatus, validateFTE } from './computations';

describe('computations', () => {
  describe('calculateRAGStatus', () => {
    it('returns IN_LINEA when revised_forecast <= 1.05 * BAC', () => {
      expect(calculateRAGStatus(5000, 5000)).toBe('IN_LINEA');
      expect(calculateRAGStatus(5250, 5000)).toBe('IN_LINEA');
    });

    it('returns A_RISCHIO when 1.05 < ratio <= 1.15', () => {
      expect(calculateRAGStatus(5300, 5000)).toBe('A_RISCHIO');
      expect(calculateRAGStatus(5750, 5000)).toBe('A_RISCHIO');
    });

    it('returns FUORI_BUDGET when ratio > 1.15', () => {
      expect(calculateRAGStatus(5800, 5000)).toBe('FUORI_BUDGET');
    });
  });

  describe('validateFTE', () => {
    it('returns false if fte > 1.0', () => {
      expect(validateFTE(1.1)).toBe(false);
    });

    it('returns true if 0 <= fte <= 1.0', () => {
      expect(validateFTE(0)).toBe(true);
      expect(validateFTE(0.5)).toBe(true);
      expect(validateFTE(1.0)).toBe(true);
    });
  });
});
```

**Integration Tests (routes):**
```typescript
// routes/routes.test.ts
import request from 'supertest';
import app from '../index';

describe('Projects API', () => {
  describe('GET /api/projects/:id', () => {
    it('returns project detail', async () => {
      const res = await request(app)
        .get('/api/projects/1')
        .expect(200);

      expect(res.body).toHaveProperty('id', 1);
      expect(res.body).toHaveProperty('name');
    });

    it('returns 404 for non-existent project', async () => {
      await request(app)
        .get('/api/projects/9999')
        .expect(404);
    });
  });
});
```

**Run:**
```bash
cd backend && pnpm test --runInBand
```

### Frontend Testing (Vitest)

**Component Tests:**
```typescript
// components/RAGBadge.test.tsx
import { render, screen } from '@testing-library/react';
import RAGBadge from './RAGBadge';

describe('RAGBadge', () => {
  it('renders green for IN_LINEA', () => {
    render(<RAGBadge status="IN_LINEA" />);
    expect(screen.getByText('IN LINEA')).toHaveClass('bg-rag-green');
  });

  it('renders amber for A_RISCHIO', () => {
    render(<RAGBadge status="A_RISCHIO" />);
    expect(screen.getByText('A RISCHIO')).toHaveClass('bg-rag-amber');
  });
});
```

**Utility Tests:**
```typescript
// utils/networkDays.test.ts
import { weeksInRange, NETWORKDAYS } from './networkDays';

describe('networkDays', () => {
  it('calculates working days excluding weekends and holidays', () => {
    // June 2026: 2-5 is Tue-Fri (4 days, no holidays)
    const result = NETWORKDAYS(
      new Date('2026-06-02'),
      new Date('2026-06-05'),
      []
    );
    expect(result).toBe(4);
  });
});
```

**Run:**
```bash
cd frontend && pnpm test
```

### Test Coverage Goals

- **Backend services**: >80% coverage (pure functions)
- **Routes**: Integration tests for happy path + error cases
- **Frontend utilities**: >70% coverage
- **Components**: Smoke tests (render + basic props)
- **Edge cases**: Float precision (RAG near 1.05, 1.15), date boundaries

---

## Database Patterns

### Query Helper

The `query()` function is the single entry point for all database operations:

```typescript
// db/index.ts
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function query<T>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows;
}
```

**Usage:**
```typescript
const projects = await query<Project>(
  'SELECT * FROM "Project" WHERE pm_id = $1',
  [userId]
);

const [project] = await query<Project>(
  'SELECT * FROM "Project" WHERE id = $1',
  [id]
);

if (!project) {
  // Handle not found
}
```

### SQL Style

- **Table names**: Double-quoted `PascalCase` → `"Project"`, `"AllocationEntry"`
- **Column names**: Unquoted `snake_case` → `pm_id`, `week_start`
- **Placeholders**: Numbered `$1, $2, ...` for parameter safety
- **Transactions**: Wrap atomic operations in `BEGIN; ... COMMIT;`

**Example:**
```typescript
// GOOD
const result = await query(
  `SELECT id, name, budget 
   FROM "ProjectPhase" 
   WHERE project_id = $1 
   ORDER BY "order"`,
  [projectId]
);

// AVOID
const result = await query(
  `SELECT * FROM ProjectPhase WHERE project = ${projectId}`  // SQL injection risk!
);
```

### Materialized Costs

When allocating resources, compute `weekly_cost` at insert time:

```typescript
// computations.ts
export function calculateWeeklyCost(
  dayRate: number,
  fte: number,
  workingDays: number
): number {
  return dayRate * fte * workingDays;
}

// In route handler
const weeklyClst = calculateWeeklyCost(dayRate, fte, workingDaysInWeek);
await query(
  `INSERT INTO "AllocationEntry" 
   (resource_id, project_id, phase_id, week_start, fte, working_days, weekly_cost)
   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
  [resourceId, projectId, phaseId, weekStart, fte, workingDaysInWeek, weeklyCost]
);
```

---

## Frontend Components

### Component Template

```typescript
// components/MyComponent.tsx
import React, { useState } from 'react';

interface MyComponentProps {
  title: string;
  value: number;
  onSubmit: (newValue: number) => void;
}

export default function MyComponent({
  title,
  value,
  onSubmit
}: MyComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [input, setInput] = useState(String(value));

  const handleSubmit = () => {
    onSubmit(Number(input));
    setIsEditing(false);
  };

  return (
    <div className="p-4 bg-surface rounded border border-surface-dark">
      <h3 className="font-semibold text-primary">{title}</h3>
      {isEditing ? (
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="border border-accent px-2 py-1 rounded mt-2"
        />
      ) : (
        <div className="text-lg text-muted mt-2">{value}</div>
      )}
      <button
        onClick={() => setIsEditing(!isEditing)}
        className="mt-4 px-3 py-1 bg-accent text-white rounded hover:bg-accent-hover"
      >
        {isEditing ? 'Done' : 'Edit'}
      </button>
      {isEditing && (
        <button
          onClick={handleSubmit}
          className="ml-2 px-3 py-1 bg-rag-green text-white rounded"
        >
          Save
        </button>
      )}
    </div>
  );
}
```

### Props & State

- Keep props focused (max 5-6 if possible)
- Use `interface Props` for clarity
- State should be local unless shared across pages (use Context)
- Extract complex state logic to custom hooks

### Styling

- Use Tailwind classes only (no inline styles)
- Reference colors from `tailwind.config.js`:
  - `text-primary`, `text-muted`, `text-dim`
  - `bg-base`, `bg-surface`, `bg-surface-dark`
  - `rag-green`, `rag-amber`, `rag-red`
  - `accent`, `accent-cyan`
- Responsive: use `sm:`, `md:`, `lg:` prefixes (desktop-first approach)

---

## Commit Messages

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring (no behavior change)
- `test`: Test additions/changes
- `docs`: Documentation updates
- `chore`: Dependency updates, config changes
- `perf`: Performance improvements

### Scope

Entity or area affected:
- `auth`, `projects`, `phases`, `allocations`, `baseline`, `gantt`, `ongoing`, `dashboard`, `resources`, `db`, `fe`, `be`

### Subject

- Lowercase, imperative mood ("add", not "adds" or "added")
- No period at end
- Max 50 characters

### Examples

```
feat(allocations): add FTE cap validation on PUT /allocations

This change enforces the 1.0 FTE maximum per resource per week across all projects.
Uses the updated AllocationAggregator service to check capacity before inserting.

Closes #42
```

```
fix(dashboard): correct RAG status calculation for >100% forecast

The ratio calculation was not handling cases where forecast exceeds BAC.
Now properly returns FUORI_BUDGET when ratio > 1.15.
```

```
docs(data-model): add comprehensive schema documentation

Created DATA_MODEL.md with table descriptions, relationships, and design rationale.
```

### Best Practices

- Commit early and often (atomic changes)
- Write clear, descriptive messages for future maintainers
- Reference issue numbers if applicable (`Closes #123`)
- Don't include sensitive data (credentials, API keys, PII)

---

## Code Review Checklist

Before submitting a PR:

- [ ] Code follows naming conventions (files, functions, types)
- [ ] TypeScript strict mode passes (`tsc --noEmit`)
- [ ] Tests written for new logic (unit or integration)
- [ ] `pnpm test` passes (backend and frontend)
- [ ] Error handling covers happy path + failure cases
- [ ] No `console.log()` left in production code (use for debugging only)
- [ ] Database changes include migration file (if applicable)
- [ ] Types updated in `frontend/src/types/index.ts` (if data model changed)
- [ ] CLAUDE.md updated (if architecture changed)
- [ ] Commit messages follow format (see above)

---

## Documentation Standards

### Inline Comments

Use sparingly; let clear code speak for itself. Comments explain *why*, not *what*.

```typescript
// GOOD: explains business logic
// Enforce FTE cap globally to prevent overbooking across all projects
const available = await allocationAggregator.getAvailableFTE(resourceId, weekStart);

// AVOID: obvious from code
// Get the user ID from the request
const userId = req.user?.id;
```

### JSDoc for Public APIs

```typescript
/**
 * Calculate revised forecast as average of time-based and cost-based estimates.
 * 
 * @param spentToDate - Cumulative cost spent so far
 * @param workingDaysUsed - Days already consumed
 * @param totalWorkingDays - Total project duration in days
 * @param baseBudget - Initial estimated budget
 * @returns Revised forecast amount (currency units)
 */
export function calculateRevisedForecast(
  spentToDate: number,
  workingDaysUsed: number,
  totalWorkingDays: number,
  baseBudget: number
): number {
  // ...
}
```

### README for Features

Create a `feature-name.md` in docs for complex features:
- High-level overview
- Key algorithms or business rules
- API endpoints involved
- Example workflows

---

## Performance Considerations

### Backend

- Index frequent WHERE clauses (see `docs/DATA_MODEL.md` indexing section)
- Use `LIMIT` in paginated queries
- Avoid N+1 queries; batch operations when possible
- Cache static data (phase templates, holidays) in memory if accessed frequently

### Frontend

- Use `React.memo()` for expensive component renders
- Debounce API calls in search/filter inputs
- Lazy-load pages with React Router
- Use Vite dev server HMR for fast feedback during development

### Database

- Keep AllocationEntry queries scoped by (project_id, phase_id, week_start)
- Compute phase budget on-the-fly (don't cache; allocations are mutable)
- Use batch inserts for seeding large datasets

---

## Version Management

- Follow semantic versioning: `MAJOR.MINOR.PATCH`
- Update `package.json` version after significant releases
- Tag releases in Git: `git tag v1.0.0`

Current version: **1.0.0** (POC)
