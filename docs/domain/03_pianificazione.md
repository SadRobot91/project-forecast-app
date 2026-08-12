# Macro-Area 03 — Pianificazione: Fasi, Baseline, Risorse, Allocazioni

> Documento funzionale derivato dal codice reale. Riferimenti in formato `file:riga`.

---

## 1. Nome Modulo

**Pianificazione** — il cuore dell'applicazione. Comprende quattro sotto-domini
strettamente collegati:

- **Fasi & Date** (`ProjectPhase`) — schedule del progetto
- **Baseline / BAC** (`Baseline`) — congelamento del budget di riferimento
- **Risorse** (`Resource`, `ResourceDayRateHistory`) — registro centrale condiviso
- **Allocazioni** (`AllocationEntry`) — matrice risorsa × fase × settimana → FTE

Frontend: pagina `Pianificazione` con tab "Fasi & Date" e "Risorse & Budget"
(`frontend/src/pages/pianificazione/index.tsx:12,190-193`); registro cross-project
e capacity heatmap in `frontend/src/pages/Resources.tsx`.

---

## 2. Obiettivo di Business

Sostituire e superare il foglio Excel `Project_Forecast_v16.xlsx` nella parte di
pianificazione: definire le fasi di un progetto con date e contingenza, allocare
risorse settimana per settimana con controllo di sovra-allocazione cross-progetto,
materializzare il costo pianificato, e congelare una **baseline (BAC — Budget At
Completion)** immutabile contro cui misurare gli scostamenti successivi.

Il registro risorse è **condiviso tra tutti i progetti**: consente di vedere la
domanda aggregata di ogni persona su tutte le commesse e di prevenire che una risorsa
superi la propria capacità settimanale (1.0 FTE).

---

## 3. Attori

| Attore | Ruolo | Accesso |
|---|---|---|
| **PM (project manager)** | Proprietario del progetto (`pm_id`) | Pianifica solo i propri progetti; il registro risorse e la heatmap sono cross-project |
| **DM (delivery manager)** | Supervisore | Bypassa l'ownership `pm_id` (guard `requireProjectAccess`) — vede/edita tutti i progetti |
| **Sistema** | Motore calcoli | Materializza `weekly_cost`, ricalcola `working_days`/`planned_hours`, costruisce snapshot BAC |

Le route sotto `/api/projects/:id/*` (phases, baseline, allocation) passano da
`requireAuth` + `requireProjectAccess`. Le route registro/heatmap/risorse
(`/api/resources/*`) sono solo sotto `requireAuth` — deliberatamente cross-project
(`backend/src/routes/resources.ts:20-23`).

---

## 4. Funzionalità Operative

### 4.1 Editare date e status delle fasi
`PATCH /api/projects/:id/phases/:phase_id` (`backend/src/routes/phases.ts:26`).
Working-copy update: aggiorna `planned_start`, `planned_end`, `status`. È **consentito
anche a baseline bloccata** — le date pianificate e lo status sono parte dello schedule
vivo, non del BAC (`phases.ts:10-16`). Quando cambiano le date, `working_days` e
`planned_hours` vengono ricalcolati via NETWORKDAYS meno festività IT
(`phases.ts:77-100`). Status validi: `not_started`, `in_progress`, `completed`,
`on_hold` (`phases.ts:7`).

### 4.2 Baseline: definizione parametri BAC
`PUT /api/projects/:id/baseline` (`backend/src/routes/baseline.ts:132`). Aggiorna i
parametri BAC delle fasi (`planned_start`, `planned_end`, `contingency_pct`,
`display_name`) in transazione. **Rifiutato con 400 se la baseline è già bloccata**
(`baseline.ts:164-167`). Crea la riga `Baseline` se assente (`ON CONFLICT DO NOTHING`,
`baseline.ts:209-213`).

### 4.3 Lock baseline / snapshot BAC
`POST /api/projects/:id/baseline/lock` (`backend/src/routes/baseline.ts:225`).
Costruisce lo snapshot immutabile PRIMA di impostare `locked_at`: somma budget,
forecast (budget + contingenza) e working days per fase, e serializza l'array fasi in
`phase_snapshot_at_lock` (JSONB) (`baseline.ts:236-256`). Idempotente: se già bloccata
restituisce il `locked_at` esistente (`baseline.ts:229-231`). Azione presentata come
**IRREVERSIBILE** all'utente (`index.tsx:170`).

### 4.4 Lettura baseline (vista live vs snapshot)
`GET /api/projects/:id/baseline` (`baseline.ts:80`). Se bloccata e con snapshot →
serve il BAC congelato; altrimenti calcola live da `ProjectPhase` +
`SUM(AllocationEntry.weekly_cost)` (`baseline.ts:99-112`). Il flag `served_from_snapshot`
distingue i due casi.

### 4.5 Matrice allocazioni FTE
- `GET /api/projects/:id/allocation` (`allocations.ts:62`) — matrice per fase con
  celle risorsa/settimana, budget fase, FTE medio, burn-rate/giorno.
- `PUT /api/projects/:id/allocation` (`allocations.ts:160`) — salva le allocazioni di
  **una fase** in transazione: advisory lock, DELETE-first, check cap FTE, INSERT
  multi-riga con `weekly_cost` materializzato. Consentito anche post-lock (working copy,
  `allocations.ts:199-202`).
- `GET /api/projects/:id/allocation/warnings` (`allocations.ts:309`) — verifica
  informativa Σ FTE ≤ 1.0 prima di scrivere.

UI: matrice editabile per fase in `PhaseBlock.tsx`; celle in `FTECell.tsx` (input 0–1,
semaforo cross-project).

### 4.6 CRUD risorse (registro centrale)
`backend/src/routes/resources.ts`: `GET /` (lista), `POST /` (crea, `day_rate > 0`
obbligatorio), `PUT /:id` (aggiorna + history + cascade), `DELETE /:id`. La delete è
**bloccata (400) se la risorsa è già allocata** (`resources.ts:156-159`). Creazione
anche inline dalla matrice via `AddResourceModal.tsx`.

### 4.7 Day-rate history (verità point-in-time)
Su `PUT /api/resources/:id` (`resources.ts:104`): registra il nuovo rate in
`ResourceDayRateHistory` (`effective_from = CURRENT_DATE`, upsert per giorno) e
propaga il nuovo `weekly_cost` **solo alle allocazioni della settimana corrente e
future** (`week_start >= DATE_TRUNC('week', CURRENT_DATE)`, `resources.ts:126-140`).
Le entry passate conservano il costo storico.

### 4.8 Phase Template (default nuovi progetti)
`backend/src/routes/phaseTemplates.ts`: `GET`, `POST` (nome univoco case-insensitive,
409 se duplicato), `PATCH`, `DELETE`. Ogni template ha `name` (chiave interna
immutabile), `display_name`, `order`, `default_contingency_pct`, `active`. Seed:
5 fasi standard con Feasibility al 10% di contingenza (`007_phase_display_name.sql:32-37`).

### 4.9 Capacity heatmap
`GET /api/resources/capacity-heatmap?weeks=12` (`resources.ts:38`). Griglia densa
risorsa × settimana su registro condiviso, orizzonte 1–52 settimane (default 12,
`resources.ts:41-43`), a partire dal lunedì corrente (fallback ultime N settimane se i
dati sono nel passato, `resources.ts:49-51`). Banda colore per cella. Montata in
`Resources.tsx:162` via `CapacityHeatmap.tsx`.

---

## 5. Flussi di Lavoro

### Flusso principale — dalla definizione al lock
1. **Definisci fasi e date** — tab "Fasi & Date": imposta `planned_start`/`planned_end`
   e `contingency_pct` per fase, rinomina inline. Salva → `PUT /baseline`
   (`index.tsx:100-125`, `FasiTab.tsx`).
2. **Alloca risorse per settimana** — tab "Risorse & Budget": per ogni fase, aggiungi
   risorse (dal registro o nuove) e imposta FTE settimanale in matrice. Salva fase →
   `PUT /allocation` (`PhaseBlock.tsx:97-113`). Il budget fase = Σ `weekly_cost` si
   aggiorna.
3. **Verifica capacità cross-project** — semaforo per cella (`FTECell`) + registro
   `Resources.tsx` + heatmap segnalano sovra-allocazioni.
4. **Blocca la baseline** — `POST /baseline/lock`: snapshot BAC immutabile. Da qui date,
   status e allocazioni restano modificabili (working copy) ma non alterano il BAC.

### Flusso registro risorse
Crea/aggiorna risorsa (`Resources`/`AddResourceModal`) → alla modifica del rate parte
il cascade point-in-time. Cancellazione possibile solo se mai allocata.

### Flusso post-lock (variance)
Le fasi (`PATCH /phases/:phase_id`) e le allocazioni (`PUT /allocation`) restano
editabili; la baseline serve lo snapshot congelato → gli scostamenti si misurano
contro `total_budget_at_lock` / `phase_snapshot_at_lock`.

---

## 6. Regole di Business

### R1 — Cap FTE 1.0 per (risorsa, settimana), cross-project
Somma degli FTE di una risorsa in una settimana su **tutti i progetti** ≤ 1.0. Enforced
al salvataggio allocazioni: check batch `getWeeklyTotalsBatch` (`allocations.ts:236`),
e se `wouldBe > 1.0` → **409** con breakdown per progetto (`allocations.ts:240-252`,
`allocationAggregator.ts:123-168`). Concorrenza gestita con **advisory lock
transazionali** `pg_advisory_xact_lock(resource_id, week_epoch)`, acquisiti in ordine
deterministico per evitare deadlock (`allocations.ts:205-221`). Pattern **DELETE-first**:
si cancellano le allocazioni della fase prima di reinserirle (`allocations.ts:224`).
Anche il constraint DB limita `fte` a 0.0–1.0 (`002_resource_registry.sql:17`).

### R2 — weekly_cost materializzato all'INSERT
`weekly_cost = day_rate × fte × working_days_in_week` calcolato e persistito
all'inserimento (`allocations.ts:275-278`), dove `working_days_in_week` è
l'intersezione della fase con la settimana Lun–Ven (`phaseWeekWorkingDays`,
`allocations.ts:41-59`). Non ricalcolato in lettura.

### R3 — phase.budget = SUM(weekly_cost)
Il budget di fase è sempre `COALESCE(SUM(ae.weekly_cost), 0)` calcolato live a ogni GET
(`baseline.ts:37`, `allocations.ts:119`). Non esiste una colonna budget mantenuta.

### R4 — Baseline BAC immutabile al lock
Al lock si materializzano `total_budget_at_lock`, `total_forecast_at_lock`,
`total_working_days_at_lock`, `phase_snapshot_at_lock` (`baseline.ts:243-256`,
`008_baseline_snapshot.sql`). Dopo il lock: `PUT /baseline` è rifiutato
(`baseline.ts:164-167`), ma working copy (fasi/allocazioni) resta mutabile. Formula
forecast per fase: `budget + budget × (contingency_pct / 100)`
(`baseline.ts:110,238`).

### R5 — Day-rate history point-in-time con cascade limitato al futuro
Il cambio di `day_rate` propaga il nuovo `weekly_cost` **solo** a
`week_start >= DATE_TRUNC('week', CURRENT_DATE)` (`resources.ts:135-140`); le entry
passate mantengono il costo originale (verità storica). Ogni cambio è tracciato in
`ResourceDayRateHistory` (`resources.ts:126-131`, `011_resource_day_rate_history.sql`).

### R6 — Bande capacità heatmap
`<0.5` = `under` (sotto-utilizzo), `0.5–1.0` = `optimal`, `>1.0` = `over`
(`resources.ts:24-28`). Capacità fissa a 1.0 FTE/settimana.

### R7 — Working days = NETWORKDAYS meno festività IT
`working_days` calcolato con `calculateNetworkDays` escludendo le festività IT
pre-caricate 2025–2027 (`phases.ts:78-80`, `baseline.ts:169-179`,
`005_missing_tables.sql:23-42`). `planned_hours = working_days × 8`.

### R8 — Ownership cross-progetto sulle scritture
Ogni UPDATE/INSERT filtra per `project_id` oltre che per id fase, per impedire di
modificare fasi/allocazioni di altri progetti (`baseline.ts:184-206`,
`allocations.ts:190-196`).

### R9 — Validazioni input
`contingency_pct` 0–100 (`baseline.ts:151-156`); `fte` numerico 0–1
(`allocations.ts:182`); `day_rate` > 0 (`resources.ts:88`); date `YYYY-MM-DD` e
`planned_end >= planned_start` (`phases.ts:71`, `allocations.ts:179`).

---

## 7. Verifica CLAUDE.md

Confronto tra `CLAUDE.md` (SSoT dichiarato) e codice reale:

| Affermazione CLAUDE.md | Esito |
|---|---|
| Cap FTE 1.0 con `canAllocate`/`getWeeklyTotalsBatch` + advisory lock transazionali | **Confermato** (`allocations.ts:205-252`) |
| `weekly_cost` materializzato all'INSERT = `day_rate × fte × working_days_in_week` | **Confermato** (`allocations.ts:275-278`) |
| `phase.budget = SUM(weekly_cost)` live a ogni GET | **Confermato** (`baseline.ts:37`) |
| `Baseline.total_budget_at_lock` snapshot immutabile al lock | **Confermato** (`baseline.ts:243-256`) |
| Day-rate history point-in-time | **Confermato** con precisazione: cascade solo `week >= CURRENT_DATE` (`resources.ts:135-140`) |
| Capacity heatmap bande `<0.5 / 0.5–1.0 / >1.0`, cap 1.0 FTE | **Confermato** (`resources.ts:24-28`) |
| `requireAuth` + `requireProjectAccess` su tutte le route dati | **Parzialmente**: `/api/resources/*` (registry, heatmap, CRUD) è solo `requireAuth`, cross-project by design — non `requireProjectAccess` |
| Migrazioni 001–014, prossima 015 | **Confermato** (elenco file coerente) |

CLAUDE.md è **accurato** sul modulo Pianificazione; le uniche precisazioni riguardano
il perimetro del guard sulle route `/api/resources` (deliberatamente cross-project) e
il limite temporale del cascade day-rate.

---

## Open Point

1. **Divergenza soglie semaforo FTE.** La banda heatmap backend è `<0.5 / 0.5–1.0 / >1.0`
   (`resources.ts:24-28`), ma la legenda UI della matrice allocazioni usa
   `<0.8 sottoutilizzo / 0.8–1.0 ottimale` (`index.tsx:231-233`, `Resources.tsx:224-226`,
   via `fteMeta`). Due convenzioni diverse coesistono — da chiarire quale è quella di
   business.
2. **Status `on_hold` non nel constraint DB originale.** `phases.ts:7` accetta `on_hold`,
   ma il CHECK di `ProjectPhase.status` in `001_initial_schema.sql:37` elenca solo
   `not_started/in_progress/completed`. Verificare se una migrazione successiva estende
   il constraint (non trovata tra 001–014); altrimenti un PATCH con `on_hold` fallirebbe
   a livello DB.
3. **Constraint `unique_allocation` a granularità mensile.** Definito su
   `(resource_id, project_id, phase_id, month)` in `002` e mai ridefinito su `week_start`
   dopo la rename `month→week_start` (`004`): valutare se il vincolo di unicità
   settimanale sia effettivamente attivo.
4. **`ProjectPhase.budget` colonna legacy.** Esiste in `001_initial_schema.sql:36` ma il
   budget effettivo è sempre calcolato via `SUM(weekly_cost)`; la colonna sembra inutilizzata.
