# Development Guide — Project Forecast App

Practical guide for setting up your development environment, common workflows, debugging, and best practices.

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Running Locally](#running-locally)
3. [Git Workflow](#git-workflow)
4. [Common Tasks](#common-tasks)
5. [Debugging & Troubleshooting](#debugging--troubleshooting)
6. [Code Style & Conventions](#code-style--conventions)
7. [Performance Tips](#performance-tips)

---

## Environment Setup

### Prerequisites

- **Node.js** 18+ (recommend 20.x LTS)
- **pnpm** 9.x (`npm install -g pnpm`)
- **Git**
- **Docker** & **Docker Compose** (for local PostgreSQL)
- **VS Code** (recommended with extensions below)

### VS Code Extensions (Recommended)

| Extension | Purpose |
|---|---|
| **ESLint** | Code linting |
| **Prettier** | Code formatting |
| **Tailwind CSS IntelliSense** | Tailwind autocompletion |
| **Thunder Client** or **REST Client** | API testing |
| **SQLTools** | Database queries |
| **React DevTools** | React debugging |

### Initial Setup

**1. Clone and install:**
```bash
git clone <repo-url>
cd project-forecast-app
pnpm install
```

**2. Create environment files:**

`backend/.env`:
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/project_forecast
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
NODE_ENV=development
```

`frontend/.env.local`:
```
VITE_API_URL=http://localhost:3000
VITE_USE_MOCK=false
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-key
```

**3. Set up local PostgreSQL:**
```bash
# Start database container
docker-compose up -d

# Wait a few seconds for Postgres to start
sleep 5

# Run migrations
cd backend && pnpm run migrate && pnpm run seed && cd ..
```

**4. Verify setup:**
```bash
# Backend should start without errors
cd backend && timeout 5 pnpm run dev || true

# Frontend should start and open browser
cd frontend && timeout 5 pnpm run dev || true
```

---

## Running Locally

### Full Stack (Both Backend & Frontend)

**Terminal 1 — Backend:**
```bash
cd backend
pnpm run dev
# Output: Server running on port 3000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
pnpm run dev
# Output: VITE v5.x.x ready in XXX ms ➜ Local: http://localhost:5173/
```

**Terminal 3 (optional) — Database:**
```bash
docker-compose logs -f postgres
# Monitoring database logs
```

Then open **http://localhost:5173** in your browser.

### Frontend Only (Mock Mode)

If you only want to work on UI without the backend:

```bash
# In frontend/.env.local
VITE_USE_MOCK=true

cd frontend
pnpm run dev
```

This bypasses all API calls and uses `src/mocks/mockData.ts`.

### Backend Only

For API development without the frontend:

```bash
cd backend
pnpm run dev
# API available at http://localhost:3000/api/*
```

Test endpoints with REST Client or Thunder Client.

---

## Git Workflow

### Branch Naming

Follow this pattern:
```
feature/description    — New feature
fix/bug-description    — Bug fix
refactor/what          — Code improvements
docs/what              — Documentation
chore/what             — Tooling, setup
```

Example:
```bash
git checkout -b feature/phase-financial-engine
```

### Before Committing

1. **Run tests:**
   ```bash
   cd backend && pnpm test && cd ..
   cd frontend && pnpm test && cd ..
   ```

2. **Check linting:**
   ```bash
   cd frontend && pnpm run lint && cd ..
   ```

3. **Type check:**
   ```bash
   cd frontend && pnpm run build:types
   cd backend && pnpm run build
   ```

4. **Stage files:**
   ```bash
   git add src/...
   ```

5. **Commit with clear message:**
   ```bash
   git commit -m "feat: add phase financial engine"
   ```

   Commit format: `type: description`
   - `feat:` — Feature
   - `fix:` — Bug fix
   - `refactor:` — Code improvement
   - `docs:` — Documentation
   - `test:` — Test addition
   - `chore:` — Setup/tooling

### Creating a Pull Request

1. **Push your branch:**
   ```bash
   git push origin feature/phase-financial-engine
   ```

2. **Create PR on GitHub with:**
   - Clear title (what changed)
   - Description (why it changed)
   - Screenshots (if UI change)
   - Link to issue (if applicable)

3. **Address review feedback:**
   ```bash
   # Make changes
   git add ...
   git commit -m "fix review feedback"
   git push
   ```

4. **Merge when approved:**
   - Use "Squash and merge" for clean history
   - Delete branch after merge

---

## Common Tasks

### Adding a New API Route

**1. Create route file** `backend/src/routes/featureName.ts`:
```typescript
import { Router } from 'express';
import { query } from '../db';

const router = Router({ mergeParams: true });

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT * FROM "FeatureTable" WHERE id = $1',
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
```

**2. Mount in `backend/src/index.ts`:**
```typescript
import featureRouter from './routes/featureName';
app.use('/api/feature', featureRouter);
```

**3. Create API module** `frontend/src/api/featureName.ts`:
```typescript
import { apiClient } from './client';
import type { FeatureData } from '../types';

export async function fetchFeature(id: number): Promise<FeatureData> {
  return apiClient(`/api/feature/${id}`);
}
```

**4. Add types** to `frontend/src/types/index.ts`:
```typescript
export interface FeatureData {
  id: number;
  name: string;
  // ...
}
```

**5. Use in component** `frontend/src/pages/Feature.tsx`:
```typescript
import { fetchFeature } from '../api/featureName';

export default function Feature() {
  const [data, setData] = useState<FeatureData | null>(null);

  useEffect(() => {
    fetchFeature(1).then(setData).catch(console.error);
  }, []);

  if (!data) return <div>Loading...</div>;
  return <div>{data.name}</div>;
}
```

### Adding a Database Migration

**1. Create migration file** `backend/src/db/migrations/00N_description.sql`:
```sql
BEGIN;

ALTER TABLE "Project"
ADD COLUMN new_field TEXT DEFAULT 'default_value';

COMMIT;
```

**2. Run migration:**
```bash
cd backend && pnpm run migrate
```

The migration runner automatically tracks which migrations have run, so repeating this command is safe.

**3. Update types** in `frontend/src/types/index.ts` if needed.

### Modifying Business Logic

**Example: Updating RAG status calculation**

**1. Update service** `backend/src/services/computations.ts`:
```typescript
export function calculateRAGStatus(
  revisedForecast: number,
  bac: number
): RAGStatus {
  const ratio = revisedForecast / bac;
  // Add epsilon tolerance for floating-point
  if (ratio <= 1.05 + 1e-9) return 'IN_LINEA';
  if (ratio <= 1.15 + 1e-9) return 'A_RISCHIO';
  return 'FUORI_BUDGET';
}
```

**2. Write tests first** in `backend/src/services/computations.test.ts`:
```typescript
describe('calculateRAGStatus', () => {
  it('should return IN_LINEA for <= 1.05 BAC', () => {
    expect(calculateRAGStatus(105000, 100000)).toBe('IN_LINEA');
  });

  it('should return A_RISCHIO for > 1.05 and <= 1.15', () => {
    expect(calculateRAGStatus(112000, 100000)).toBe('A_RISCHIO');
  });
});
```

**3. Run tests:**
```bash
cd backend && pnpm test -- computations.test.ts --watch
```

**4. Update any routes using this function** (search for `calculateRAGStatus`).

**5. Commit with test-first message:**
```bash
git commit -m "fix: add epsilon tolerance to RAG status calculation"
```

### Testing UI Component

**1. Start frontend in mock mode:**
```bash
VITE_USE_MOCK=true pnpm run dev
```

**2. Navigate to the page** in browser and test manually.

**3. For unit tests** in `src/components/Component.test.ts`:
```typescript
import { render, screen } from '@testing-library/react';
import Component from './Component';

describe('Component', () => {
  it('renders with props', () => {
    render(<Component title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

**4. Run tests:**
```bash
cd frontend && pnpm test -- Component.test.ts --watch
```

---

## Debugging & Troubleshooting

### Backend Debugging

**1. Add console.log statements:**
```typescript
console.log('Phase data:', phases);
console.table(allocations);
```

**2. Use Node Inspector:**
```bash
node --inspect-brk node_modules/.bin/ts-node src/index.ts
# Then open chrome://inspect in browser
```

**3. Check database state:**
```bash
docker exec -it project-forecast-postgres psql -U postgres -d project_forecast -c "SELECT * FROM \"Project\" LIMIT 5;"
```

**4. View logs:**
```bash
# Backend logs (running in Terminal 1)
# Look for errors like "listen EADDRINUSE" (port in use)

# Database logs
docker-compose logs postgres
```

### Frontend Debugging

**1. Browser DevTools (F12):**
   - **Console** — Runtime errors
   - **Network** — API calls, headers, payloads
   - **Application** — localStorage (auth tokens)
   - **React DevTools** — Component tree, props

**2. Add debugging statements:**
```typescript
console.log('API response:', data);
console.log('Auth token:', localStorage.getItem('token'));
```

**3. Check environment variables:**
```typescript
console.log('API URL:', import.meta.env.VITE_API_URL);
console.log('Mock mode:', import.meta.env.VITE_USE_MOCK);
```

### Common Issues

| Issue | Diagnosis | Solution |
|---|---|---|
| **401 Unauthorized** | Token missing/invalid | Check localStorage, verify Bearer token in Network tab |
| **CORS errors** | Backend not allowing frontend origin | Check backend `cors()` setup in `index.ts` |
| **Database connection failed** | Postgres not running | `docker-compose up -d` and `docker-compose logs postgres` |
| **Port already in use** | Another process on 3000 or 5173 | `lsof -i :3000` to find process, `kill -9 PID` |
| **Migration fails** | SQL syntax or constraint issue | Check `backend/src/db/migrations/*.sql` |
| **Vite HMR not working** | WebSocket connection issue | Restart `pnpm run dev`, check firewall |
| **Types not updating** | TypeScript cache stale | Delete `frontend/dist/` and rebuild |

---

## Code Style & Conventions

### TypeScript

**Use `strict: true`:**
```typescript
// ✅ Good
function getUser(id: number): User | null {
  // ...
}

// ❌ Avoid
function getUser(id: any): any {
  // ...
}
```

**Naming:**
- Files: `camelCase.ts` for utilities, `PascalCase.tsx` for components
- Variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Types: `PascalCase`

```typescript
export type UserRole = 'pm' | 'dm';

const BASE_URL = 'http://localhost:3000';

function calculateBudget(phases: ProjectPhase[]): number {
  // ...
}

export default function Dashboard() {
  // ...
}
```

### React Components

**Use functional components + hooks:**
```typescript
// ✅ Good
export default function Button({ label, onClick }: ButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  return <button onClick={onClick}>{label}</button>;
}

// ❌ Avoid (class components)
class Button extends React.Component {
  // ...
}
```

**Props interfaces:**
```typescript
interface MyComponentProps {
  title: string;
  count?: number;        // Optional
  onLoad?: () => void;   // Callbacks
  children?: React.ReactNode;
}

export default function MyComponent({ title, count, onLoad, children }: MyComponentProps) {
  // ...
}
```

### Error Handling

**Backend:**
```typescript
// ✅ Good
try {
  const result = await query('SELECT * FROM "Project"');
  res.json(result.rows);
} catch (err) {
  console.error('Database error:', err);
  res.status(500).json({ error: 'Failed to fetch projects' });
}

// ❌ Avoid
res.json(query(...)); // No error handling
```

**Frontend:**
```typescript
// ✅ Good
try {
  const data = await fetchProjects();
  setProjects(data);
} catch (err) {
  setError('Failed to load projects. Please refresh.');
  console.error(err);
}

// ❌ Avoid
const data = await fetchProjects(); // Unhandled rejection
setProjects(data);
```

### Testing

**Write tests first, then implement:**
```typescript
// ❌ Wrong order
// Implement feature, then write tests

// ✅ Right order
describe('Feature', () => {
  it('should do X', () => {
    expect(...).toBe(...);
  });
});
// Then implement to make test pass
```

**Test naming:**
```typescript
describe('calculateBudget', () => {
  it('should sum all phase costs', () => {
    // ...
  });

  it('should return 0 for empty phases', () => {
    // ...
  });

  it('should apply contingency multiplier', () => {
    // ...
  });
});
```

---

## Performance Tips

### Frontend

**1. Use React DevTools Profiler:**
   - Identify slow component renders
   - Check if components re-render unnecessarily

**2. Avoid unnecessary re-renders:**
   ```typescript
   // ❌ Re-renders on every parent update
   <Child onLoad={() => fetchData()} />

   // ✅ Memoize callback
   const handleLoad = useCallback(() => fetchData(), []);
   <Child onLoad={handleLoad} />
   ```

**3. Lazy load pages (future):**
   ```typescript
   const Dashboard = React.lazy(() => import('./pages/Dashboard'));
   ```

**4. Optimize images (future):**
   - Use WebP format
   - Serve responsive sizes

### Backend

**1. Use database indices for common queries:**
   ```sql
   CREATE INDEX idx_allocation_resource_week 
   ON "AllocationEntry"(resource_id, week_start);
   ```

**2. Batch queries where possible:**
   ```typescript
   // ❌ N+1 queries
   const projects = await query('SELECT * FROM "Project"');
   for (const p of projects) {
     const phases = await query('SELECT * FROM "ProjectPhase" WHERE project_id = $1', [p.id]);
   }

   // ✅ Single query with join
   const data = await query(`
     SELECT p.*, pp.* FROM "Project" p
     LEFT JOIN "ProjectPhase" pp ON pp.project_id = p.id
   `);
   ```

**3. Cache static data (future):**
   - Phase templates
   - Public holidays
   - Resource registry

### Database

**1. Regular backups:**
   ```bash
   docker exec project-forecast-postgres pg_dump -U postgres project_forecast > backup.sql
   ```

**2. Monitor slow queries:**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM "AllocationEntry" WHERE week_start = $1;
   ```

---

## Quick Reference

### Most Used Commands

```bash
# Setup
pnpm install
docker-compose up -d
cd backend && pnpm run migrate && pnpm run seed && cd ..

# Development
cd backend && pnpm run dev    # Terminal 1
cd frontend && pnpm run dev   # Terminal 2

# Testing
cd backend && pnpm test
cd frontend && pnpm test

# Building
cd backend && pnpm run build
cd frontend && pnpm run build

# Cleanup
docker-compose down
rm -rf node_modules backend/dist frontend/dist
```

### VS Code Snippets

Add to `.vscode/snippets.json`:

```json
{
  "React Component": {
    "prefix": "comp",
    "body": [
      "interface ${1:Component}Props {",
      "  ${2:prop}: ${3:type};",
      "}",
      "",
      "export default function ${1:Component}({ ${2:prop} }: ${1:Component}Props) {",
      "  return <div>${2:prop}</div>;",
      "}"
    ]
  },
  "API Module": {
    "prefix": "api",
    "body": [
      "import { apiClient } from './client';",
      "import type { ${1:Type} } from '../types';",
      "",
      "export async function fetch${1:Type}(id: number): Promise<${1:Type}> {",
      "  return apiClient(`/api/${2:endpoint}/${id}`);",
      "}"
    ]
  }
}
```

---

## Resources

- **CLAUDE.md** — Architecture SSoT
- **ARCHITECTURE_AS_IS.md** — Current state + data flow
- **docs/backend-architecture.md** — Backend patterns
- **docs/frontend-architecture.md** — Frontend structure
- **NEXT_STEPS.md** — Roadmap

Need help? Check the relevant documentation file or search the codebase with VS Code.
