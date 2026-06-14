# Documentation Index

Welcome! This folder contains technical documentation for the Project Forecast App. Below is a guide to each document and when to read it.

---

## Quick Navigation

| Document | Audience | Length | Purpose |
|----------|----------|--------|---------|
| **[README.md](../README.md)** | Everyone | 10 min | Project overview, quick start, tech stack |
| **[AUTH.md](AUTH.md)** | Backend devs, DevOps | 20 min | Authentication flow, Supabase setup, user provisioning |
| **[KEYEDIN_INTEGRATION.md](KEYEDIN_INTEGRATION.md)** | Backend devs | 25 min | Keyedin API provider pattern, sync workflow, configuration |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | DevOps, Backend devs | 30 min | Vercel setup, database deployment, monitoring, scaling |
| **[API_PATTERNS.md](API_PATTERNS.md)** | Backend devs | 25 min | Route patterns, service layer, error handling, testing |

---

## Getting Started

### "I'm new to the project — where do I start?"

1. Read **[README.md](../README.md)** (project overview, 10 min)
2. Follow **Quick Start** section
3. Explore the codebase structure
4. Read focus area doc(s) below based on your role

### "I'm a backend developer"

Start here:
1. **[README.md](../README.md)** — Overview
2. **[API_PATTERNS.md](API_PATTERNS.md)** — How to write routes and services
3. **[AUTH.md](AUTH.md)** — How auth and authorization work
4. **[KEYEDIN_INTEGRATION.md](KEYEDIN_INTEGRATION.md)** — Optional: if working on Keyedin sync
5. **[DEPLOYMENT.md](DEPLOYMENT.md)** — When ready to deploy

### "I'm a frontend developer"

Start here:
1. **[README.md](../README.md)** — Overview
3. **[AUTH.md](AUTH.md)** — How to integrate login/logout (frontend side)
4. **[API_PATTERNS.md](API_PATTERNS.md)** — API structure (for integration)
5. **[DEPLOYMENT.md](DEPLOYMENT.md)** — When deploying to Vercel

### "I'm DevOps / Platform engineer"

Start here:
1. **[README.md](../README.md)** — Overview
2. **[DEPLOYMENT.md](DEPLOYMENT.md)** — Vercel, database, monitoring
3. **[AUTH.md](AUTH.md)** — Supabase setup and user provisioning
4. **[KEYEDIN_INTEGRATION.md](KEYEDIN_INTEGRATION.md)** — Optional external API config

### "I'm a product manager / stakeholder"

Start here:
1. **[README.md](../README.md)** — What the app does
3. **[DEPLOYMENT.md](DEPLOYMENT.md#cost-estimation)** — Cost model

---

## Document Summaries

### README.md
**Status:** Project overview, always up-to-date

High-level intro to what the app does, tech stack, quick start, and project structure. Suitable for everyone.

**Read if:** You're new to the project, need a quick refresher, or want to explain the project to someone else.

---

### AUTH.md
**Status:** Complete, reflects current implementation (Step H done)

Comprehensive guide to authentication and authorization:
- Supabase Auth flow (login/logout)
- JWT token verification in backend
- Role-based access control (RBAC)
- Project ownership filtering (pm_id)
- User provisioning (linking Supabase ↔ local DB)
- Frontend AuthContext and token management
- Test mode bypass
- Troubleshooting

**Read if:** You're building auth features, integrating login into frontend, or setting up Supabase.

---

### KEYEDIN_INTEGRATION.md
**Status:** Complete, reflects current implementation (OngoingDataProvider pattern)

Guide to integrating with Keyedin project management platform:
- Provider pattern (pluggable data sources)
- KeyedinApiProvider (fetches actuals from Keyedin API)
- ManualFallbackProvider (always available fallback)
- Environment configuration
- Keyedin Reporting API setup
- Sync workflow (manual vs. Keyedin)
- Frontend integration (Avanzamento page)
- Phase-level actuals (Step E)
- Testing strategies
- Error handling

**Read if:** You're implementing Keyedin sync, configuring the Keyedin API, or understanding the provider pattern.

---

### DEPLOYMENT.md
**Status:** Current, covers Vercel + Supabase (recommended stack)

Complete deployment guide:
- Architecture overview (frontend CDN + serverless backend + managed DB)
- Platform options (Vercel recommended)
- Vercel setup (linking repo, configuring builds, env vars)
- Database deployment (Supabase, RDS, DigitalOcean options)
- Pre-deployment checklist
- Step-by-step deployment
- Monitoring and debugging
- Troubleshooting guide
- Rollback procedures
- Cost estimation (free tier coverage)
- CI/CD pipeline setup (GitHub Actions)
- Security best practices
- Scaling strategies
- Backup & recovery

**Read if:** You're deploying to production, setting up databases, configuring Vercel, or managing the deployment pipeline.

---

### API_PATTERNS.md
**Status:** Current, reflects implemented patterns (routes, services, transactions)

Design patterns and conventions for backend API development:
- Layered architecture (routes → services → database)
- Route pattern (CRUD operations, error handling)
- Service pattern (pure business logic, dependency injection)
- Database query pattern (parameterized queries, transactions, advisory locks)
- HTTP status codes (400, 401, 403, 404, 409, 500, 503)
- Error handling and logging
- Request/response patterns (GET, POST, PUT, DELETE)
- Input validation
- Pagination and filtering
- Authorization (pm_id filtering, role-based access)
- Response format convention
- Testing examples

**Read if:** You're building new API routes, writing services, or want to understand the architectural patterns.

---

## Architecture Documents (in repo root)

These documents live in the root and provide high-level architectural views:

- **[CLAUDE.md](../CLAUDE.md)** — Single source of truth for project decisions, conventions, workflows
- **[ARCHITECTURE_AS_IS.md](../ARCHITECTURE_AS_IS.md)** — Current state, data flows, open issues, fix priority
- **[NEXT_STEPS.md](../NEXT_STEPS.md)** — Roadmap, step status, migration checklist
- **[AGENTS.md](../AGENTS.md)** — Original feature spec and design document
- **[PROMPT.md](../PROMPT.md)** — Development prompt for AI sessions

---

## Common Questions

### "Where's the API reference?"

See **[API_PATTERNS.md](API_PATTERNS.md)** for endpoint patterns and conventions. For specific endpoints, check the route files:
- `backend/src/routes/projects.ts`
- `backend/src/routes/allocations.ts`
- `backend/src/routes/baseline.ts`
- `backend/src/routes/dashboard.ts`
- (etc.)

### "How do I add a new feature?"

1. Read **[CLAUDE.md](../CLAUDE.md)** → Workflows section
2. Follow **[API_PATTERNS.md](API_PATTERNS.md)** for route/service structure
3. Write tests first (TDD)
4. Update **[CLAUDE.md](../CLAUDE.md)** if you change architecture

### "How do I debug authentication issues?"

1. See **[AUTH.md](AUTH.md)** → Troubleshooting table
2. Check Supabase logs (dashboard)
3. Check backend logs (`vercel logs`)
4. Check browser DevTools (Network, Console tabs)

### "How do I set up Keyedin sync?"

1. Read **[KEYEDIN_INTEGRATION.md](KEYEDIN_INTEGRATION.md)** → Configuration Checklist
2. Create custom report in Keyedin
3. Set env vars in `backend/.env` or Vercel
4. Test manually: `POST /api/projects/1/ongoing/sync`

### "How do I deploy to production?"

1. Read **[DEPLOYMENT.md](DEPLOYMENT.md)** → Deployment Steps (Section 2)
2. Follow Pre-Deployment Checklist
3. Push to `main` branch → Vercel auto-deploys
4. Monitor in Vercel dashboard

---

## Maintenance

### Keeping docs up-to-date

1. After significant architecture changes, update **[CLAUDE.md](../CLAUDE.md)**
2. After new features, update **[NEXT_STEPS.md](../NEXT_STEPS.md)** and **[ARCHITECTURE_AS_IS.md](../ARCHITECTURE_AS_IS.md)**
3. After fixing bugs or adding patterns, update relevant docs in **`docs/`** folder
4. Keep this **INDEX.md** synchronized with folder contents

### Review checklist

- [ ] All docs build without errors (if using Markdown linter)
- [ ] Code examples match current codebase
- [ ] Links are valid (README links to docs, docs link to source)
- [ ] Instructions are tested (at least mentally)
- [ ] No outdated information from previous versions

---

## Writing Style

All docs follow these conventions:

- **Clear, active voice** — "The backend validates input" not "Input is validated"
- **Code examples** — Real code from the repo, not pseudo-code
- **Links** — Absolute paths for navigation (e.g., `[AUTH.md](AUTH.md)`)
- **Formatting** — Markdown headers (# ## ###), code blocks (```typescript), tables
- **Length** — 10–30 minutes to read each doc (balance detail with brevity)

---

## Related Resources

### External

- **[Supabase Docs](https://supabase.com/docs)** — Authentication, database, real-time
- **[Vercel Docs](https://vercel.com/docs)** — Deployment, functions, serverless
- **[Express.js Docs](https://expressjs.com/)** — HTTP routing, middleware
- **[React Docs](https://react.dev/)** — Frontend components, hooks

### Internal

- **Source code** — `backend/src/`, `frontend/src/`
- **Tests** — `backend/src/**/*.test.ts`, `frontend/src/**/*.test.ts`
- **Database** — `backend/src/db/migrations/`

---

## Questions or Improvements?

- **Bug in docs?** — Create a GitHub issue or submit a PR
- **Something unclear?** — Ask in team Slack or during code review
- **New doc needed?** — Propose in the team sync

---

**Last updated:** June 8, 2026  
**Status:** All docs current with feature/leGenn branch  
**Maintained by:** Team  
