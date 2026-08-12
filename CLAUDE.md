# CLAUDE.md — Project Forecast App

Single Source of Truth per Claude Code. Aggiorna questo file ad ogni cambiamento architetturale significativo.

---

## Project Overview

Web application che replica e supera `Project_Forecast_v16.xlsx`. Gestisce budget,
allocazione risorse, milestone e Gantt per più progetti e più PM, con pull opzionale
da **Keyedin** per i dati di avanzamento (actuals) e funzionalità di Knowledge Graph
(decisioni, rischi, slippage, retrospettive, progetti simili).

**Fase corrente:** POC con target deploy Vercel — Docker Compose disponibile per DB locale.
**Obiettivo:** proposta interna se il POC convince.

### Stack tecnologico

| Layer | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript 5 + React Router v6 (pagine in `React.lazy`) |
| Styling | Tailwind CSS 3 (tema dark custom) |
| Backend | Node.js + Express 4 + TypeScript 5 + CORS (allowlist via `CORS_ORIGIN`) |
| Database | PostgreSQL (driver `pg`) — DB locale via Docker Compose |
| Auth | **Supabase Auth** — `requireAuth` (token + cache TTL 60s) e `requireProjectAccess` (ownership `pm_id`, bypass ruolo `dm`) **attivi** su tutte le route dati |
| AI (opzionale) | Provider pattern: `intelligence/` (Claude API) e `embeddings/` (OpenAI) con NoOp fallback se le API key mancano |
| Test (BE) | Jest + ts-jest + Supertest (252 test) |
| Test (FE) | **Vitest** — `pnpm test` da `frontend/` |
| Build (BE) | `tsc` → `dist/` |
| Build (FE) | `vite build` — chunk `vendor` e `supabase` separati (manualChunks) |
| Dev server (BE) | `nodemon` su `src/index.ts` |
| Deploy | **Vercel** (`vercel.json`) — frontend static (con fallback SPA) + backend serverless (`export default app`) |
| Monorepo | **NX** + **pnpm** (`pnpm-workspace.yaml`) |
| Integrazione esterna | Keyedin API (stub attivo, fallback manuale sempre disponibile) |

---

## Repository Layout

```
project-forecast-app/
├── backend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── index.ts                  # Entry point Express; guard auth+ownership su /api/projects/:id; export default app
│   │   ├── middleware/
│   │   │   ├── requireAuth.ts        # Bearer token via Supabase + cache TTL 60s + requireRole
│   │   │   └── requireProjectAccess.ts # Ownership pm_id (404 per progetti altrui; dm bypassa)
│   │   ├── db/
│   │   │   ├── index.ts              # Pool pg (max via PG_POOL_MAX) + query() + withTransaction()
│   │   │   ├── supabase.ts           # Supabase client (solo auth — NON per query dati)
│   │   │   ├── migrate.ts            # Runner automatico migrazioni (pnpm run migrate)
│   │   │   ├── seed.ts               # Seed dati realistici (pnpm run seed)
│   │   │   └── migrations/           # 001–014 SQL sequenziali (014 = indici FK core)
│   │   ├── routes/                   # Un file per dominio, Router({ mergeParams: true })
│   │   │   ├── auth.ts               # POST /api/auth/login|logout via Supabase Auth
│   │   │   ├── projects.ts           # Lista (filtro pm_id), /similar (tag-overlap), PATCH status
│   │   │   ├── phases.ts             # PATCH working-copy date/status
│   │   │   ├── baseline.ts           # GET/PUT baseline + POST lock (BAC snapshot)
│   │   │   ├── allocations.ts        # GET matrice + PUT batch con cap FTE
│   │   │   ├── resources.ts          # CRUD risorse + /registry + /capacity-heatmap (banda colore demand-vs-supply, cap 1.0 FTE) cross-project
│   │   │   ├── ongoing.ts            # Snapshot actuals + sync Keyedin
│   │   │   ├── gantt.ts              # Task e milestone CRUD
│   │   │   ├── dashboard.ts          # KPI + budget per fase + milestone
│   │   │   ├── knowledge.ts          # Scoping (PATCH /:id), decisions, risks, slippage, retrospectives
│   │   │   ├── intelligence.ts       # GET /similar-semantic (kNN cosine) + /scoping-insight (risk brief) + /retro-questions (RetroContext da slippage+variance); tutto graceful con NoOp senza ANTHROPIC_API_KEY
│   │   │   ├── phaseTemplates.ts
│   │   │   └── routes.test.ts        # Integration tests (supertest, DB mockato)
│   │   ├── services/
│   │   │   ├── computations.ts       # NETWORKDAYS, validateFTE, RAG, revisedForecast
│   │   │   ├── allocationAggregator.ts  # SSoT Σ FTE: getWeeklyTotal(+Batch), canAllocate, registry
│   │   │   ├── phaseFinancialEngine.ts  # EAC/forecast per fase + rollup progetto
│   │   │   ├── embeddings/           # EmbeddingProvider: OpenAI | NoOp
│   │   │   ├── intelligence/         # IntelligenceProvider: Claude | NoOp
│   │   │   └── ongoing/              # OngoingDataProvider: KeyedinApi (stub) | ManualFallback
│   │   ├── types/express.d.ts        # Estensione Request.auth
│   │   ├── package.json
│   │   ├── tsconfig.json             # target ES2022, strict: true, rootDir: src/
│   │   └── .env.example
├── frontend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── App.tsx                   # BrowserRouter + AuthProvider + Routes (lazy + Suspense)
│   │   ├── main.tsx
│   │   ├── types/index.ts            # Tutti i tipi di dominio condivisi
│   │   ├── api/                      # Un file per dominio, usa apiClient()
│   │   │   ├── client.ts             # fetch wrapper con Bearer token
│   │   │   ├── auth.ts / supabase.ts
│   │   │   ├── projects.ts / baseline.ts / allocation.ts / ongoing.ts
│   │   │   ├── gantt.ts / phaseTemplates.ts / knowledge.ts
│   │   ├── contexts/AuthContext.tsx  # token + user in localStorage
│   │   ├── components/               # UI primitivi riusabili
│   │   │   ├── AppNav.tsx, FTECell.tsx, RAGBadge.tsx, BudgetBar.tsx
│   │   │   ├── DateInput.tsx, ConfirmModal.tsx, RequireAuth.tsx
│   │   │   ├── RetrospectiveModal.tsx, SlippageModal.tsx, SimilarProjects.tsx
│   │   │   └── ProjectMemoryTab.tsx  # Timeline KG (decisioni+rischi+slippage+retrospettive) montata come tab in Dashboard
│   │   ├── api/                      # Un file per dominio, usa apiClient()
│   │   │   ├── ...knowledge.ts       # getDecisions/getRisks/getSlippageEvents/getRetrospectives/fetchSimilarProjects — tutti con withMock
│   │   │   └── intelligence.ts       # fetchSimilarSemantic (stub → /api/projects/:id/similar-semantic) con withMock
│   │   ├── pages/                    # Una pagina per route (tutte lazy)
│   │   │   ├── Login.tsx, Projects.tsx
│   │   │   ├── Dashboard.tsx         # Tab 'overview' + tab 'Memoria Progetto' (ProjectMemoryTab); SimilarProjects in overview
│   │   │   ├── Pianificazione.tsx    # Tab Fasi + Tab Risorse (matrice FTE memoizzata)
│   │   │   ├── Avanzamento.tsx       # Snapshot ongoing + sync Keyedin
│   │   │   ├── Gantt.tsx, Resources.tsx, Settings.tsx
│   │   ├── test/setup.ts             # Vitest setup
│   │   ├── mocks/mockData.ts         # Dati per VITE_USE_MOCK=true — include MOCK_SIMILAR_PROJECTS, MOCK_SIMILAR_SEMANTIC, MOCK_DECISIONS, MOCK_RISKS, MOCK_SLIPPAGE, MOCK_RETROSPECTIVES
│   │   └── utils/                    # networkDays.ts, formatCurrency.ts
│   ├── package.json
│   ├── vite.config.ts                # manualChunks vendor/supabase
│   ├── vitest.config.ts
│   ├── tailwind.config.js
│   └── .env.local                    # gitignored e untracked — non committare
├── docker-compose.yml                # PostgreSQL 16 locale (porta 5432)
├── vercel.json                       # /api → backend; /assets e file statici → frontend; fallback SPA → index.html
├── nx.json / pnpm-workspace.yaml
├── AGENTS.md                         # Design document originale (feature spec)
├── ARCHITECTURE_AS_IS.md             # Stato storico (vedi anche report audit)
├── NEXT_STEPS_COMPLETO.md            # Roadmap steps con stato
├── report-step1..6-*.md              # Audit 2026-06: struttura, visual, componenti, perf, security, priority matrix
├── report-decisions.md               # Decisioni aperte (D1-D4) con opzioni e trade-off
├── fix-log.md                        # Changelog dei fix applicati post-audit
└── CLAUDE.md                         # Questo file
```

---

## Commands

Il progetto usa **pnpm** come package manager e **NX** come monorepo runner.

### Setup iniziale (prima volta)

```bash
pnpm install          # dalla root
docker-compose up -d  # DB locale
```

### Backend (`cd backend`)

```bash
pnpm run dev          # nodemon, porta 3000
pnpm run build        # tsc → dist/
pnpm test             # Jest (--runInBand)
pnpm run test:watch
```

### Frontend (`cd frontend`)

```bash
pnpm run dev          # Vite HMR, porta 5173
pnpm run build        # tsc + vite build
pnpm test             # Vitest (run singolo)
pnpm run test:watch   # Vitest watch
pnpm run lint
```

### Database — runner automatico

```bash
cd backend
pnpm run migrate      # applica le migrazioni non ancora eseguite (tracking in tabella `migrations`)
pnpm run seed         # dati realistici per sviluppo locale
```

Migrazioni esistenti: 001–014. La prossima sarà `015_*.sql`.
**Nota:** la 013 richiede l'estensione `pgvector` sul server Postgres; senza, il runner
si ferma lì (le feature di similarità semantica restano disattivate, NoOp provider).

---

## Architecture

### Pattern principali

**Backend — Layered / Route-Service con guard di sicurezza**

```
HTTP Request
  → requireAuth (middleware)           — Bearer token Supabase + cache TTL 60s
  → requireProjectAccess (middleware)  — ownership pm_id su /api/projects/:id/* (dm bypassa)
  → Express Router (routes/*.ts)       — validazione input, query DB dirette
  → Services (services/*.ts)           — logica pura, testabile senza DB
  → db/index.ts (pg Pool)              — query() + withTransaction()
  → db/supabase.ts (Supabase client)   — SOLO per autenticazione
```

Il guard `requireAuth + requireProjectAccess` è montato **una sola volta** sul prefisso
`/api/projects/:id` in `index.ts` e copre tutte le route figlie. `requireAuth` è
idempotente (`req.auth` già presente → next).

**Transazioni:** SEMPRE tramite `withTransaction()` di `db/index.ts` (client dedicato).
MAI `query('BEGIN')` sul pool: ogni chiamata può finire su una connessione diversa.

**Provider Pattern (×3)**

```
OngoingDataProvider    → KeyedinApiProvider (stub) | ManualFallbackProvider
IntelligenceProvider   → ClaudeProvider | NoOpProvider     (ANTHROPIC_API_KEY)
EmbeddingProvider      → OpenAIEmbeddingProvider | NoOp    (EMBEDDING_API_KEY)
```

**Frontend — Feature Pages + API layer**

```
Page (pages/*.tsx, lazy)
  → API module (api/*.ts)              — wrappa apiClient()
  → api/client.ts                      — fetch con Bearer token, error handling
  → AuthContext                        — token + user da localStorage
```

Nessun global state manager. Stato locale ai componenti pagina.

### Data Model (tabelle principali)

| Tabella | Ruolo |
|---|---|
| `User` | PM e DM — role (pm/dm), supabase_uid |
| `Project` | pm_id (ownership), status, keyedin_code, description, tags (jsonb), share_token (dormiente), description_embedding (pgvector mig 013 — letto da `/similar-semantic`) |
| `ProjectPhase` | Fasi sequenziali per progetto, display_name configurabile |
| `Baseline` | Lock BAC: total_budget_at_lock, phase_snapshot_at_lock (JSONB) |
| `Resource` | Registry centrale condiviso — day_rate |
| `ResourceDayRateHistory` | Storico rate per analisi point-in-time |
| `AllocationEntry` | resource × project × phase × week_start → fte, weekly_cost (materializzato) |
| `OngoingSnapshot` | Actuals per progetto/fase — source: manual/keyedin_api |
| `GanttTask` | Task e milestone per fase |
| `PublicHoliday` | Festività IT 2025–2027 (pre-seeded) |
| `PhaseTemplate` | Default display_name e contingency_pct per nuovi progetti |
| `Decision`, `Risk`, `SlippageEvent`, `Retrospective` | Knowledge Graph (mig. 012) |

### Calcoli chiave

- `weekly_cost` materializzato all'INSERT: `day_rate × fte × working_days_in_week`
- `phase.budget` = `SUM(weekly_cost)` calcolato live a ogni GET
- `Baseline.total_budget_at_lock` = snapshot immutabile al lock (BAC); la working copy resta modificabile
- `revised_forecast` **per fase** via `phaseFinancialEngine.ts` (completed → cost_spent; in_progress → media time/cost-based; not_started → budget) con rollup di progetto
- RAG status: IN_LINEA ≤ 1.05 · BAC, A_RISCHIO ≤ 1.15, FUORI_BUDGET > 1.15
- FTE cap 1.0 per (resource, week): `canAllocate()` / `getWeeklyTotalsBatch()` in `allocationAggregator.ts` — il PUT allocation verifica in batch e usa advisory lock transazionali

---

## Conventions

### TypeScript

- `strict: true` su entrambi i progetti
- Nessun `any` esplicito nei servizi — tollerato solo nelle query param pg
- Tipi di dominio condivisi frontend in `frontend/src/types/index.ts`; backend inline nei route file

### Naming

- File: `camelCase.ts` per servizi/utility, `PascalCase.tsx` per componenti React
- Tabelle DB: `PascalCase` con doppi apici in SQL (es. `"AllocationEntry"`)
- Route param: `req.params.id` per il project id, `req.params.pid`/`phase_id` per phase id
- Env backend: `SCREAMING_SNAKE_CASE`, prefisso `KEYEDIN_` per Keyedin; frontend: prefisso `VITE_`

### Gestione errori (backend)

- `404 { error: 'Resource not found' }` per not found **e per risorse di altri PM** (mai 403: non confermare l'esistenza)
- `409 { error, ...details }` per violazioni di business (FTE cap con breakdown)
- `400` per input mancante o malformato
- `500 { error: 'Internal server error' }` — **mai** `err.message` nel body (leak di dettagli DB); sempre `console.error(err)` per i log
- I blocchi `try/catch` wrappano l'intero handler

### Testing

**Backend (Jest + ts-jest):** unit test in `services/*.test.ts` (DI via `query` param,
zero DB), integrazione in `routes/routes.test.ts` (supertest, db mockato — include i
test di regressione security su ownership e validazione). Esecuzione: `pnpm test`
(già `--runInBand`).

**Frontend (Vitest):** `pnpm test` da `frontend/` (utils date e currency; setup in
`src/test/setup.ts`).

### Mock mode (frontend)

`VITE_USE_MOCK=true` in `frontend/.env.local` bypassa le API reali e usa
`frontend/src/mocks/mockData.ts`. Token mock: `mock-jwt-token-dev`.

### Stile UI

- Tema dark-only, palette custom in `tailwind.config.js`
- Colori semantici: `accent` (#6c63ff), `accent-cyan`, `rag-green/yellow/red`
- Font: Inter (Google Fonts, fallback system)
- Nessuna libreria di componenti esterna — tutto custom con Tailwind

---

## Workflows

### 1. Aggiungere una nuova route API

1. Creare `backend/src/routes/myFeature.ts` con `Router({ mergeParams: true })`
2. Handler con try/catch standard e 500 generico (vedi `routes/ongoing.ts` come modello)
3. Montare in `backend/src/index.ts` — se è sotto `/api/projects/:id` il guard
   auth+ownership è già attivo sul prefisso; altrimenti aggiungere `requireAuth`
4. Validare l'input nel handler (vedi `knowledge.ts` come riferimento)
5. Tipi in `frontend/src/types/index.ts` + modulo `frontend/src/api/myFeature.ts`
6. Aggiornare `frontend/src/mocks/mockData.ts` se serve

### 2. Aggiungere una migrazione DB

1. Creare `backend/src/db/migrations/0NN_description.sql` (prossima: 015), wrappata in `BEGIN; ... COMMIT;`
2. `cd backend && pnpm run migrate`
3. Aggiornare questo file (Data Model) e i tipi FE se la colonna arriva al client

### 3. Modificare la logica di calcolo (budget / FTE / forecast)

1. La logica pura vive in `services/computations.ts`, `allocationAggregator.ts`, `phaseFinancialEngine.ts`
2. Test unitario prima della modifica (file `*.test.ts` adiacenti, `makeStubQuery` per la DI)
3. Verificare che `dashboard.ts` e `allocations.ts` usino il servizio (mai logica inline nel router)
4. `pnpm test` prima di considerare il lavoro completo

---

## Variabili d'ambiente

### Backend (`backend/.env`)
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/project_forecast
PORT=3000
PG_POOL_MAX=10                 # serverless: 1-3 + DATABASE_URL sul pooler (porta 6543)
CORS_ORIGIN=                   # prod: https://<app>.vercel.app (default: http://localhost:5173)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
KEYEDIN_*                      # vedi .env.example (stub Keyedin)
ANTHROPIC_API_KEY=             # opzionale: feature intelligence KG
EMBEDDING_API_KEY=             # opzionale: similarità semantica (richiede pgvector)
```

### Frontend (`frontend/.env.local` — untracked)
```
VITE_API_URL=http://localhost:3000
VITE_USE_MOCK=true             # bypassa chiamate API reali
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

---

## Open Issues (roadmap)

Gli step A–I della roadmap originale (`NEXT_STEPS_COMPLETO.md`) sono **completati**,
incluso H (auth: `requireAuth` + ownership `pm_id`). Restano:

| Tema | Riferimento | Stato |
|---|---|---|
| M-001 — Tab Memoria Progetto | `Dashboard.tsx` + `ProjectMemoryTab.tsx` | **Completato** — timeline KG montata come tab in Dashboard |
| M-002 — Progetti simili semantici | `routes/intelligence.ts` + `SimilarProjects.tsx` + `api/intelligence.ts` | **Completato** — GET `/api/projects/:id/similar-semantic` (kNN cosine su `description_embedding`); attiva asset dormiente mig 013; degrada a `[]` e fallback tag-overlap senza pgvector/embedding |
| M-003 — Scoping Insight (AI risk brief) | `routes/intelligence.ts` + `ScopingInsightCard.tsx` | **Completato** — GET `/api/projects/:id/scoping-insight`; compone `similarHistory` reale (vicini semantici → fallback tag) e invoca `summarizeScopingRisks`; brief `''` graceful senza `ANTHROPIC_API_KEY` (NoOp) o <3 simili (cold-start); card on-demand con placeholder |
| M-004 — Retro Questions AI | `routes/intelligence.ts` + `RetrospectiveModal.tsx` | **Completato** — GET `/api/projects/:id/retro-questions`; `RetroContext` da `SlippageEvent` (count/unexpected) + variance/fasi-in-ritardo da `phaseFinancialEngine`; collega `generateRetroQuestions`; `[]` graceful con NoOp o nessun segnale → fallback domande statiche nel modale |
| M-005 — Capacity Heatmap | `routes/resources.ts` + `CapacityHeatmap.tsx` | **Completato** — GET `/api/resources/capacity-heatmap?weeks=12`; riusa `getRegistryAggregate` (registry condiviso, solo `requireAuth`); banda colore <0.5/0.5–1.0/>1.0, capacità 1.0 FTE; griglia densa montata in `Resources.tsx` |
| J — Re-baselining con versioning | NEXT_STEPS_COMPLETO.md | Future feature |
| Backlog post-audit (42 voci prioritizzate) | `report-step6-priority-matrix.md` | In lavorazione (fix step 5, 4, 1 applicati — vedi `fix-log.md`) |
| Decisioni aperte D1–D4 (sessione/refresh token, ruoli su template/registry, refetch post-save, verifica JWT locale) | `report-decisions.md` | Richiedono input umano |
