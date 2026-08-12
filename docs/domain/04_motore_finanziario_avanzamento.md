# Macro-Area 04 — Motore Finanziario, Forecast & Avanzamento (Actuals)

> Documento funzionale/di dominio. Basato sul codice reale del repository (non su CLAUDE.md).
> Riferimenti in formato `file:riga`.

---

## 1. Nome Modulo

**Motore Finanziario & Avanzamento (Forecast / Actuals)**

Componenti principali:
- `backend/src/services/computations.ts` — funzioni pure di calcolo (NETWORKDAYS, validazione FTE, forecast revisionato, RAG).
- `backend/src/services/phaseFinancialEngine.ts` — calcolo EAC/forecast per fase e rollup di progetto.
- `backend/src/routes/ongoing.ts` — API snapshot actuals + sync Keyedin.
- `backend/src/services/ongoing/*` — provider pattern per l'acquisizione actuals (manuale / Keyedin).
- `frontend/src/pages/avanzamento/*` — UI di inserimento snapshot, KPI e storico.
- `backend/src/db/migrations/003_ongoing_snapshot.sql`, `009_ongoing_phase_id.sql` — persistenza `OngoingSnapshot`.

---

## 2. Obiettivo di Business

Fornire una **previsione a finire (revised forecast / EAC — Estimate At Completion)** per ciascuna fase e per l'intero progetto, confrontandola con il **budget di baseline (BAC — Budget At Completion)** per evidenziare gli scostamenti (variance) e classificare lo stato di salute economica tramite semaforo **RAG**.

Il modulo sostituisce la logica di controllo economico che nell'Excel originale (`Project_Forecast_v16.xlsx`) veniva ricalcolata a mano: raccoglie i dati di avanzamento reale (**actuals**: costo speso, ore, giornate) e li combina con il budget pianificato per rispondere a "quanto costerà davvero il progetto rispetto a quanto avevamo previsto?".

Valore:
- Rilevare in anticipo fasi/progetti fuori budget (RAG rosso).
- Alimentare la dashboard con KPI di consumo (costo speso, % completamento, costo/ora, burn rate).
- Rendere l'acquisizione degli actuals sia automatica (Keyedin) sia manuale (fallback sempre disponibile).

---

## 3. Attori

- **Project Manager (PM)** — proprietario del progetto (`pm_id`): inserisce snapshot manuali, lancia il sync Keyedin, consulta KPI e forecast. Accesso governato da `requireAuth` + `requireProjectAccess` sul prefisso `/api/projects/:id`.
- **Delivery Manager (DM)** — ruolo che bypassa l'ownership (vede tutti i progetti).
- **Sistema esterno Keyedin** — sorgente automatica degli actuals via Reporting API + Core API (`KeyedinApiProvider.ts`).
- **Motore di calcolo (interno)** — `phaseFinancialEngine.ts`, invocato da dashboard/reporting per produrre il rollup finanziario.

---

## 4. Funzionalità Operative

1. **Inserimento snapshot actuals per fase** — `POST /api/projects/:id/ongoing` (`ongoing.ts:63`). Registra a una data di riferimento (`reporting_date`): costo speso, ore spese, GG lavorativi usati/rimanenti, per una fase specifica (`phase_id` **obbligatorio**).
2. **Lettura snapshot corrente + contesto** — `GET /api/projects/:id/ongoing` (`ongoing.ts:12`): ultimo snapshot, budget totale, GG lavorativi totali, elenco fasi. Filtrabile per `phase_id`.
3. **Storico snapshot** — `GET /api/projects/:id/ongoing/history` (`ongoing.ts:48`), filtrabile per fase.
4. **Cancellazione snapshot (finestra 24h)** — `DELETE /api/projects/:id/ongoing/:snapshotId` (`ongoing.ts:114`): consentita solo entro 24 ore dalla creazione; oltre → `403` (snapshot "bloccato").
5. **Sync automatico da Keyedin** — `POST /api/projects/:id/ongoing/sync` (`ongoing.ts:138`): estrae actuals da Reporting API e stima i GG rimanenti da Core API/expenditure.
6. **Fallback manuale** — `ManualFallbackProvider` (`ManualFallbackProvider.ts`) sempre disponibile per lettura/scrittura anche senza Keyedin.
7. **Calcolo forecast revisionato + variance + RAG per fase e progetto** — `computeProjectFinancials` (`phaseFinancialEngine.ts:36`).
8. **KPI di avanzamento (UI)** — `avanzamento/index.tsx:151-167`: % completamento, costo speso, % budget, costo/ora, burn rate storico, GG rimanenti.

---

## 5. Flussi di Lavoro

### 5.1 Inserimento manuale snapshot
1. PM apre pagina Avanzamento, seleziona la fase (`SnapshotForm.tsx:47`).
2. Inserisce ore spese → il form deriva automaticamente GG usati = `round(ore / 8)` e GG rimanenti = `max(0, totalWD − usati)` (`SnapshotForm.tsx:12-23`).
3. Conferma via modale (`index.tsx:177`).
4. POST valida input e verifica che `phase_id` appartenga al progetto (`ongoing.ts:86-92`), poi persiste con `source='manual'` (`ManualFallbackProvider.saveSnapshot`).

### 5.2 Sync Keyedin
1. PM clicca "Sync da Keyedin" (`index.tsx:123`).
2. `KeyedinApiProvider.syncData` (`KeyedinApiProvider.ts:130`): risolve `keyedin_code` del progetto; se assente → errore.
3. Fetch parallelo Reporting API (ore/costo) + Core API expenditure (`KeyedinApiProvider.ts:154`).
4. Deriva `working_days_used = round(hours / HOURS_PER_DAY)` (`ts:162`) e `working_days_remaining` da colonna report → expenditure → fallback `totalWD − used` (`ts:165-178`).
5. Persiste snapshot con `source='keyedin_api'`.

### 5.3 Calcolo forecast per stato fase (`phaseFinancialEngine.ts:97-162`)
Per ogni fase, budget = `SUM(weekly_cost)` delle `AllocationEntry` (`ts:54-63`); actuals = snapshot più recente della fase (`DISTINCT ON (phase_id)`, `ts:66-73`).

- **`completed`** → `revised_forecast = cost_spent` reale (`ts:115-117`).
- **`in_progress`** → media time-based / cost-based via `calculateRevisedForecast` (`ts:118-133`).
- **`not_started`** → `revised_forecast = budget` pianificato (`ts:134-137`).

### 5.4 Rollup di progetto (`phaseFinancialEngine.ts:164-190`)
- `total_budget`, `total_cost_spent`, `total_hours_spent`, `total_working_days_used`, `total_revised_forecast` = somma delle fasi.
- `total_variance = total_revised_forecast − total_budget`.
- RAG di progetto = `calculateRAGStatus(total_revised_forecast, total_budget)`.
- **Fallback legacy**: se nessuno snapshot per-fase esiste, recupera lo snapshot storico a `phase_id NULL` per popolare i totali (`ts:78-93`, `168-173`).

---

## 6. Regole di Business

### 6.1 Formula forecast per stato fase
| Stato fase | `revised_forecast` | `forecast_basis` | Rif. |
|---|---|---|---|
| `completed` | `cost_spent` (actual) | `completed` | `phaseFinancialEngine.ts:116` |
| `in_progress` | `calculateRevisedForecast(...)` | `in_progress` | `ts:125` |
| `not_started` | `budget` (pianificato) | `not_started` | `ts:135` |

### 6.2 Formula `calculateRevisedForecast` (`computations.ts:66-82`)
```
timeBasedForecast = cost_spent + (dailyBurnRate × daysRemaining)
se hoursSpent == 0:
    revised = timeBasedForecast
altrimenti:
    costBasedForecast = cost_spent + (avgCostPerHour × hoursRemaining)
    revised = (timeBasedForecast + costBasedForecast) / 2
```
Con (`phaseFinancialEngine.ts:119-123`):
- `dailyBurnRate = budget / working_days_total`
- `daysRemaining = max(0, working_days_total − working_days_used)`
- `avgCostPerHour = cost_spent / hours_spent`
- `hoursRemaining = max(0, planned_hours − hours_spent)`, con `planned_hours` fallback = `working_days_total × 8`

### 6.3 Variance
`variance = revised_forecast − budget` per fase (`ts:144`); `total_variance = total_revised_forecast − total_budget` (`ts:175`).

### 6.4 Soglie RAG (`computations.ts:90-103`)
Con `ratio = revised_forecast / baseline(BAC)` arrotondato a 4 decimali:
- **IN_LINEA** — `ratio ≤ 1.05`
- **A_RISCHIO** — `1.05 < ratio ≤ 1.15`
- **FUORI_BUDGET** — `ratio > 1.15`
- Casi limite: `baseline ≤ 0 && forecast > 0` → FUORI_BUDGET; `baseline ≤ 0 && forecast ≤ 0` → IN_LINEA; `budget == 0 && revised == 0` → IN_LINEA (`phaseFinancialEngine.ts:140-142`).

### 6.5 Validazione POST ongoing (`ongoing.ts:67-92`)
- `reporting_date` obbligatoria (stringa YYYY-MM-DD).
- `cost_spent_to_date` e `hours_spent_to_date` obbligatori e numerici.
- `phase_id` **obbligatorio** → gli snapshot devono essere legati a una fase specifica (`ongoing.ts:76-78`).
- `phase_id` deve essere intero valido e appartenere al progetto, altrimenti `400`.

### 6.6 Finestra di cancellazione
Snapshot eliminabile solo entro **24h** dalla creazione; oltre → `403` "Deletion window expired" (`ongoing.ts:124-127`). Coerente in UI (`SnapshotHistory.tsx:5-9`).

### 6.7 Provider pattern actuals
`OngoingDataProvider` (interfaccia, `OngoingDataProvider.ts:14`) con due implementazioni:
- `ManualFallbackProvider` — lettura/scrittura DB; `syncData` non supportato (throw).
- `KeyedinApiProvider` — `syncData` da API esterna; `saveSnapshot` non usato direttamente (throw), legge tramite fallback.
`source` vincolato a `'manual' | 'keyedin_api'` (CHECK in `003_ongoing_snapshot.sql:11`).

### 6.8 KPI derivati (UI, `avanzamento/index.tsx:156-167`)
- `% completamento = min(100, round(working_days_used / totalWD × 100))`
- `costo/ora = cost_spent / hours_spent`
- `burn rate storico = cost_spent / working_days_used`
- `% budget = round(cost_spent / budget_total × 100)`

### 6.9 Persistenza `OngoingSnapshot`
Migrazione `003` crea la tabella; `009` aggiunge `phase_id` (FK `ProjectPhase`, `ON DELETE SET NULL`, NULL = aggregato di progetto/legacy) + indice `(project_id, phase_id, reporting_date DESC)`.

---

## 7. Verifica CLAUDE.md

Complessivamente **accurato**. Riscontri:
- ✅ Soglie RAG (IN_LINEA ≤1.05, A_RISCHIO ≤1.15, FUORI_BUDGET >1.15) — confermate `computations.ts:96-101`.
- ✅ Logica forecast per stato fase (completed→cost_spent; in_progress→media time/cost-based; not_started→budget) con rollup — confermata `phaseFinancialEngine.ts:115-137`.
- ✅ Provider pattern Keyedin/manual con fallback — confermato.
- ✅ `weekly_cost` materializzato / `phase.budget = SUM(weekly_cost)` live — confermato `phaseFinancialEngine.ts:54-63`.
- ⚠️ **Imprecisione**: CLAUDE.md indica `phase_id` obbligatorio sul POST ongoing (vero, `ongoing.ts:76`), ma la migrazione consente ancora `phase_id NULL` e il codice mantiene un percorso legacy per snapshot a livello progetto (`phaseFinancialEngine.ts:78-93`). Il vincolo è applicativo, non a livello DB.
- ⚠️ La descrizione "RAG: IN_LINEA ≤ 1.05 · BAC" usa `revised_forecast` come baseline il **budget corrente (working copy)** delle allocazioni, non necessariamente il `total_budget_at_lock` della `Baseline`. Vedi Open Point.

---

## Open Point

1. **Baseline usata per RAG**: `computeProjectFinancials` calcola `budget` come `SUM(weekly_cost)` corrente delle `AllocationEntry` (working copy), non da `Baseline.total_budget_at_lock`. Il RAG confronta quindi forecast vs budget corrente, non vs BAC lockato. Verificare se è il comportamento voluto per il "controllo scostamento vs baseline".
2. **Sync Keyedin senza `phase_id`**: `KeyedinApiProvider.syncData` (`KeyedinApiProvider.ts:184-192`) crea lo snapshot **senza** `phase_id` → salvato NULL, mentre il POST manuale lo esige obbligatorio. Gli actuals sincronizzati finiscono quindi nel percorso legacy di progetto e non alimentano il forecast per-fase. Incoerenza da chiarire.
3. **`working_days_used` non validato lato POST manuale come obbligatorio** nel backend (validati solo cost/hours/phase_id, `ongoing.ts:67-78`); la UI lo deriva ma il contratto API lo accetta anche assente.
4. **`HOURS_PER_DAY` = 8** hardcoded sia FE (`SnapshotForm.ts:12`) sia BE (default env, `KeyedinApiProvider.ts:20`): assunzione di giornata lavorativa standard non parametrizzata per progetto.
