# Project Forecast App — Architettura as-is

> Branch: `feature/step-9-pianificazione`
> Data analisi: maggio 2026
> Scopo: fotografare lo stato attuale del codice, mappare il flusso dati reale,
> documentare le problematiche architetturali riscontrate e definire i passi
> correttivi in ordine di priorità.

---

## 1. Stato attuale

### 1.1 Cosa è stato implementato

**Backend** (Node + Express + TypeScript, PostgreSQL)

- 7 migrations applicate sequenzialmente:
  - `001` — `User`, `Project`, `ProjectPhase` (5 fasi enum, ordine 1–5)
  - `002` — `Resource` (registry centrale) e `AllocationEntry` (granularità mensile iniziale)
  - `003` — `OngoingSnapshot`
  - `004` — `AllocationEntry`: granularità da mensile a **settimanale** (`month` → `week_start`, `monthly_cost` → `weekly_cost`)
  - `005` — `Baseline`, `PublicHoliday` (festività IT 2025–27), `GanttTask`, status `on_hold`
  - `006` — `Project.keyedin_code` per mapping verso API esterna
  - `007` — `ProjectPhase.display_name` configurabile + tabella `PhaseTemplate` per default di nuovi progetti
- 8 route files: `projects`, `resources`, `baseline`, `allocations`, `ongoing`, `gantt`, `dashboard`, `phaseTemplates`
- Service `computations.ts`: NETWORKDAYS, validateFTE, calcolo revised forecast, RAG status
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
- Tabella `ShareLinkAccess`

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
baseline.total_budget = SUM(phase.budget) — calcolato live
```

**Punto importante**: `phase.budget` e `baseline.total_budget` **non sono colonne**.
Sono `SUM` ricalcolate ad ogni `GET /baseline` e `GET /dashboard`.
Solo `weekly_cost` è materializzato sulla singola `AllocationEntry`.

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
                       ↓ NESSUNA validazione Σ FTE cross-project
                     INSERT in AllocationEntry

FE chiama GET /allocation/warnings?week_start=X&resource_id=Y
    ↓ informativo, non bloccante
SELECT * FROM AllocationEntry WHERE resource_id = Y
    ↓ validateFTE() somma per week_start e ritorna isValid + excess
```

### 2.4 Baseline lock

```
POST /baseline/lock → Baseline.locked_at = NOW()
    ↓
PUT /baseline → blocca con check su locked_at ✓
PUT /allocation → NON controlla locked_at ✗
PUT /resources/:id → NON controlla locked_at ✗
```

---

## 3. Problematiche architetturali riscontrate

I problemi sono ordinati per criticità (impatto × frequenza). Ognuno ha:
file e linea di riferimento, descrizione del comportamento osservato, esempio
concreto di rottura, e fix proposto.

---

### ① Baseline lock non protegge il budget

**Severità:** critica
**File:** `backend/src/routes/allocations.ts:125` (PUT /allocation)

**Sintomo:**
`POST /baseline/lock` setta `locked_at` su `Baseline`. Il `PUT /baseline` controlla
correttamente questo flag e rifiuta modifiche. Ma `PUT /allocation` non legge mai
`Baseline.locked_at`. Siccome `phase.budget` è calcolato live come
`SUM(AllocationEntry.weekly_cost)`, modificando una cella di allocazione a
baseline lockata si altera retroattivamente il budget di fase salvato come
"baseline".

**Esempio:**
1. PM imposta baseline con Build = £42,500
2. PM preme "Blocca Baseline" → `locked_at` settato
3. PM cambia FTE Vivek su Build da 0.8 a 1.0 via PUT /allocation
4. `weekly_cost` di Vivek aumenta
5. GET /baseline ritorna `total_budget` aumentato — la baseline lockata è cambiata silenziosamente

**Protezione attuale:**
solo lato frontend, la UI disabilita gli input. Bypassabile con curl/Postman/script.

**Fix:**
```typescript
// In allocations.ts PUT, prima di BEGIN:
const lockCheck = await query(
  'SELECT locked_at FROM "Baseline" WHERE project_id = $1',
  [projectId]
);
if (lockCheck.rows[0]?.locked_at) {
  return res.status(400).json({
    error: 'Baseline is locked. Cannot modify allocations.'
  });
}
```

Stesso check va aggiunto a `PUT /resources/:id` se la risorsa è allocata su un
progetto con baseline lockata (vedi anche ④).

---

### ② Forecast non phase-aware

**Severità:** critica
**File:** `backend/src/routes/dashboard.ts:58`

**Sintomo:**
```typescript
const dailyBurnRate = totalWorkingDays > 0
  ? totalBudget / totalWorkingDays
  : 0;
```

Single burn rate flat di progetto. Lo stesso modello che la v15-v16 dell'Excel
ha già abbandonato. Build (FTE alto) e Closure (FTE basso) producono lo stesso
burn rate atteso, quindi il forecast non riflette la phase mix corrente.

**Esempio:**
Progetto con Build 85gg @ £500/gg = £42,500 e Closure 8gg @ £340/gg = £2,720.
Total: 93gg @ £484/gg medio. Ma se il progetto è nella fase Build, il burn
rate atteso reale è £500/gg, non £484/gg. La distorsione cresce quando le
fasi hanno burn rate molto diversi.

**Fix:**
Introdurre un `PhaseFinancialEngine` (Capability 1 del documento `EDIP_CAPABILITIES.md`):

```typescript
// Per ogni fase:
phase.burn_rate_per_day = phase.budget / phase.working_days;
phase.forecast = (
  phase.is_completed
    ? phase.actual_cost
    : phase.actual_cost + phase.burn_rate_per_day × phase.days_remaining
);

project.revised_forecast = SUM(phase.forecast);
```

Prerequisito: avere `actual_cost` per fase, non solo a livello progetto (vedi ⑤).

---

### ③ FTE cap 1.0 non enforced sulla scrittura

**Severità:** alta
**File:** `backend/src/routes/allocations.ts:125`

**Sintomo:**
`PUT /allocation` salva senza chiamare `validateFTE()`. L'endpoint
`GET /allocation/warnings` esiste ma è solo informativo. Il frontend lo usa
per mostrare semafori, non blocca.

Si può quindi scrivere via API:
- Progetto A: Vivek 0.8 FTE per settimana del 04/05/2026
- Progetto B: Vivek 0.7 FTE per stessa settimana
- Totale: 1.5 FTE → nessun errore lato server

**Fix:**

Opzione tattica (blocco hard):
```typescript
// In PUT /allocation, dopo aver calcolato weeklyCost, prima di INSERT:
const otherProjectsSum = await query(`
  SELECT COALESCE(SUM(fte), 0)::numeric as total_fte
  FROM "AllocationEntry"
  WHERE resource_id = $1
    AND week_start = $2
    AND project_id != $3
`, [resource_id, week_start, projectId]);

const localSum = allocationsForThisResourceThisWeek;
const total = parseFloat(otherProjectsSum.rows[0].total_fte) + localSum;

if (total > 1.0) {
  return res.status(409).json({
    error: 'FTE overallocation',
    resource_id, week_start,
    total_fte: total,
    excess: total - 1.0,
    other_projects: [...] // dettaglio
  });
}
```

Opzione soft (accetta ma marca):
aggiungere colonna `AllocationEntry.is_overallocated BOOLEAN` settata al salvataggio,
e renderla visibile nella DM view.

Raccomandazione: opzione tattica per il POC, in modo che il dato resti pulito.
La soft può aspettare quando arriverà la DM view e la negoziazione tra PM.

---

### ④ day_rate non versionato

**Severità:** media
**File:** `backend/src/routes/resources.ts:96` (PUT /resources/:id)

**Sintomo:**
`PUT /resources/:id` aggiorna `Resource.day_rate` ma non tocca `weekly_cost` delle
`AllocationEntry` già esistenti. `weekly_cost` è materializzato al momento dell'INSERT.

**Esempio:**
1. Vivek day_rate = £400. Allocato su Build, weekly_cost = £400 × 1.0 × 5 = £2,000
2. PM aggiorna Vivek day_rate a £450
3. GET /baseline ritorna ancora budget Build calcolato sui £400 (perché weekly_cost
   non è ricalcolato)
4. La pianificazione mostra dati stale finché non risalvi ogni fase

**Fix tattico** (1 ora):
dopo UPDATE su Resource, eseguire cascade UPDATE:
```sql
UPDATE "AllocationEntry"
SET weekly_cost = $newRate * fte * working_days
WHERE resource_id = $1;
```

**Fix architetturale** (consigliato a regime):
introdurre tracciamento storico del rate:
```sql
CREATE TABLE "ResourceDayRateHistory" (
  id SERIAL PRIMARY KEY,
  resource_id INTEGER REFERENCES "Resource"(id),
  day_rate DECIMAL(15,2) NOT NULL,
  effective_from DATE NOT NULL,
  UNIQUE(resource_id, effective_from)
);
```
e linkare ogni `AllocationEntry` al rate effettivo alla `week_start`. Niente cascade,
tracciabilità completa, supporto a aumenti retroattivi e backdating.

---

### ⑤ OngoingSnapshot project-level, budget phase-level

**Severità:** alta
**File:** `backend/src/db/migrations/003_ongoing_snapshot.sql`

**Sintomo:**
`OngoingSnapshot` ha `project_id` ma non `phase_id`. Gli actuals da Keyedin (o
inseriti manualmente) sono aggregati a livello di progetto.

**Conseguenze a catena:**
- Variance per fase non calcolabile
- Alert "Build sfora del 23%" impossibile
- Risk engine futuro non avrebbe dati granulari
- Il fix di ② (forecast phase-aware) è impossibile senza il fix di ⑤

**Asimmetria:** il piano vive su 5 fasi, il consuntivo è un unico totale.

**Fix:**
```sql
ALTER TABLE "OngoingSnapshot"
  ADD COLUMN phase_id INTEGER REFERENCES "ProjectPhase"(id);
-- NULL = aggregato di progetto (retrocompatibilità)
```

Per Keyedin: mappare i WBS code ai `ProjectPhase.id` tramite tabella di
mapping o convention nel `keyedin_code`. Per il fallback manuale: la UI di
`/avanzamento` deve chiedere "in quale fase è la spesa". Una volta fatto,
② diventa naturale.

---

### ⑥ Auth e ownership solo lato client

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

**Fix:**

1. Endpoint auth:
   ```typescript
   // backend/src/routes/auth.ts
   POST /api/auth/login → bcrypt.compare → jsonwebtoken.sign → { token, user }
   ```

2. Middleware:
   ```typescript
   // backend/src/middleware/requireAuth.ts
   const decoded = jwt.verify(req.headers.authorization, JWT_SECRET);
   req.user = { id, role };
   next();
   ```

3. Applicazione:
   ```typescript
   app.use('/api/projects', requireAuth, projectsRouter);
   // poi nei route: WHERE pm_id = $1 OR $role = 'dm'
   ```

DM views e share link sono workstream paralleli, ma logicamente vengono dopo
l'auth.

---

### ⑦ Baseline senza snapshot immutabile dei totali

**Severità:** media
**File:** `backend/src/db/migrations/005_missing_tables.sql:6`

**Sintomo:**
La tabella `Baseline` ha solo 3 campi: `project_id`, `contingency_pct`, `locked_at`.
Nessun `total_budget`, `total_forecast`, `total_working_days` salvato.
Tutto viene `SUM`-ato live al GET dall'`AllocationEntry` corrente.

**Conseguenza:** dopo il lock, qualsiasi modifica a una `AllocationEntry`
(problema ①) o cambio `day_rate` (problema ④) cambia retroattivamente "il
budget della baseline". Non si può confrontare la variance contro il piano
originale.

In linguaggio PM: non hai BAC (Budget at Completion) congelato, hai solo
una continua EAC (Estimate at Completion). Quindi variance = EAC − BAC
non è calcolabile.

**Fix:**
```sql
ALTER TABLE "Baseline"
  ADD COLUMN total_budget_at_lock DECIMAL(15,2),
  ADD COLUMN total_forecast_at_lock DECIMAL(15,2),
  ADD COLUMN total_working_days_at_lock INTEGER,
  ADD COLUMN phase_budgets_at_lock JSONB;
```

In `POST /baseline/lock`, prima di settare `locked_at`, calcolare e congelare
tutti i totali. Da quel momento:
- Il `Baseline` salvato è la BAC (immutabile)
- Le modifiche successive (se ① è anche risolto, non saranno permesse a baseline
  lockata) vivono sul working copy e producono EAC
- Variance reale e tracciabile

---

## 4. Ordine di esecuzione consigliato

Priorità per impatto/sforzo. I primi due fix sono piccoli ma sbloccano
integrità dei dati. Devono andare prima di tutto.

| # | Fix | Sforzo | Sblocca |
|---|---|---|---|
| 1 | ① Lock check su PUT /allocation | 1h | Integrità baseline |
| 2 | ⑦ Snapshot totali in Baseline | 0.5gg | Variance reali |
| 3 | ③ FTE cap enforcement sulla scrittura | 1gg | Integrità allocazione |
| 4 | ⑤ phase_id su OngoingSnapshot | 1gg | Prerequisito di ② |
| 5 | ② Phase Financial Engine | 2–3gg | Differenziatore EDIP |
| 6 | ④ day_rate cascade o versionamento | 1–2gg | Consistenza temporale |
| 7 | ⑥ Auth + ownership + middleware | 3–5gg | Uscita dal POC |

---

## 5. Note di chiusura

Tutte le problematiche elencate sono coerenti con la roadmap del documento
`EDIP_CAPABILITIES.md`. In particolare:

- Capability 1 (Phase Financial Engine) risolve ②, ⑤ e abilita ④
- Capability 2 (Configurable Phase Framework) richiede prima di tutto ⑦
- Capability 5 (AI Risk Engine) richiede ② e ⑤ già implementati
- Capability 7 (Stakeholder Portal) richiede ⑥

Quindi sistemare i fondamenti di questo elenco non è solo "debito tecnico":
è il prerequisito per tutto ciò che è stato pianificato come differenziatore.
