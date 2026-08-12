# Report Step 1 — Mappa del Progetto e Prime Impressioni

> Audit full-stack `project-forecast-app` — solo lettura, nessuna modifica al codice.
> Data: 2026-06-12 · Branch: `feature/leGenn`

---

## 1. Struttura delle cartelle e convenzioni di naming

### Vista d'insieme

```
project-forecast-app/
├── backend/                  # Express 4 + TS 5 (CommonJS, build tsc → dist/)
│   └── src/
│       ├── index.ts          # Entry point Express
│       ├── db/               # Pool pg, migrate.ts, seed.ts, migrations/ (001–013)
│       ├── middleware/       # requireAuth.ts  ← NON documentato in CLAUDE.md
│       ├── routes/           # 11 router per dominio + routes.test.ts (1333 righe)
│       ├── services/         # Logica pura + sottocartelle:
│       │   ├── embeddings/   #   EmbeddingProvider, OpenAI, NoOp  ← nuovo, non in CLAUDE.md
│       │   ├── intelligence/ #   IntelligenceProvider, Claude, NoOp ← nuovo, non in CLAUDE.md
│       │   └── ongoing/      #   Provider pattern Keyedin
│       └── types/express.d.ts
├── frontend/                 # React 18 + Vite (ESM)
│   └── src/
│       ├── api/              # 1 file per dominio, wrappa client.ts
│       ├── components/       # Primitivi UI + RetrospectiveModal, SimilarProjects, SlippageModal
│       ├── contexts/         # AuthContext
│       ├── pages/            # 11 pagine — di cui 3 morte (vedi §4)
│       ├── mocks/, test/, types/, utils/
├── docs/                     # 10 file tracciati + 5 non tracciati (INDEX, CONVENTIONS, ...)
├── docker-compose.yml        # PostgreSQL 16 locale
├── vercel.json               # Deploy ibrido static + serverless
├── nx.json / nx / nx.bat     # Wrapper NX
└── pnpm-workspace.yaml       # Workspace: frontend + backend
```

### Convenzioni di naming — osservazioni

| Aspetto | Stato | Note |
|---|---|---|
| File servizi/utility | ✅ coerente | `camelCase.ts` (`allocationAggregator.ts`, `networkDays.ts`) |
| Componenti React | ✅ coerente | `PascalCase.tsx` |
| Tabelle DB | ✅ coerente | `PascalCase` con doppi apici in SQL |
| Migrazioni | ✅ coerente | `00N_description.sql` sequenziali 001–013 |
| **Lingua delle pagine** | ⚠️ misto | Convivono italiano (`Pianificazione`, `Avanzamento`) e inglese (`Dashboard`, `Resources`, `Settings`). Le pagine inglesi `Allocation`/`Baseline`/`Ongoing` sono i predecessori legacy di quelle italiane, mai rimossi. |
| Test co-locati | ✅ coerente | `*.test.ts` adiacenti al sorgente (BE Jest, FE Vitest) |

---

## 2. Entry point

### Frontend — `frontend/index.html` → `src/main.tsx` → `src/App.tsx`
- `main.tsx`: bootstrap standard `ReactDOM.createRoot` + `StrictMode`.
- `App.tsx`: `BrowserRouter` → `AuthProvider` → `Routes`. Tutte le route protette da `<ProtectedRoute>` tranne `/login`. Presenti redirect legacy (`/baseline`, `/allocation`, `/ongoing` → pagine italiane) e catch-all `*` → `/projects`.
- **Nessun lazy loading**: tutte le pagine sono importate staticamente (approfondimento in Step 4).

### Backend — `backend/src/index.ts`
- Express con `cors()` aperto (wildcard — da approfondire in Step 5), `express.json()`.
- `requireAuth` è **già implementato e montato** su tutte le route dati (`/api/projects`, `/api/resources`, ecc.); solo `/api/auth` e `/api/health` sono pubbliche. CLAUDE.md lo descrive ancora come "da fare (Step H)" — documentazione in ritardo rispetto al codice.
- Chiude con `app.listen(port)` e **non esporta `app`** (vedi anomalia §4.3).

### `vercel.json`
- Build 1: `frontend/package.json` via `@vercel/static-build` (distDir `dist`).
- Build 2: `backend/src/index.ts` via `@vercel/node`.
- Routing: `/api/(.*)` → backend; `/(.*) ` → `frontend/$1` statico.
- **Manca il fallback SPA**: `/(.*) → frontend/$1` serve il file letterale; un refresh su `/projects/123/dashboard` produrrà 404 perché non esiste un file statico corrispondente e non c'è rewrite verso `index.html` (vedi §4.2).

---

## 3. Grafo NX: apps, libs, pacchetti condivisi

- **NX è usato in modalità minimale**: `nx.json` contiene solo `installation.version` e `analytics`. Nessun `targetDefaults`, nessun plugin, nessun `project.json` in `frontend/` o `backend/`. NX inferisce i target dagli script npm e funge solo da runner (`nx run-many --target=dev|build|test` dalla root). Niente caching configurato, niente dependency graph esplicito.
- **Workspace pnpm**: dichiara `apps/*` e `packages/*` che **non esistono su disco** — glob aspirazionali mai materializzati. I package reali sono solo `frontend` e `backend`.
- **Nessuna libreria condivisa**: i tipi di dominio sono duplicati — `frontend/src/types/index.ts` per il FE, tipi inline nei route file per il BE. È una scelta documentata in CLAUDE.md, ma con 13 migrazioni e un dominio in crescita (knowledge graph, embeddings) il rischio di divergenza FE/BE aumenta. Un package `packages/shared-types` riempirebbe il glob già dichiarato.

---

## 4. Anomalie strutturali immediatamente visibili

### 🔴 4.1 — `frontend/.env.local` è tracciato in git
CLAUDE.md dichiara il file "gitignored — non committare", ma `git ls-files` lo include (e risulta anche modificato nel working tree). Contiene per definizione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. L'anon key è progettata per essere pubblica, ma il file in repo contraddice la convenzione dichiarata e crea l'abitudine pericolosa di committare `.env`. → Approfondimento in Step 5; il fix (untrack + gitignore) è immediato.

### 🔴 4.2 — `vercel.json` senza fallback SPA
Il routing `/(.*)` → `frontend/$1` non riscrive verso `index.html`: qualsiasi deep-link o refresh su route client-side (`/projects/:id/...`) restituirà 404 in produzione. Serve una route finale `{ "src": "/(.*)", "dest": "frontend/index.html" }` (o `handle: filesystem` + fallback).

### 🔴 4.3 — `backend/src/index.ts` incompatibile con `@vercel/node`
Il file chiama `app.listen()` e non esporta nulla. `@vercel/node` si aspetta un export (default) dell'app/handler; `app.listen` in ambiente serverless non viene servito. Così com'è, il deploy Vercel del backend molto probabilmente non funziona — coerente con la fase POC (Docker locale), ma il target dichiarato è Vercel. → Approfondimento in Step 4.

### 🟡 4.4 — Tre pagine morte: `Allocation.tsx`, `Baseline.tsx`, `Ongoing.tsx`
1.126 righe complessive non importate da nessun file (verificato via grep su `frontend/src`). Sono i predecessori di `Pianificazione.tsx` e `Avanzamento.tsx`. Codice morto che confonde la navigazione, gonfia il type-check e rischia di essere modificato per errore.

### 🟡 4.5 — Il frontend non ha uno script `test`
`frontend/package.json` definisce `dev`, `build`, `lint`, `preview` — **manca `"test": "vitest"`** nonostante `vitest.config.ts`, `src/test/setup.ts` e 2 file di test esistano. CLAUDE.md e lo script root `nx run-many --target=test` presumono che esista: oggi `pnpm test` dalla root esegue solo i test backend, e i test FE non girano in alcuna pipeline. (Nel working tree è stato appena aggiunto `@vitest/coverage-v8` ai devDeps, ma lo script manca ancora.)

### 🟡 4.6 — CLAUDE.md significativamente disallineato dal codice
Il "Single Source of Truth" non riflette: `middleware/requireAuth.ts` (esiste e attivo), `routes/knowledge.ts`, `services/embeddings/` e `services/intelligence/`, `phaseFinancialEngine.ts`, migrazioni 009–013, componenti `RetrospectiveModal`/`SimilarProjects`/`SlippageModal`, `utils/formatCurrency.ts`. Riferisce inoltre file inesistenti: `NEXT_STEPS.md` (esiste `NEXT_STEPS_COMPLETO.md`) e `PROMPT.md` (assente). Anche la sezione "Open Issues" è superata (Step E–H risultano implementati nel codice).

### 🟢 4.7 — Anomalie minori
- `package-lock.json` presente su disco alla root (non tracciato) in un monorepo pnpm: indica un `npm install` accidentale; da eliminare per evitare risoluzioni divergenti.
- `routes.test.ts` da 1.333 righe in un singolo file: funziona, ma è il candidato naturale a uno split per dominio.
- `.DS_Store` tracciati in git (root, `backend/`, `frontend/`) — artefatti macOS da rimuovere e ignorare.
- File non tracciati alla radice (`verify-app.mjs`, `docs/INDEX.md`, `docs/CONVENTIONS.md`, ecc.): lavoro in corso da committare o scartare consapevolmente.
- `nx.json` senza `targetDefaults`/cache: NX non porta oggi alcun beneficio rispetto a `pnpm -r run` — o si configura (cache, `dependsOn`) o è una dipendenza superflua.

---

## 5. Prime impressioni (sintesi)

**Punti di forza.** Separazione dei layer pulita e coerente (route → service → db; page → api → client), provider pattern applicato tre volte in modo uniforme (ongoing, embeddings, intelligence), migrazioni sequenziali con runner tracciato, test co-locati con dependency injection per testare senza DB. Le convenzioni dichiarate sono in gran parte rispettate.

**Rischi principali.** (1) La catena di deploy Vercel è rotta in due punti (no fallback SPA, backend non esportato) — il target dichiarato del POC oggi non è raggiungibile. (2) La documentazione SSoT è indietro di parecchi step rispetto al codice, il che in un progetto guidato da sessioni AI è un moltiplicatore di errori. (3) Codice morto e test FE fuori pipeline riducono l'affidabilità del segnale di qualità.

| # | Anomalia | Severità |
|---|---|---|
| 4.1 | `.env.local` tracciato in git | 🔴 |
| 4.2 | Manca fallback SPA in `vercel.json` | 🔴 |
| 4.3 | Backend non esporta l'app per `@vercel/node` | 🔴 |
| 4.4 | 3 pagine morte (~1.100 righe) | 🟡 |
| 4.5 | Script `test` frontend assente | 🟡 |
| 4.6 | CLAUDE.md disallineato | 🟡 |
| 4.7 | Lockfile npm spurio, `.DS_Store`, NX non configurato | 🟢 |

---

*Fine Step 1 — in attesa di conferma per procedere allo Step 2 (Visual & Layout Audit).*
