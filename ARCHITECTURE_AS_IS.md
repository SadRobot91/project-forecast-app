# Project Forecast App — Architettura as-is

> Branch: `main`
> Data analisi: maggio 2026
> Scopo: fotografare lo stato attuale del codice, mappare il flusso dati reale,
> documentare le problematiche architetturali riscontrate e definire i passi
> correttivi in ordine di priorità.

---

## 1. Stato attuale

### 1.1 Cosa è stato implementato

**Backend** (Node + Express + TypeScript, PostgreSQL)

- 8 migrations applicate sequenzialmente:
  - `001` — `User`, `Project`, `ProjectPhase` (5 fasi enum, ordine 1–5)
  - `002` — `Resource` (registry centrale) e `AllocationEntry` (granularità mensile iniziale)
  - `003` — `OngoingSnapshot`
  - `004` — `AllocationEntry`: granularità da mensile a **settimanale** (`month` → `week_start`, `monthly_cost` → `weekly_cost`)
  - `005` — `Baseline`, `PublicHoliday` (festività IT 2025–27), `GanttTask`, status `on_hold`
  - `006` — `Project.keyedin_code` per mapping verso API esterna
  - `007` — `ProjectPhase.display_name` configurabile + tabella `PhaseTemplate` per default di nuovi progetti
  - `008` — `Baseline`: snapshot BAC (`total_budget_at_lock`, `total_forecast_at_lock`, `total_working_days_at_lock`, `phase_snapshot_at_lock JSONB`)
- 9 route files: `projects`, `resources`, `baseline`, `allocations`, `phases`, `ongoing`, `gantt`, `dashboard`, `phaseTemplates`
- Service `computations.ts`: NETWORKDAYS, validateFTE, calcolo revised forecast, RAG status
- Service `allocationAggregator.ts`: `getWeeklyTotal`, `canAllocate`, `getRegistryAggregate` — single source of truth per Σ FTE
- Provider pattern per Keyedin: `OngoingDataProvider` interface, `ManualFallbackProvider`, `KeyedinApiProvider` (stub)

**Frontend** (React 18 + Vite + TypeScript)

- Pagina unificata `/pianificazione` con due tab: **Fasi** (date e contingenza) e **Risorse** (matrice allocazione settimanale)
- Pagina `/avanzamento` con snapshot manuali + bottone sync Keyedin
- `/dashboard` con KPI cards + tabella budget per fase + milestone tracker
- `/gantt` con tre viste collassabili
- `/resources` con registry centralizzato
- AuthContext con localStorage (token + user) — funzionante solo in mock mode

### 1.2 Cosa NON è ancora implementato

- Endpoint `/api/auth/login` e middleware JWT — il frontend gira in mock
- Filtro `pm_id` su query `Project` — nessuna ownership applicata
- Viste DM (`/dm/portfolio`, `/dm/resources`, `/dm/gantt`)
- Share link stakeholder (token, view read-only, tracking accessi)
- `phase_id` su `OngoingSnapshot` — actuals solo a livello progetto
- FTE cap enforcement sul write (Step D, piccolo)

---

## 2. Data Flow attuale

### 2.1 Catena di calcolo del budget

```
Resource.day_rate
    ↓
AllocationEntry (resource_id, project_id, phase_id, week_start, fte)
    ↓ INSERT calcola e materializza:
weekly_cost = day_rate × fte × working_days_in_week
    ↓ a ogni GET aggregato:
phase.budget = SUM(weekly_cost) WHERE phase_id = X
    ↓
baseline.total_budget = SUM(phase.budget) — calcolato live (working copy)
baseline.total_budget_at_lock — snapshot immutabile (BAC)
```

`phase.budget` e `baseline.total_budget` **non sono colonne**.
Sono `SUM` ricalcolate ad ogni `GET`. Solo `weekly_cost` è materializzato.
Il BAC (snapshot al lock) è invece frozen su `Baseline.total_budget_at_lock`.

### 2.2 Catena di calcolo del forecast

```
OngoingSnapshot (project-level: hours_spent, cost_spent)
    ↓ in dashboard.ts:
dailyBurnRate = totalBudget / totalWorkingDays   ← FLAT, non per fase
avgCostPerHour = costSpent / hoursSpent
    ↓
revisedForecast = avg(
  costSpent + dailyBurnRate × daysRemaining,
  costSpent + avgCostPerHour × hoursRemaining
)
    ↓
ragStatus = forecast / totalBudget
  ≤ 1.05 → IN_LINEA
  ≤ 1.15 → A_RISCHIO
  >  1.15 → FUORI_BUDGET
```

### 2.3 FTE validation

```
FE setta cella FTE → PUT /allocation
                       ↓ NESSUN check canAllocate (Step D non ancora fatto)
                     INSERT in AllocationEntry

FE chiama GET /allocation/warnings?week_start=X&resource_id=Y
    ↓ informativo, non bloccante
    → allocationAggregator.getWeeklyTotal() — centralizzato
```

### 2.4 Baseline lock

```
POST /baseline/lock → snapshot BAC congelato su Baseline + locked_at = NOW()
    ↓
PUT /baseline (parametri BAC: contingency, display_name) → rifiutato ✓
PUT /allocation → permesso ✓ (working copy, non tocca BAC)
PATCH /phases/:id (date, status) → permesso ✓ (working copy)
GET /baseline → serve snapshot frozen quando locked ✓
```

---

## 3. Problematiche architetturali aperte

I problemi sono ordinati per criticità. Ognuno ha file e linea di riferimento,
descrizione del comportamento osservato, esempio concreto di rottura, e fix proposto.

---

### ① Forecast non phase-aware

**Severità:** critica
**File:** `backend/src/routes/dashboard.ts:58`

**Sintomo:**
```typescript
const dailyBurnRate = totalWorkingDays > 0
  ? totalBudget / totalWorkingDays
  : 0;
```

Single burn rate flat di progetto. Build (FTE alto) e Closure (FTE basso) producono lo stesso
burn rate atteso, quindi il forecast non riflette la phase mix corrente.

**Esempio:**
Progetto con Build 85gg @ £500/gg = £42,500 e Closure 8gg @ £340/gg = £2,720.
Total: 93gg @ £484/gg medio. Ma se il progetto è nella fase Build, il burn
rate atteso reale è £500/gg, non £484/gg.

**Fix:**
Introdurre un `PhaseFinancialEngine` (Step F, dopo Step E):
```typescript
phase.burn_rate_per_day = phase.budget / phase.working_days;
phase.forecast = phase.is_completed
  ? phase.actual_cost
  : phase.actual_cost + phase.burn_rate_per_day * phase.days_remaining;
project.revised_forecast = SUM(phase.forecast);
```
Prerequisito: `actual_cost` per fase, non solo a livello progetto (Step E).

---

### ② FTE cap 1.0 non enforced sulla scrittura

**Severità:** alta
**File:** `backend/src/routes/allocations.ts:126` (PUT /allocation)

**Sintomo:**
`PUT /allocation` salva senza chiamare `canAllocate()`. L'endpoint
`GET /allocation/warnings` esiste ma è solo informativo.

Si può quindi scrivere via API:
- Progetto A: Vivek 0.8 FTE per settimana del 04/05/2026
- Progetto B: Vivek 0.7 FTE per stessa settimana
- Totale: 1.5 FTE → nessun errore lato server

**Fix (Step D, ~1h):**
```typescript
// In PUT /allocation, dentro la transazione, dopo pg_advisory_xact_lock:
const decision = await canAllocate(resource_id, week_start, fte, { excludeProjectId });
if (!decision.ok) {
  return res.status(409).json({ error: 'FTE overallocation', ...decision });
}
```
La logica è già in `allocationAggregator.canAllocate` — questo step la collega al write path.

---

### ③ day_rate non versionato

**Severità:** media
**File:** `backend/src/routes/resources.ts` (PUT /resources/:id)

**Sintomo:**
`PUT /resources/:id` aggiorna `Resource.day_rate` ma non tocca `weekly_cost` delle
`AllocationEntry` già esistenti. `weekly_cost` è materializzato al momento dell'INSERT.

**Fix tattico** (Step G, 1h):
```sql
UPDATE "AllocationEntry"
SET weekly_cost = $newRate * fte * working_days
WHERE resource_id = $1;
```

**Fix architetturale** (consigliato a regime):
Tabella `ResourceDayRateHistory` con `effective_from` + link da `AllocationEntry`
al rate effettivo alla `week_start`.

---

### ④ OngoingSnapshot project-level, budget phase-level

**Severità:** alta
**File:** `backend/src/db/migrations/003_ongoing_snapshot.sql`

**Sintomo:**
`OngoingSnapshot` ha `project_id` ma non `phase_id`. Gli actuals (da Keyedin o manuali)
sono aggregati a livello di progetto.

**Conseguenze a catena:**
- Variance per fase non calcolabile
- Alert "Build sfora del 23%" impossibile
- Il fix ① (forecast phase-aware) è impossibile senza questo

**Fix (Step E):**
```sql
ALTER TABLE "OngoingSnapshot"
  ADD COLUMN phase_id INTEGER REFERENCES "ProjectPhase"(id);
-- NULL = aggregato di progetto (retrocompatibilità)
```
UI `/avanzamento`: chiedere "in quale fase" al momento dello snapshot manuale.

---

### ⑤ Auth e ownership solo lato client

**Severità:** alta (bloccante per uscire dal POC)
**File:** `backend/src/index.ts`, tutti i route

**Sintomo:**
- Nessun endpoint `/api/auth/login` definito sul backend
- Nessun middleware `requireAuth` montato
- Nessun filtro `WHERE pm_id = $user_id` sui SELECT
- Tabella `User` esiste in schema ma è inutilizzata
- Il frontend usa `VITE_USE_MOCK=true` per simulare il login

**Rischio:** chiunque sulla rete locale può chiamare `GET /api/projects` e
vedere tutti i progetti di tutti i PM.

**Fix (Step H):** vedi `NEXT_STEPS.md`.

---

## 4. Ordine di esecuzione consigliato

| # | Fix | Sforzo | Sblocca |
|---|---|---|---|
| 1 | ② FTE cap enforcement write (Step D) | ~1h | Integrità allocazione |
| 2 | ④ phase_id su OngoingSnapshot (Step E) | 1gg | Prerequisito di ① |
| 3 | ① Phase Financial Engine (Step F) | 2–3gg | Differenziatore EDIP |
| 4 | ③ day_rate cascade (Step G) | 1h–1gg | Consistenza temporale |
| 5 | ⑤ Auth + ownership + middleware (Step H) | 3–5gg | Uscita dal POC |

---

## 5. Note di chiusura

Tutte le problematiche elencate sono coerenti con la roadmap del documento
`EDIP_CAPABILITIES.md`. In particolare:

- Capability 1 (Phase Financial Engine) risolve ①, ④ e abilita ③
- Capability 5 (AI Risk Engine) richiede ① e ④ già implementati
- Capability 7 (Stakeholder Portal) richiede ⑤
