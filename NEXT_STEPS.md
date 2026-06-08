# Next Steps

> Branch corrente: `feature/leGenn`
> Riferimento architetturale: `ARCHITECTURE_AS_IS.md`

Steps A–H, D0, G, UX completati su `feature/leGenn`. Da mergiare su `main`.

---

## Stato attuale

| Step | Stato | Note |
|------|-------|------|
| A — Lock check PUT /allocation | ✅ done | Stopgap, rimosso da B |
| B — Snapshot BAC su Baseline | ✅ done | Migration 008 |
| C — AllocationAggregator service | ✅ done | Single source of truth Σ FTE |
| I — PATCH /phases/:id working copy | ✅ done | Backend e Frontend |
| D0 — `withTransaction` + `QueryFn` export | ✅ done | `db/index.ts` — prerequisito di D |
| D — FTE cap enforcement write | ✅ done | `withTransaction`, advisory locks, DELETE-first, 409 |
| E — `phase_id` su OngoingSnapshot | ✅ done | Migration 009, UI fase selector su /avanzamento |
| F — Phase Financial Engine | ✅ done | `phaseFinancialEngine.ts`, dashboard per-fase EAC |
| G — day_rate cascade | ✅ done | `PUT /resources/:id` cascades `weekly_cost` |
| H — Auth backend (Supabase) | ✅ done | `requireAuth` middleware, pm/dm filter, token refresh |
| UX QW — Quick wins UI | ✅ done | AppNav responsive, Login validation, formatCurrency, contrast |
| UX S7 — Tabelle responsive | ✅ done | overflow-x-auto, sticky col, mobile cards, gradient hint |
| UX S8 — Gantt fix | ✅ done | `flex-shrink-0` su celle timeline |
| J — Re-baselining con versioning | 🌱 future | Post-auth, fuori scope POC |

**Test:** 71/71 backend ✅ — 0 errori TypeScript FE+BE ✅

---

## Cosa rimane

### 1. Merge su `main`

```bash
git checkout main
git merge --no-ff feature/leGenn -m "Merge feature/leGenn: Steps D-H + UX improvements"
```

### 2. Setup Supabase per il deploy

Per far funzionare l'auth in produzione (Vercel):

1. Creare un progetto Supabase free tier
2. Creare gli utenti in Supabase Auth (email/password)
3. Popolare la colonna `User.supabase_uid` con il UUID Supabase per ogni utente:
   ```sql
   UPDATE "User" SET supabase_uid = '<uuid-da-supabase>' WHERE email = 'pm@example.com';
   ```
4. Impostare le variabili env su Vercel:
   - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (backend)
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (frontend)
5. Frontend: impostare `VITE_USE_MOCK=false` per usare auth reale

### 3. Applicare migrazioni 009 e 010 su DB di produzione

```bash
cd backend
pnpm run migrate
```

Migrazioni da applicare:
- `009_ongoing_phase_id.sql` — nullable `phase_id` su `OngoingSnapshot`
- `010_user_supabase_uid.sql` — `supabase_uid UUID UNIQUE` su `User`

---

## Step J — Re-baselining (fuori scope POC)

Schema proposto:
```sql
ALTER TABLE "Baseline" ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Baseline" ADD COLUMN effective_from DATE;
ALTER TABLE "Baseline" ADD COLUMN reason TEXT;
```

Workflow: PM richiede re-baseline con motivo → sponsor approva → nuovo record `Baseline v2` → dashboard ha selettore "Variance vs v1 / v2 / current".

Affrontare solo dopo che il POC ha convinto e c'è un caso reale.
