# Project Forecast App

A modern web application for project budget forecasting, resource allocation, and progress tracking. Designed for Project Managers (PMs) and Delivery Managers (DMs) to replicate and extend the functionality of Project Forecast v16 Excel spreadsheet into a collaborative, real-time platform.

## Overview

Project Forecast App is a **POC (Proof of Concept)** web application that helps teams:

- **Plan project budgets** across multiple phases with BAC (Budget at Completion) tracking
- **Allocate resources** by week with FTE (Full-Time Equivalent) management
- **Track progress** with ongoing actuals from manual entry or Keyedin API integration
- **Visualize timelines** with interactive Gantt charts and milestones
- **Monitor health** with RAG (Red-Amber-Green) status and financial variances

Target deployment platform: **Vercel** (serverless backend + static frontend).

---

## Key Features

### 1. Project Management
- Create and manage multiple projects with status tracking (active/on_hold/closed/archived)
- 5-phase structure: Feasibility → Planning & Design → Build → Deployment → Closure
- Customizable phase names and contingency percentages per project
- Share-token support for read-only project access

### 2. Financial Forecasting
- **Budget Baseline** - Lock project budget at a specific point in time (BAC)
- **Weekly Cost Tracking** - Allocate resources week-by-week with automatic cost calculation
- **Revised Forecast** - Time-based and cost-based forecast averaging
- **Budget Variance** - Compare working budget against baseline snapshot
- **RAG Status** - Automatic health indicator:
  - Green (IN_LINEA): <= 105% of BAC
  - Amber (A_RISCHIO): <= 115% of BAC
  - Red (FUORI_BUDGET): > 115% of BAC

### 3. Resource Management
- Centralized resource registry with day rates
- Cross-project FTE capacity planning (1.0 max per resource per week)
- Allocation matrix view for phase-by-phase resource assignment
- Live resource utilization dashboard

### 4. Progress Tracking
- **Ongoing Snapshots** - Record actuals (hours, costs, working days spent)
- **Keyedin Integration** - Optional sync with Keyedin API for real project data
- **Manual Fallback** - Always-available manual data entry mode
- **Phase-level granularity** - Track actuals per phase (coming soon)

### 5. Gantt & Milestones
- Interactive Gantt chart with task dependencies
- Milestone tracking with planned vs. actual dates
- Phase-based timeline visualization

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend** | React 18 + Vite + TypeScript | 18.x / 5.x |
| **Backend** | Node.js + Express | 20.x / 4.x |
| **Database** | PostgreSQL | 16.x |
| **Authentication** | Supabase Auth | Latest |
| **Styling** | Tailwind CSS (dark theme) | 3.x |
| **Monorepo** | pnpm + NX | Latest |
| **Testing** | Jest (BE), Vitest (FE) | Latest |
| **Deployment** | Vercel | - |

---

## Quick Start

### Prerequisites
- **Node.js** 20.x or higher
- **pnpm** as package manager
- **Docker** & **Docker Compose** for local PostgreSQL

### 1. Clone & Install

```bash
git clone <repo-url>
cd project-forecast-app
pnpm install
```

### 2. Set Up Local Database

```bash
# Start PostgreSQL container
pnpm db:up

# Run migrations (automatic)
pnpm migrate

# (Optional) Seed with demo data
pnpm seed
```

### 3. Configure Environment Variables

**Backend** (`backend/.env`):
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/project_forecast
PORT=3000
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

**Frontend** (`frontend/.env.local`):
```
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_USE_MOCK=true  # Use mock data when backend is down
```

### 4. Run Development Servers

```bash
# All in one (frontend + backend)
pnpm dev

# Or separately:
# Terminal 1 - Backend (port 3000)
cd backend && pnpm dev

# Terminal 2 - Frontend (port 5173)
cd frontend && pnpm dev
```

### 5. Login

- Visit http://localhost:5173
- Use Supabase credentials or mock user (if `VITE_USE_MOCK=true`)
- Mock token: `mock-jwt-token-dev`

---

## Project Structure

```
project-forecast-app/
├── backend/                        # Node.js + Express API
│   ├── src/
│   │   ├── index.ts               # Express entry point
│   │   ├── db/                    # PostgreSQL pool + migrations
│   │   ├── routes/                # API endpoints (projects, phases, allocations, etc.)
│   │   ├── services/              # Business logic (computations, RAG, validations)
│   │   └── routes.test.ts         # Integration tests
│   └── package.json
│
├── frontend/                       # React + Vite SPA
│   ├── src/
│   │   ├── App.tsx                # Router + Auth context
│   │   ├── pages/                 # Feature pages (Dashboard, Pianificazione, Gantt, etc.)
│   │   ├── api/                   # API client modules
│   │   ├── components/            # Reusable UI components
│   │   ├── types/index.ts         # Shared domain types
│   │   └── utils/                 # Utilities (date calculations, helpers)
│   └── package.json
│
├── docker-compose.yml             # PostgreSQL 16 service
├── vercel.json                    # Vercel deployment config
├── nx.json                        # NX monorepo config
└── docs/                          # Technical documentation
```

---

## Core Concepts

### Budget at Completion (BAC)
When a project baseline is locked, we capture a snapshot of:
- Total budget across all phases
- Phase-by-phase breakdown (costs, working days)
- Contingency percentages per phase

This snapshot is **immutable** and used for variance calculations. The working budget (current allocations) evolves independently.

### Weekly Cost Materialization
Allocation costs are calculated and stored at insert time:
```
weekly_cost = day_rate × fte × working_days_in_week
```

This ensures fast query performance and historical accuracy.

### FTE Capacity & Allocation
- Each resource can be allocated **max 1.0 FTE per week**
- FTE is enforced across **all projects** (global resource pool)
- The `AllocationAggregator` service maintains single source of truth for utilization

### RAG Status
Health status is determined by comparing forecasted cost against BAC:
```
If revised_forecast / BAC <= 1.05  -> IN_LINEA (green)
If revised_forecast / BAC <= 1.15  -> A_RISCHIO (amber)
Otherwise                          -> FUORI_BUDGET (red)
```

---

## API Overview

Base URL: `http://localhost:3000/api`

### Key Endpoints

**Projects**
- `GET /projects` - List all projects for user
- `POST /projects` - Create new project
- `GET /projects/:id` - Get project detail
- `PUT /projects/:id` - Update project

**Budget & Baseline**
- `GET /projects/:id/baseline` - Get baseline snapshot
- `POST /projects/:id/baseline/lock` - Lock baseline (capture BAC)

**Resource Allocation**
- `GET /projects/:id/allocations` - Get allocation matrix
- `PUT /projects/:id/allocations` - Create/update allocation entry
- `GET /resources` - List all resources (with utilization)

**Progress Tracking**
- `GET /projects/:id/ongoing` - Get latest snapshot
- `POST /projects/:id/ongoing` - Record new snapshot
- `POST /projects/:id/ongoing/sync-keyedin` - Sync from Keyedin API

**Gantt & Tasks**
- `GET /projects/:id/gantt` - Get Gantt data
- `POST /projects/:id/gantt/tasks` - Create task/milestone

**Dashboard**
- `GET /projects/:id/dashboard` - Get KPIs + phase budgets

---

## Database Schema

Core tables:

| Table | Purpose |
|---|---|
| `User` | PM/DM accounts with Supabase auth mapping |
| `Project` | Project metadata (pm_id, status, keyedin_code, share_token) |
| `ProjectPhase` | 5 sequential phases per project |
| `Resource` | Central registry of team members with day rates |
| `AllocationEntry` | Weekly resource × phase allocations with costs |
| `Baseline` | Locked BAC snapshot + financial variance tracking |
| `OngoingSnapshot` | Actuals: hours/costs/days spent (manual or Keyedin) |
| `GanttTask` | Tasks and milestones per phase |
| `PublicHoliday` | Italy 2025-2027 holiday calendar (NETWORKDAYS) |
| `PhaseTemplate` | System defaults for new-project phase setup |

See `docs/DATA_MODEL.md` for full schema documentation.

---

## Development Workflow

### Adding a New Feature

1. **Create route** in `backend/src/routes/feature.ts`
2. **Add types** to `frontend/src/types/index.ts`
3. **Create API client** in `frontend/src/api/feature.ts`
4. **Build UI** in `frontend/src/pages/Feature.tsx`
5. **Write tests** alongside (routes.test.ts, computations.test.ts)
6. **Update CLAUDE.md** if architecture changes

### Adding a Migration

1. Create `backend/src/db/migrations/0NN_description.sql`
2. Run `pnpm migrate` (auto-tracks executed migrations)
3. Update types if needed

### Testing

```bash
# Backend tests
cd backend && pnpm test

# Frontend tests
cd frontend && pnpm test

# Watch mode
pnpm run test:watch
```

---

## Deployment

### Vercel Deployment

1. Push to main branch
2. Vercel auto-deploys via webhook
3. Frontend served as static site
4. Backend runs as serverless functions under `/api/*`

See `vercel.json` for configuration.

### Environment Variables (Vercel)

Set these in Vercel project settings:
- `DATABASE_URL` - Production PostgreSQL connection
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_API_URL` - Should be `/api` on Vercel

---

## Roadmap

Current focus areas (see `NEXT_STEPS.md` for detailed status):

| Step | Description | Status |
|---|---|---|
| D | FTE cap enforcement on PUT /allocation | In progress |
| E | `phase_id` on `OngoingSnapshot` | Planned |
| F | Phase-level Financial Engine | Planned |
| G | day_rate cascade on cost updates | Planned |
| H | Auth middleware + pm_id filtering | In progress |
| J | Re-baselining with versioning | Future |

---

## Documentation

- **CLAUDE.md** - Single source of truth for architecture decisions and conventions
- **docs/DATA_MODEL.md** - PostgreSQL schema, relationships, and design rationale
- **docs/API.md** - Detailed API endpoint reference (coming soon)
- **docs/CONVENTIONS.md** - Code style, naming, error handling patterns
- **ARCHITECTURE_AS_IS.md** - Current implementation status and known issues
- **NEXT_STEPS.md** - Development roadmap with priorities

---

## Support & Contributing

For issues or feature requests:
1. Check existing issues in the repository
2. Review `CLAUDE.md` for architecture decisions
3. Follow conventions in `docs/CONVENTIONS.md`
4. Run tests before submitting PRs

---

## License

Internal project - Gennaro Cesaro 2026

---

## FAQ

**Q: Can I use this with a different database?**
A: Currently PostgreSQL only. Migration to other databases would require refactoring queries in routes and the `pg` pool abstraction.

**Q: How do I enable Keyedin API sync?**
A: Set `KEYEDIN_API_URL` and `KEYEDIN_API_KEY` in backend `.env`. See `services/ongoing/KeyedinApiProvider.ts`.

**Q: What's the FTE cap?**
A: Max 1.0 FTE per resource per week across all projects. Enforced by `AllocationAggregator.canAllocate()`.

**Q: How does RAG status work?**
A: Compares revised forecast to locked BAC. Green <=105%, Amber <=115%, Red >115%. See `computations.ts`.

