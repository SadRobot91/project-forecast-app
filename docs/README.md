# Documentation Index — Project Forecast App

Complete documentation library for the Project Forecast App. Use this index to navigate to the right resource for your needs.

## Quick Navigation

### For Getting Started
- **[README.md](../README.md)** (root) — High-level overview, tech stack, quick start, and core concepts
- **[DEVELOPMENT.md](DEVELOPMENT.md)** — Environment setup, running locally, common workflows, debugging

### For Architecture & Design
- **[CLAUDE.md](../CLAUDE.md)** — Single source of truth for architecture decisions and conventions
- **[ARCHITECTURE_AS_IS.md](../ARCHITECTURE_AS_IS.md)** — Current implementation status, data flow diagrams, open issues
- **[frontend-architecture.md](frontend-architecture.md)** — React 18 + Vite frontend structure, components, state management
- **[backend-architecture.md](backend-architecture.md)** — Express routes, services layer, database patterns, testing

### For API Integration
- **[API.md](API.md)** — Complete REST API reference with all endpoints, request/response formats, error codes

### For Project Management
- **[NEXT_STEPS.md](../NEXT_STEPS.md)** — Roadmap with priorities, step descriptions, and current status
- **[AGENTS.md](../AGENTS.md)** — Original design document and feature specification

---

## By Role

### Frontend Developer
1. [README.md](../README.md) — Project overview
2. [DEVELOPMENT.md](DEVELOPMENT.md) — Setup and first run
3. [frontend-architecture.md](frontend-architecture.md) — Component structure, styling, state management
4. [API.md](API.md) — Understanding available endpoints
5. [CLAUDE.md](../CLAUDE.md) — Conventions and naming

### Backend Developer
1. [README.md](../README.md) — Project overview
2. [DEVELOPMENT.md](DEVELOPMENT.md) — Setup and first run
3. [backend-architecture.md](backend-architecture.md) — Routes, services, database
4. [API.md](API.md) — API design and response formats
5. [CLAUDE.md](../CLAUDE.md) — Conventions and error handling

### Full-Stack Developer
1. [README.md](../README.md) — Comprehensive overview
2. [DEVELOPMENT.md](DEVELOPMENT.md) — Setup, running locally
3. [ARCHITECTURE_AS_IS.md](../ARCHITECTURE_AS_IS.md) — Current state and issues
4. [NEXT_STEPS.md](../NEXT_STEPS.md) — Understanding priorities
5. [frontend-architecture.md](frontend-architecture.md) & [backend-architecture.md](backend-architecture.md) — As needed

### Product Manager / Stakeholder
1. [README.md](../README.md) — Feature list and overview
2. [NEXT_STEPS.md](../NEXT_STEPS.md) — Roadmap and priorities
3. [ARCHITECTURE_AS_IS.md](../ARCHITECTURE_AS_IS.md) → "Open Issues" section

---

## File Structure

```
docs/
├── README.md                    (this file — documentation index)
├── DEVELOPMENT.md               (practical how-to guide: setup, workflows, debugging)
├── API.md                       (complete API reference for all endpoints)
├── frontend-architecture.md     (React/Vite structure, components, styling)
├── backend-architecture.md      (Express patterns, services, database, testing)
```

### Root Level Documents
- **[README.md](../README.md)** — Project overview and quick start
- **[CLAUDE.md](../CLAUDE.md)** — Architecture decisions and development conventions
- **[ARCHITECTURE_AS_IS.md](../ARCHITECTURE_AS_IS.md)** — Current state and technical deep-dive
- **[NEXT_STEPS.md](../NEXT_STEPS.md)** — Development roadmap with priorities
- **[AGENTS.md](../AGENTS.md)** — Original design specification

---

## Quick Answers

**How do I set up the project locally?**
→ [DEVELOPMENT.md](DEVELOPMENT.md) → "Environment Setup"

**How do I understand the codebase?**
→ [ARCHITECTURE_AS_IS.md](../ARCHITECTURE_AS_IS.md) → "Data Flow"

**How do I add a new feature?**
→ [DEVELOPMENT.md](DEVELOPMENT.md) → "Common Tasks"

**How do I call an API endpoint?**
→ [API.md](API.md) (find the endpoint, then check `frontend/src/api/` for example)

**What's the current status / roadmap?**
→ [NEXT_STEPS.md](../NEXT_STEPS.md)

**How do I debug something?**
→ [DEVELOPMENT.md](DEVELOPMENT.md) → "Debugging & Troubleshooting"

**How do I add a React component?**
→ [frontend-architecture.md](frontend-architecture.md) → "Component Structure"

**How do I understand the styling?**
→ [frontend-architecture.md](frontend-architecture.md) → "Styling & Theme"

---

## Key Concepts

| Concept | Explanation | Find It |
|---|---|---|
| **BAC** | Budget at Completion — locked baseline | [ARCHITECTURE_AS_IS.md](../ARCHITECTURE_AS_IS.md) |
| **FTE** | Full-Time Equivalent allocation unit (0.0–1.0) | [backend-architecture.md](backend-architecture.md) |
| **RAG Status** | Red-Amber-Green health indicator (IN_LINEA/A_RISCHIO/FUORI_BUDGET) | [ARCHITECTURE_AS_IS.md](../ARCHITECTURE_AS_IS.md) |
| **Weekly Cost** | Calculated at allocation: day_rate × fte × working_days | [ARCHITECTURE_AS_IS.md](../ARCHITECTURE_AS_IS.md) |
| **Provider Pattern** | Keyedin API with fallback | [backend-architecture.md](backend-architecture.md) |

---

## Document Maintenance

Last updated: June 8, 2026

All documents reflect the current state of the `main` branch.

## Key Concepts

### Layered Architecture
```
HTTP Request → Express Router → Service → Database → PostgreSQL
```
Each layer has a single responsibility. Services are testable in isolation via dependency injection.

### Single Source of Truth
- **AllocationEntry** table ← only place allocations are stored
- **AllocationAggregator service** ← only place to sum FTE per (resource, week)
- **phaseFinancialEngine service** ← only place to compute phase-level EAC
- **OngoingSnapshot** ← only place to store actuals

This prevents data drift and makes computations reliable.

### Testing
- **Unit tests** in `services/*.test.ts` — pure functions, no database
- **Integration tests** in `routes/routes.test.ts` — mocked database, Supertest
- Run with `pnpm test --runInBand` to avoid race conditions

### Authentication
- **Supabase Auth** for user login/logout
- **Bearer tokens** for API requests
- **middleware/requireAuth.ts** validates tokens and looks up user in local DB
- Supabase is **only** for auth, not for data queries

## Quick Reference

### Run Backend
```bash
cd backend
pnpm install
pnpm run dev          # Port 3000
pnpm test
pnpm run migrate      # Apply database migrations
pnpm run seed         # Seed sample data
```

### Run Frontend
```bash
cd frontend
pnpm install
pnpm run dev          # Port 5173
pnpm test
```

### Database
```bash
# Local PostgreSQL via Docker
docker-compose up -d

# Apply migrations
cd backend && pnpm run migrate

# Check schema
psql $DATABASE_URL -c "\dt"
```

## Common Questions

**Q: Where do I add a new route?**
A: Create `backend/src/routes/myFeature.ts`, mount it in `index.ts`, add types to `frontend/src/types/index.ts`.

**Q: How do I test a service?**
A: Write unit tests in `services/myService.test.ts` with a mocked query function via dependency injection.

**Q: How do I add a database migration?**
A: Create `backend/src/db/migrations/00N_description.sql`, then run `cd backend && pnpm run migrate`.

**Q: How do FTE caps work?**
A: The `AllocationAggregator.canAllocate()` service checks if (resource, week) would exceed 1.0 FTE. Routes use this to reject allocations (409 Conflict). See Step D in NEXT_STEPS.md.

**Q: Why are calculations per-phase important?**
A: Step F (Phase Financial Engine) will compute EAC, variance, and budget remaining per phase. This gives PMs visibility into which phases are at risk.

## Links

- **[Main README](../README.md)** — Project overview and quick start
- **[CLAUDE.md](../CLAUDE.md)** — Project context and LLM instructions
- **[NEXT_STEPS.md](../NEXT_STEPS.md)** — Roadmap
- **[GitHub Repo](https://github.com/...)** — Source code

---

Last updated: 2025-01-15
