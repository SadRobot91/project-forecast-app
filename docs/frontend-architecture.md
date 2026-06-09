# Frontend Architecture — Project Forecast App

Complete guide to the React 18 + Vite frontend architecture, component structure, state management, API layer, and styling.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Entry Point & Routing](#entry-point--routing)
3. [Authentication & Context](#authentication--context)
4. [API Layer](#api-layer)
5. [Component Structure](#component-structure)
6. [Pages & Features](#pages--features)
7. [State Management](#state-management)
8. [Styling & Theme](#styling--theme)
9. [Testing & Mocks](#testing--mocks)
10. [Development Workflow](#development-workflow)
11. [Deployment](#deployment)

---

## Architecture Overview

The frontend is a **React 18 SPA (Single Page Application)** built with Vite for fast development and builds.

### Core Principles

1. **No global state manager** — State lives in components locally or minimal context (AuthContext only)
2. **API-first** — All data flows through a centralized fetch wrapper with Bearer token auth
3. **Type-safe** — TypeScript `strict: true`, shared domain types in `frontend/src/types/index.ts`
4. **Component composition** — Reusable UI primitives, feature pages combine them
5. **Dark-only theme** — Custom Tailwind dark palette, no light mode

### High-Level Data Flow

```
User Browser
    ↓
React Router (routes in App.tsx)
    ↓
Page Component (pages/*.tsx)
    ├─ Local useState for form/view state
    ├─ useAuth() for token + user
    └─ Call API module (api/*.ts)
        ↓
API Module
    └─ apiClient() wrapper
        ↓
Backend API (http://localhost:3000/api/...)
    ↓
Database
```

---

## Entry Point & Routing

### `src/main.tsx`

Bootstrap Vite app:
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'  // Tailwind + global styles

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### `src/App.tsx`

Root component with router and auth provider:

```typescript
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/projects/:id/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/projects/:id/pianificazione" element={<ProtectedRoute><Pianificazione /></ProtectedRoute>} />
          <Route path="/projects/:id/gantt" element={<ProtectedRoute><Gantt /></ProtectedRoute>} />
          <Route path="/projects/:id/avanzamento" element={<ProtectedRoute><Avanzamento /></ProtectedRoute>} />
          <Route path="/resources" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          {/* Legacy redirects */}
          <Route path="/projects/:id/baseline" element={<Navigate to="../pianificazione" replace />} />
          <Route path="/projects/:id/allocation" element={<Navigate to="../pianificazione" replace />} />
          {/* Default */}
          <Route path="/" element={<Navigate to="/projects" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

### Route Structure

| Route | Component | Protected | Notes |
|---|---|---|---|
| `/login` | Login | ❌ | Supabase Auth + mock fallback |
| `/projects` | Projects | ✅ | List projects for current user |
| `/projects/:id/dashboard` | Dashboard | ✅ | KPIs + phase budget + milestones |
| `/projects/:id/pianificazione` | Pianificazione | ✅ | Two tabs: Fasi (baseline) + Risorse (allocation matrix) |
| `/projects/:id/gantt` | Gantt | ✅ | Interactive Gantt chart |
| `/projects/:id/avanzamento` | Avanzamento | ✅ | Actuals tracking + Keyedin sync |
| `/resources` | Resources | ✅ | Resource registry + utilization |
| `/settings` | Settings | ✅ | User profile, preferences |

**Legacy Redirects:** Old routes (`/projects/:id/baseline`, `/allocation`, `/ongoing`) redirect to the new unified `/pianificazione` and `/avanzamento` routes.

---

## Authentication & Context

### `src/contexts/AuthContext.tsx`

Centralized auth state management via React Context.

```typescript
interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => 
    localStorage.getItem('token')
  );
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  // Supabase auth state listener
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          // Clear local state
          setToken(null);
          setUser(null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
        if (event === 'TOKEN_REFRESHED' && session) {
          // Update token in localStorage and state
          localStorage.setItem('token', session.access_token);
          setToken(session.access_token);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const setAuth = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
```

**How it works:**
1. On app load, token + user are restored from localStorage
2. Supabase `onAuthStateChange` listener watches for login/logout/token refresh events
3. Components use `useAuth()` hook to access token, user, and auth methods
4. Token is automatically included in all API requests via `apiClient()`

### `src/components/ProtectedRoute.tsx`

Wrapper to guard routes requiring authentication:

```typescript
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}
```

---

## API Layer

### `src/api/client.ts`

Centralized fetch wrapper with Bearer token auth:

```typescript
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // Handle 401 — session expired
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}
```

**Key features:**
- Reads `VITE_API_URL` from environment (defaults to `http://localhost:3000`)
- Automatically adds `Authorization: Bearer <token>` header
- 401 responses trigger logout + redirect to /login
- Generic type `T` for response payload
- Throws descriptive errors on failures

### API Modules

Each domain has its own API module in `src/api/`:

| Module | Endpoints | Exports |
|---|---|---|
| `auth.ts` | POST /api/auth/login, logout | `login()`, `logout()` |
| `projects.ts` | GET/POST/PUT /api/projects | `getProjects()`, `getProject()`, `createProject()`, etc. |
| `baseline.ts` | GET/POST /api/baseline | `fetchBaseline()`, `saveBaseline()`, `lockBaseline()` |
| `allocation.ts` | GET/PUT /api/allocations | `fetchAllocation()`, `saveAllocationPhase()`, etc. |
| `ongoing.ts` | GET/POST /api/ongoing | `fetchOngoing()`, `recordSnapshot()`, `syncKeyedin()` |
| `gantt.ts` | GET/POST /api/gantt | `fetchGanttData()`, `createTask()` |
| `resources.ts` | GET/POST /api/resources | `fetchResources()`, `createResource()` |
| `dashboard.ts` | GET /api/dashboard | `fetchDashboard()` |

**Example: `src/api/projects.ts`**
```typescript
import { apiClient } from './client';
import type { ProjectSummary, ProjectDetail } from '../types';

export async function getProjects(): Promise<ProjectSummary[]> {
  return apiClient('/api/projects');
}

export async function getProject(id: number): Promise<ProjectDetail> {
  return apiClient(`/api/projects/${id}`);
}

export async function createProject(data: { name: string; ... }): Promise<ProjectDetail> {
  return apiClient('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

---

## Component Structure

### Component Organization

```
src/components/
├── AppNav.tsx              # Top navigation bar
├── ProtectedRoute.tsx      # Route guard for auth
├── FTECell.tsx             # Editable FTE allocation cell
├── RAGBadge.tsx            # RAG status indicator
├── BudgetBar.tsx           # Budget progress bar
├── DateInput.tsx           # Date picker
├── ConfirmModal.tsx        # Confirmation dialog
```

### Reusable UI Components

#### `AppNav.tsx`
Top navigation with logo, project/section title, user menu, logout button.

```typescript
interface AppNavProps {
  title?: string;        // Page title
  projectName?: string;  // Project name (if on project page)
}

export default function AppNav({ title, projectName }: AppNavProps) {
  // Renders with user menu + logout
}
```

#### `RAGBadge.tsx`
Visual indicator for RAG status.

```typescript
interface RAGBadgeProps {
  status: RAGStatus;     // 'IN_LINEA' | 'A_RISCHIO' | 'FUORI_BUDGET'
  showLabel?: boolean;
}

export default function RAGBadge({ status, showLabel }: RAGBadgeProps) {
  // Returns colored badge with icon
}
```

#### `FTECell.tsx`
Editable cell for FTE allocation in the resource matrix.

```typescript
interface FTECellProps {
  value: number;
  onEdit: (newValue: number) => void;
  maxAllowable?: number;  // For validation
  isLocked?: boolean;
}

export default function FTECell({ value, onEdit, maxAllowable, isLocked }: FTECellProps) {
  // Clickable cell, switches to input on edit
}
```

#### `BudgetBar.tsx`
Horizontal progress bar showing budget vs. spent.

```typescript
interface BudgetBarProps {
  spent: number;
  total: number;
  forecastColor?: string;  // Color based on RAG
}

export default function BudgetBar({ spent, total, forecastColor }: BudgetBarProps) {
  // Bar with labels showing %, remaining, etc.
}
```

#### `DateInput.tsx`
Date picker field for phase start/end dates.

```typescript
interface DateInputProps {
  value: string;         // ISO date string
  onChange: (date: string) => void;
  disabled?: boolean;
}

export default function DateInput({ value, onChange, disabled }: DateInputProps) {
  // HTML input[type="date"] with custom styling
}
```

#### `ConfirmModal.tsx`
Modal dialog for confirm/cancel actions.

```typescript
interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  isDangerous?: boolean;  // Red button for destructive actions
}

export default function ConfirmModal({
  title, message, confirmText, cancelText, onConfirm, onCancel, isLoading, isDangerous
}: ConfirmModalProps) {
  // Modal with confirm/cancel buttons
}
```

---

## Pages & Features

### `pages/Login.tsx`

Authentication entry point with Supabase + mock fallback.

**Features:**
- Email + password form
- Supabase Auth integration
- Mock mode bypass (VITE_USE_MOCK=true)
- Redirect to /projects on successful login

**State:**
- Email, password (form inputs)
- Loading state
- Error message

### `pages/Projects.tsx`

List of projects owned by the current PM.

**Features:**
- Table of all projects
- Status badge (active/on_hold/closed/archived)
- RAG status badge
- Click to enter project dashboard
- Create new project button

**State:**
- Projects list
- Loading state
- Error handling

### `pages/Dashboard.tsx`

Project overview with KPIs, phase budget, and milestone tracker.

**Sections:**
1. **KPI Cards** — Budget, revised forecast, burn rate, variance, RAG status
2. **Phase Budget Table** — Per-phase breakdown (budget, spend, %, burn rate)
3. **Milestone Tracker** — Planned vs. actual dates, status

**State:**
- Dashboard data (KPIs, phase budgets, milestones)
- Loading state
- Last sync timestamp

**Sub-navigation:** Links to Pianificazione, Gantt, Avanzamento

### `pages/Pianificazione.tsx`

Unified page for baseline definition and resource allocation.

**Two tabs:**

#### Fasi (Phases)
- Phase names (inline editable)
- Planned start/end dates
- Working days, planned hours (calculated)
- Phase budget (sum of allocations)
- Contingency % (editable)
- Total budget and forecast
- Save and Lock Baseline buttons
- Lock status indicator

**State:**
- Phases data
- Edit mode (name, dates, contingency)
- Save loading state
- Lock modal open/closed

#### Risorse (Resources)
- Resource × Phase × Week matrix
- FTE allocation cells (editable)
- Weekly cost calculated from day_rate × fte × working_days
- Warnings for FTE cap breaches
- Add new resource button
- Save allocation updates

**State:**
- Allocation matrix
- Weeks in range (calculated from phase dates)
- Edit mode per cell
- Warnings from canAllocate() service
- Loading state

### `pages/Gantt.tsx`

Interactive Gantt chart with three collapsible views.

**Three views:**
1. **Project Timeline** — Horizontal bar per phase
2. **Resource Utilization** — Resource rows with allocation density
3. **Milestones** — Planned vs. actual dates

**Features:**
- Collapsible sections
- Zoom controls (week/month view)
- Current date indicator
- Drag to resize (coming soon)

**State:**
- Gantt data (phases, resources, tasks)
- Expanded views
- Zoom level

### `pages/Avanzamento.tsx`

Actual cost/hours tracking with Keyedin sync button.

**Sections:**
1. **Latest Snapshot** — Summary of hours, cost, days
2. **Manual Entry Form** — Record new actuals
3. **Sync with Keyedin** — Pull from external API
4. **History** (coming soon) — Timeline of snapshots

**Features:**
- Manual snapshot recording
- Keyedin API sync button (if configured)
- Last sync timestamp + source badge
- Fallback to manual when API unavailable

**State:**
- Current snapshot
- Manual form inputs
- Sync loading/error state
- Sync history

### `pages/Resources.tsx`

Centralized resource registry with utilization dashboard.

**Features:**
- Table of all resources (name, day rate, utilization)
- Week-by-week utilization chart
- Add new resource dialog
- FTE warnings (cross-project)

**State:**
- Resources list
- Selected week for utilization view
- New resource form (modal)
- Loading state

### `pages/Settings.tsx`

User profile and project settings.

**Features:**
- User profile display
- Password change (if Supabase enabled)
- Project settings (phase templates, etc.)
- Logout button

---

## State Management

### Philosophy

**No global state manager** (Redux, Zustand, etc.). State lives at the **smallest necessary scope**:

1. **Component-local state** — `useState()` for form inputs, UI state
2. **Page-level state** — `useState()` lifted to page component, passed via props
3. **Auth context** — Global `AuthContext` only (minimal)
4. **Server state** — Fetched on demand, no caching (keep it simple)

### Example: Page with Form State

```typescript
export default function Pianificazione() {
  const { id } = useParams();
  const [phases, setPhases] = useState<PhaseState[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await fetchBaseline(id);
      setPhases(data.phases);
      setIsLocked(data.is_locked);
    };
    load();
  }, [id]);

  const handleUpdatePhase = (idx: number, field: string, val: string) => {
    setPhases(prev => {
      const next = [...prev];
      next[idx][field] = val;
      return next;
    });
  };

  const handleSave = async () => {
    setSaveLoading(true);
    try {
      await saveBaseline(id, { phases });
      // Show success
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <FasiTab
      phases={phases}
      isLocked={isLocked}
      onUpdatePhase={handleUpdatePhase}
      onSave={handleSave}
      saveLoading={saveLoading}
    />
  );
}
```

### Why Not Redux?

- **Overkill for POC** — Data model is simple, pages are mostly isolated
- **Fewer dependencies** — Leaner bundle
- **Easier testing** — Components take props, no mock store
- **Future-proof** — Can migrate to Zustand or TanStack Query later if needed

---

## Styling & Theme

### Tailwind CSS Configuration

**File:** `tailwind.config.js`

```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: '#0f0f1a',           // Main background
        surface: '#1a1a2e',        // Card/panel background
        'surface-2': '#16213e',    // Darker variant
        'surface-3': '#0f3460',    // Even darker
        accent: '#6c63ff',         // Purple primary accent
        'accent-cyan': '#00d4ff',  // Cyan accent
        'rag-green': '#22c55e',    // Green (In Line)
        'rag-yellow': '#eab308',   // Yellow (At Risk)
        'rag-red': '#ef4444',      // Red (Out of Budget)
        'text-primary': '#e2e8f0', // Main text
        'text-muted': '#94a3b8',   // Secondary text
        'text-dim': '#8896aa',     // Tertiary text (low contrast)
        border: '#2d2d4e',         // Borders
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-accent': '0 0 24px rgba(108, 99, 255, 0.2)',
        'glow-cyan': '0 0 24px rgba(0, 212, 255, 0.15)',
        card: '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
}
```

### Usage Patterns

**Dark-themed containers:**
```jsx
<div className="bg-base">              {/* Page background */}
  <div className="bg-surface">         {/* Card/panel */}
    <div className="bg-surface-2">     {/* Nested section */}
    </div>
  </div>
</div>
```

**Text hierarchy:**
```jsx
<h1 className="text-primary">Heading</h1>
<p className="text-muted">Secondary</p>
<span className="text-dim">Tertiary</span>
```

**RAG status colors:**
```jsx
<span className="bg-rag-green text-base">In Line</span>
<span className="bg-rag-yellow text-base">At Risk</span>
<span className="bg-rag-red text-base">Out of Budget</span>
```

**Buttons:**
```jsx
{/* Primary (accent) */}
<button className="bg-accent text-white hover:bg-accent-hover">Action</button>

{/* Secondary (surface) */}
<button className="bg-surface border border-accent hover:bg-surface-2">Secondary</button>

{/* Danger (red) */}
<button className="bg-rag-red/20 border border-rag-red text-rag-red hover:bg-rag-red/30">Delete</button>
```

## Testing & Mocks

### Test Setup

**File:** `src/test/setup.ts`

Vitest configuration + DOM testing utilities:

```typescript
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

afterEach(() => cleanup());

// Mock window.matchMedia for responsive tests (coming soon)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

### Mock Data

**File:** `src/mocks/mockData.ts`

Realistic mock data for UI development without backend:

```typescript
export const mockProjects: ProjectSummary[] = [
  {
    id: 1,
    name: 'Project A',
    status: 'active',
    rag_status: 'IN_LINEA',
    budget_total: 100000,
    budget_spent: 45000,
    ...
  },
  // ...
];

export const mockResources = [ ... ];
export const mockAllocation = { ... };
```

### Mock Mode

Set `VITE_USE_MOCK=true` in `frontend/.env.local` to:
- Bypass all API calls
- Use `mockData.ts` instead
- Mock token: `mock-jwt-token-dev`

This is useful for:
- UI development when backend is down
- Testing without flaky network
- Designing new components

### Writing Tests

**Example: `utils/networkDays.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { networkDays, weeksInRange } from './networkDays';

describe('networkDays', () => {
  it('calculates working days excluding weekends', () => {
    // Mon Jan 6 to Fri Jan 10 = 5 days
    expect(networkDays('2025-01-06', '2025-01-10')).toBe(5);
  });

  it('excludes public holidays', () => {
    // Mon Jan 1 is New Year (holiday) = 4 working days
    expect(networkDays('2025-01-01', '2025-01-05')).toBe(4);
  });
});
```

**Running tests:**
```bash
cd frontend
pnpm test           # Run all tests
pnpm test --watch   # Watch mode
pnpm test --ui      # Vitest UI (browser)
```

---

## Development Workflow

### Adding a New Page

1. **Create page component** in `src/pages/FeatureName.tsx`
2. **Add route** in `App.tsx`
3. **Create API module** in `src/api/feature.ts` (if needed)
4. **Add types** to `src/types/index.ts`
5. **Implement component** with useState, fetch calls, render
6. **Add to AppNav** if it's a main section

### Adding a Reusable Component

1. **Create component** in `src/components/ComponentName.tsx`
2. **Export from** `src/components/index.ts` (optional)
3. **Define props interface**
4. **Write JSX** with Tailwind styling
5. **Add tests** if complex

### Debugging

**Console logging:**
```typescript
console.log('Debug:', phases); // Simple logging
console.table(resources);      // Table format
```

**React DevTools browser extension:**
- Inspect component props
- Step through useState updates
- Profile render performance

**Network tab in DevTools:**
- Check API requests (headers, payloads, responses)
- Verify Bearer token in Authorization header

---

## Deployment

### Development Build

```bash
cd frontend
pnpm run build   # Outputs to dist/
pnpm run preview # Preview built app locally (http://localhost:4173)
```

### Production Deployment (Vercel)

**Automatic:**
1. Push to main branch
2. Vercel webhook triggers
3. Builds `vite build`
4. Deploys to Vercel URL

**Environment variables set on Vercel dashboard:**
```
VITE_API_URL=/api
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
```

**Routing:**
- `/api/*` → Serverless backend
- `/*` → Static frontend files

See `vercel.json` for detailed config.

### Performance Optimization

Current:
- Vite does tree-shaking (unused code removed)
- React 18 automatic batching
- Dark theme reduces energy on modern screens

Future:
- Code-split pages with React.lazy + Suspense
- Image optimization
- Service Worker for offline
- Lighthouse optimization

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|---|---|---|
| 401 after login | Token not saved | Check localStorage, verify apiClient() adds Authorization header |
| API 404 errors | VITE_API_URL wrong | Set `VITE_API_URL=http://localhost:3000` or `http://your-backend-url` |
| Mock data not loading | VITE_USE_MOCK not set | Add `VITE_USE_MOCK=true` to `.env.local` |
| Form not updating | Forgot setState | Use functional setState: `setPhases(prev => ([...prev, newItem]))` |
| Component not rendering | Missing key in list | Add `key` prop to list items: `<div key={item.id}>` |
| Tailwind classes not working | Build issue | Run `pnpm install && pnpm run build` |

---

## References

- **Type Definitions:** `src/types/index.ts`
- **API Client:** `src/api/client.ts`
- **Auth Context:** `src/contexts/AuthContext.tsx`
- **Example Page:** `src/pages/Dashboard.tsx`
- **Theme Config:** `tailwind.config.js`
- **Vite Config:** `vite.config.ts`

See `CLAUDE.md` for full project conventions and decision rationale.
