# CLAUDE.md — Project Forecast App

Single Source of Truth per Claude Code. Aggiorna questo file ad ogni cambiamento architetturale significativo.

---

## Project Overview

Web application che replica e supera `Project_Forecast_v16.xlsx`. Gestisce budget,
allocazione risorse, milestone e Gantt per più progetti e più PM, con pull opzionale
da **Keyedin** per i dati di avanzamento (actuals).

**Fase corrente:** POC con target deploy Vercel — Docker Compose disponibile per DB locale.
**Obiettivo:** proposta interna se il POC convince.

### Stack tecnologico

| Layer | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript 5 + React Router v6 |
| Styling | Tailwind CSS 3 (tema dark custom) |
| Backend | Node.js + Express 4 + TypeScript 5 + CORS |
| Database | PostgreSQL (driver `pg`) — DB locale via Docker Compose |
| Auth | **Supabase Auth** (`supabase.auth.signInWithPassword`) — route `/api/auth` attiva; `requireAuth` middleware e filtro `pm_id` ancora da fare (Step H) |
| Test (BE) | Jest + ts-jest + Supertest |
| Test (FE) | **Vitest** (`vitest.config.ts`, `frontend/src/test/setup.ts`) |
| Build (BE) | `tsc` → `dist/` |
| Build (FE) | `vite build` |
| Dev server (BE) | `nodemon` su `src/index.ts` |
| Deploy | **Vercel** (`vercel.json`) — frontend static + backend serverless |
| Monorepo | **NX** + **pnpm** (`pnpm-workspace.yaml`) |
| Integrazione esterna | Keyedin API (stub attivo, fallback manuale sempre disponibile) |

---

## Repository Layout

```
project-forecast-app/
├── backend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── index.ts                  # Entry point Express, mount router, cors()
│   │   ├── db/
│   │   │   ├── index.ts              # Pool pg + helper query()
│   │   │   ├── supabase.ts           # Supabase client (solo auth — NON per query dati)
│   │   │   ├── migrate.ts            # Runner automatico migrazioni (npm run migrate)
│   │   │   ├── seed.ts               # Seed dati realistici (npm run seed)
│   │   │   └── migrations/           # 001–008 SQL sequenziali
│   │   ├── routes/                   # Un file per dominio, Router({ mergeParams: true })
│   │   │   ├── auth.ts               # POST /api/auth/login|logout via Supabase Auth
│   │   │   ├── projects.ts
│   │   │   ├── phases.ts
│   │   │   ├── baseline.ts
│   │   │   ├── allocations.ts
│   │   │   ├── resources.ts
│   │   │   ├── ongoing.ts
│   │   │   ├── gantt.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── phaseTemplates.ts
│   │   │   └── routes.test.ts        # Integration tests (supertest)
│   │   └── services/
│   │       ├── computations.ts       # NETWORKDAYS, validateFTE, RAG, revisedForecast
│   │       ├── computations.test.ts
│   │       ├── consistency.test.ts   # Floating-point edge cases RAG + BE/FE divergence
│   │       ├── allocationAggregator.ts  # Single source of truth Σ FTE cross-project
│   │       ├── allocationAggregator.test.ts
│   │       └── ongoing/
│   │           ├── OngoingDataProvider.ts   # Interface
│   │           ├── KeyedinApiProvider.ts    # Stub reale
│   │           └── ManualFallbackProvider.ts
│   ├── package.json
│   ├── tsconfig.json                 # target ES2022, strict: true, rootDir: src/
│   └── .env.example
├── frontend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── App.tsx                   # BrowserRouter + AuthProvider + Routes
│   │   ├── main.tsx
│   │   ├── types/index.ts            # Tutti i tipi di dominio condivisi
│   │   ├── api/                      # Un file per dominio, usa apiClient()
│   │   │   ├── client.ts             # fetch wrapper con Bearer token
│   │   │   ├── auth.ts
│   │   │   ├── supabase.ts           # Supabase client frontend (VITE_SUPABASE_*)
│   │   │   ├── projects.ts
│   │   │   ├── baseline.ts
│   │   │   ├── allocation.ts
│   │   │   ├── ongoing.ts
│   │   │   ├── gantt.ts
│   │   │   └── phaseTemplates.ts
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx       # token + user in localStorage
│   │   ├── components/               # UI primitivi riusabili
│   │   │   ├── AppNav.tsx
│   │   │   ├── FTECell.tsx
│   │   │   ├── RAGBadge.tsx
│   │   │   ├── BudgetBar.tsx
│   │   │   ├── DateInput.tsx
│   │   │   ├── ConfirmModal.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── pages/                    # Una pagina per route
│   │   │   ├── Login.tsx
│   │   │   ├── Projects.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Pianificazione.tsx    # Tab Fasi + Tab Risorse (allocation matrix)
│   │   │   ├── Avanzamento.tsx       # Ongoing snapshot + sync Keyedin
│   │   │   ├── Gantt.tsx
│   │   │   ├── Resources.tsx
│   │   │   └── Settings.tsx
│   │   ├── test/
│   │   │   └── setup.ts              # Vitest setup
│   │   ├── mocks/mockData.ts         # Dati realistici per VITE_USE_MOCK=true
│   │   └── utils/networkDays.ts      # Utility date FE (weeksInRange, fmtWeek)
│   ├── package.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── .env.local                    # gitignored — non committare
├── docker-compose.yml                # PostgreSQL 16 locale (porta 5432)
├── vercel.json                       # Deploy: frontend static + backend serverless
├── nx.json                           # NX monorepo config
├── pnpm-workspace.yaml               # Workspace: frontend + backend
├── AGENTS.md                         # Design document originale (feature spec)
├── ARCHITECTURE_AS_IS.md             # Stato attuale, problematiche aperte, ordine fix
├── NEXT_STEPS.md                     # Roadmap steps con stato (done / in progress)
├── PROMPT.md                         # Prompt di sviluppo per sessioni Claude
└── CLAUDE.md                         # Questo file
```

---

## Commands

Il progetto usa **pnpm** come package manager e **NX** come monorepo runner.
I comandi vanno eseguiti dalla rispettiva sottocartella (`backend/` o `frontend/`),
oppure dalla root con NX.

### Setup iniziale (prima volta)

```bash
# Dalla root del monorepo
pnpm install

# Avvia il DB locale con Docker Compose
docker-compose up -d
```

### Backend

```bash
cd backend

# Dev (nodemon, ricarica automatica)
pnpm run dev          # porta 3000

# Build TypeScript
pnpm run build        # output in dist/

# Test (tutti, in band)
pnpm test

# Test watch
pnpm run test:watch
```

### Frontend

```bash
cd frontend

# Dev server (Vite HMR)
pnpm run dev          # porta 5173

# Build produzione
pnpm run build        # output in dist/

# Test (Vitest)
pnpm test

# Lint
pnpm run lint
```

### Database — runner automatico

Le migrazioni sono ora gestite dal runner `backend/src/db/migrate.ts`,
che traccia le migrazioni eseguite in una tabella `migrations`.

```bash
cd backend

# Applica tutte le migrazioni non ancora eseguite
pnpm run migrate

# Popola il DB con dati realistici (per sviluppo locale)
pnpm run seed
```

Alternativamente, applicare manualmente con `psql`:
```bash
psql $DATABASE_URL -f backend/src/db/migrations/001_initial_schema.sql
# ... fino a 008_baseline_snapshot.sql
```

La prossima migrazione sarà `009_ongoing_phase_id.sql` (Step E).

---

## Architecture

### Pattern principali

**Backend — Layered / Route-Service**

```
HTTP Request
  → Express Router (routes/*.ts)       — validazione input, query DB dirette
  → Services (services/*.ts)           — logica pura, testabile senza DB
  → db/index.ts (pg Pool)              — query helper per tutti i dati
  → db/supabase.ts (Supabase client)   — SOLO per autenticazione
```

I router usano `query()` dal pool direttamente per operazioni CRUD.
`db/supabase.ts` è usato **esclusivamente** da `routes/auth.ts` per gestire
login/logout via Supabase Auth — non sostituisce pg per le query sui dati.

La logica computazionale è estratta in servizi puri:
- `computations.ts` — funzioni pure, nessun DB
- `allocationAggregator.ts` — dependency injection via `query` param opzionale
  (permette unit test senza DB reale)

**Provider Pattern per Keyedin**

```
OngoingDataProvider (interface)
  ├── KeyedinApiProvider     ← stub, attivabile quando API disponibile
  └── ManualFallbackProvider ← sempre disponibile
```

**Frontend — Feature Pages + API layer**

```
Page (pages/*.tsx)
  → API module (api/*.ts)              — wrappa apiClient()
  → api/client.ts                      — fetch con Bearer token, error handling
  → AuthContext                        — token + user da localStorage
```

Nessun global state manager (no Redux/Zustand). Lo stato è locale ai componenti
pagina o sollevato al livello minimo necessario.

### Data Model (tabelle principali)

| Tabella | Ruolo |
|---|---|
| `User` | PM e DM — password_hash, role (pm/dm) |
| `Project` | Progetto con pm_id, status, keyedin_code, share_token |
| `ProjectPhase` | 5 fasi sequenziali per progetto, display_name configurabile |
| `Baseline` | Lock BAC: total_budget_at_lock, phase_snapshot_at_lock (JSONB) |
| `Resource` | Registry centrale condiviso — day_rate |
| `AllocationEntry` | resource × project × phase × week_start → fte, weekly_cost (materializzato) |
| `OngoingSnapshot` | Actuals per progetto (ore, costo, giorni) — source: manual/keyedin_api |
| `GanttTask` | Task e milestone per fase |
| `PublicHoliday` | Festività IT 2025–2027 (pre-seeded) |
| `PhaseTemplate` | Default display_name e contingency_pct per nuovi progetti |

### Calcoli chiave

- `weekly_cost` è materializzato all'INSERT: `day_rate × fte × working_days_in_week`
- `phase.budget` = `SUM(weekly_cost)` calcolato live a ogni GET
- `Baseline.total_budget_at_lock` = snapshot immutabile al momento del lock (BAC)
- `revised_forecast` = media tra time-based e cost-based, flat di progetto (Step F cambierà questo)
- RAG status: IN_LINEA ≤ 1.05 · BAC, A_RISCHIO ≤ 1.15, FUORI_BUDGET > 1.15
- FTE cap: `canAllocate()` in `allocationAggregator.ts` — cap 1.0 per (resource, week)

---

## Conventions

### TypeScript

- `strict: true` su entrambi i progetti
- Nessun `any` esplicito nei servizi — usato solo nelle query param pg dove necessario
- I tipi di dominio condivisi frontend vivono in `frontend/src/types/index.ts`
- Backend non ha un file di tipi condivisi: i tipi sono inline nei route file

### Naming

- File: `camelCase.ts` per servizi e utility, `PascalCase.tsx` per componenti React
- Tabelle DB: `PascalCase` con doppi apici in SQL (es. `"AllocationEntry"`)
- Route param: `req.params.id` per il project id, `req.params.pid` per phase id
- Variabili ambiente backend: `SCREAMING_SNAKE_CASE`, prefisso `KEYEDIN_` per Keyedin
- Variabili ambiente frontend: prefisso `VITE_`

### Gestione errori (backend)

- `res.status(404).json({ error: 'Resource not found' })` per not found
- `res.status(409).json({ error: '...', ...details })` per violazioni di business (FTE cap)
- `res.status(400)` per input mancante o malformato
- `res.status(500).json({ error: err.message })` come catch finale
- I blocchi `try/catch` wrappano l'intero handler del router

### Testing

**Backend (Jest + ts-jest):**
- Test unitari in `services/*.test.ts` — zero dipendenze DB, DI via `query` param
- `services/consistency.test.ts` — edge case floating-point (RAG near 1.05/1.15) e divergenza BE/FE su NETWORKDAYS con festività
- Test di integrazione in `routes/routes.test.ts` — usa `supertest`
- Esecuzione: `pnpm test --runInBand` (sequenziale, no race condition su DB)

**Frontend (Vitest):**
- `utils/networkDays.test.ts` — test utility date lato client
- Setup in `src/test/setup.ts`
- Esecuzione: `pnpm test` dalla cartella `frontend/`

**Nota:** `consistency.test.ts` include un test (`RAGStatus floating point near 1.05`)
che documenta un comportamento atteso non ancora implementato — `calculateRAGStatus`
non ha ancora epsilon tolerance. Il test è intenzionalmente failing come reminder.

### Mock mode (frontend)

`VITE_USE_MOCK=true` in `frontend/.env.local` bypassa le chiamate API reali e usa
`frontend/src/mocks/mockData.ts`. Il token mock è `mock-jwt-token-dev`.
Usare mock mode quando il backend non è avviato o per sviluppo UI puro.

### Stile UI

- Tema dark-only, palette custom in `tailwind.config.js`
- Colori semantici: `accent` (#6c63ff), `accent-cyan`, `rag-green/yellow/red`
- Font: Inter (system fallback)
- Nessuna libreria di componenti esterna — tutto custom con Tailwind

---

## Workflows

### 1. Aggiungere una nuova route API

1. Creare `backend/src/routes/myFeature.ts` con `Router({ mergeParams: true })`
2. Aggiungere i handler con `try/catch` standard (vedi pattern in `routes/phases.ts`)
3. Importare e montare in `backend/src/index.ts`: `app.use('/api/...', myFeatureRouter)`
4. Aggiungere tipi corrispondenti in `frontend/src/types/index.ts`
5. Creare `frontend/src/api/myFeature.ts` che usa `apiClient()`
6. Se necessario aggiornare `frontend/src/mocks/mockData.ts`

### 2. Aggiungere una migrazione DB

1. Creare `backend/src/db/migrations/00N_description.sql` con il numero progressivo
2. Wrappare in `BEGIN; ... COMMIT;`
3. Applicare con il runner: `cd backend && pnpm run migrate`
   (Il runner traccia le migrazioni eseguite nella tabella `migrations` e salta quelle già applicate.)
4. Aggiornare ARCHITECTURE_AS_IS.md sezione "1.1 Cosa è stato implementato"
5. Se la nuova colonna è usata dal frontend, aggiornare i tipi in `frontend/src/types/index.ts`

### 3. Modificare la logica di calcolo (budget / FTE / forecast)

1. La logica pura vive in `backend/src/services/computations.ts` o `allocationAggregator.ts`
2. Scrivere il test unitario prima di modificare (file `*.test.ts` adiacenti)
3. I servizi accettano una `query` function iniettata — usare `makeStubQuery` nei test
4. Dopo la modifica, verificare che `dashboard.ts` e `allocations.ts` usino
   il servizio aggiornato (non ridefinire la logica inline nel router)
5. Eseguire `pnpm test` prima di considerare il lavoro completo

---

## Variabili d'ambiente

### Backend (`backend/.env`)
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/project_forecast
PORT=3000
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### Frontend (`frontend/.env.local`)
```
VITE_API_URL=http://localhost:3000
VITE_USE_MOCK=true          # bypassa chiamate API reali
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

---

## Open Issues (roadmap)

Vedere `NEXT_STEPS.md` per lo stato dettagliato. In sintesi:

| Step | Descrizione | Stato |
|---|---|---|
| D | FTE cap enforcement su PUT /allocation | Piccolo, usa `canAllocate` già pronta |
| E | `phase_id` su `OngoingSnapshot` (migration 009) | Prerequisito di F |
| F | Phase Financial Engine — forecast per fase | Dopo E |
| G | `day_rate` cascade su `AllocationEntry` | Indipendente |
| H | Auth backend: `requireAuth` middleware + filtro `pm_id` | Route `/api/auth` esiste, manca il middleware |
| J | Re-baselining con versioning | Future feature post-auth |
