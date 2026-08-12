# Macro-Area 02 — Progetti & Portfolio (+ Cruscotto/KPI)

> Documento funzionale derivato dal codice reale. Ogni regola è tracciata a `file:riga`.

## 1. Nome Modulo

**Progetti & Portfolio** — gestione dell'elenco progetti (vista PM e vista Portfolio DM),
cambio di stato del progetto, scoping (descrizione + tag), suggerimento di progetti simili
e **Cruscotto/Dashboard** di singolo progetto con KPI economici, budget per fase e milestone.

## 2. Obiettivo di Business

Sostituire il foglio Excel `Project_Forecast_v16.xlsx` con una vista unica che permette a
ogni Project Manager di monitorare a colpo d'occhio lo stato di salute economica dei propri
progetti (budget consumato, forecast rivisto, giorni al termine, semaforo RAG) e al Delivery
Manager di avere una vista aggregata di portfolio. Il modulo trasforma dati di allocazione e
avanzamento in indicatori decisionali immediati, riducendo il tempo di reporting manuale.

## 3. Attori

| Attore | Ruolo tecnico | Cosa vede/fa |
|---|---|---|
| **Project Manager (PM)** | `role = 'pm'` (`001_initial_schema.sql:8`) | Vede e opera **solo sui propri progetti** (filtro `pm_id`, `projects.ts:10-12`). Titolo pagina "I Tuoi Progetti" (`Projects.tsx:116`) |
| **Delivery Manager (DM)** | `role = 'dm'` | Vede **tutti** i progetti (nessun filtro, `projects.ts:10-12`). Titolo "Portfolio — Tutti i Progetti" (`Projects.tsx:116`) |

Ruoli ammessi dal vincolo DB: solo `pm` e `dm` (`001_initial_schema.sql:8`).

## 4. Funzionalità Operative

### 4.1 Lista progetti / Portfolio
`GET /api/projects` (`projects.ts:8`). Ritorna per ogni progetto: nome, stato, RAG,
fase corrente (fase in `in_progress`, `projects.ts:64-70`), budget totale live, budget speso,
% consumo, giorni rimanenti, valuta, descrizione, tag (`projects.ts:112-126`).

### 4.2 Filtro per stato (client-side)
La UI filtra su `all | active | on_hold | closed` (`Projects.tsx:28,106,127`). Il filtro
`archived` non è esposto tra i pulsanti.

### 4.3 Cambio di stato (ciclo rapido)
Click sul badge di stato → ciclo `active → on_hold → closed → active`
(`Projects.tsx:14,53-67`) via `PATCH /api/projects/:id/status` (`projects.ts:175`).
Aggiornamento ottimistico con rollback su errore (`Projects.tsx:58-66`).
Passando a `closed` si apre automaticamente il modale Retrospettiva (`Projects.tsx:61-63`).

### 4.4 Scoping (descrizione + tag)
Bottone "Modifica info" sulla card → modale con descrizione e gestione tag
(`Projects.tsx:69-104,218-285`). Salvataggio via `patchProjectScoping` (route knowledge,
fuori scope di questo modulo).

### 4.5 Dashboard / Cruscotto di progetto
`GET /api/projects/:id/dashboard` (`dashboard.ts:14`). Fornisce:
- **KPI** (`dashboard.ts:105-118`): costo speso, budget totale, forecast rivisto, burn rate
  giornaliero, varianza, giorni rimanenti, % budget, stato RAG, ultimo sync (data+fonte),
  ore consumate, giorni lavorativi usati.
- **Budget per fase** (`dashboard.ts:82-99`): budget, burn rate/giorno, % sul totale.
- **Milestone** (`dashboard.ts:45-51,121-128`): task Gantt con `is_milestone = true`,
  data pianificata, data effettiva, stato.

### 4.6 Progetti simili per tag
`GET /api/projects/similar?tags[]=...&exclude_id=N` (`projects.ts:137`). Restituisce fino a
5 progetti che condividono almeno un tag, ordinati per numero di tag in comune
(`projects.ts:150-159`). Vuoto se nessun tag passato (`projects.ts:145-147`).

## 5. Flussi di Lavoro

**F1 — Ingresso PM/DM in Portfolio**
1. `GET /api/projects` filtra per ruolo (PM → solo suoi; DM → tutti).
2. Per ogni riga il backend calcola RAG, budget live e giorni rimanenti (§6).
3. La UI mostra le card; il PM filtra per stato e apre un progetto.

**F2 — Chiusura progetto con retrospettiva**
1. PM cicla lo stato fino a `closed`.
2. `PATCH .../status` persiste; la UI apre il modale Retrospettiva (`Projects.tsx:61-63`).

**F3 — Analisi di singolo progetto**
1. Click sulla card → `/projects/:id/dashboard`.
2. `GET .../dashboard` compone KPI (via `phaseFinancialEngine`, `dashboard.ts:54`),
   budget per fase e milestone.

**F4 — Scoperta progetti simili**
1. Dato l'insieme di tag del progetto corrente, `GET .../similar` propone analoghi storici
   per riuso di stime/lezioni apprese.

## 6. Regole di Business

**R1 — Ownership in lista.** PM vede solo progetti con `pm_id = utente`; DM nessun filtro
(`projects.ts:10-12`). Regola di visibilità basata sul ruolo, non 403.

**R2 — Enum stato progetto.** Valori ammessi a DB: `active`, `on_hold`, `closed`, `archived`
(`005_missing_tables.sql:60-63`; la 001 nasceva senza `on_hold`, `001:17`). Il PATCH accetta
esattamente questi 4, altrimenti 400 (`projects.ts:179-181`). Il ciclo UI usa solo i primi 3
(`Projects.tsx:14`); `archived` è raggiungibile solo via API.

**R3 — Giorni rimanenti (NETWORKDAYS con festività IT).** Se esiste uno snapshot ongoing con
`working_days_remaining` lo si usa; altrimenti si calcolano i giorni lavorativi da oggi alla
`MAX(planned_end)` delle fasi, escludendo sabato/domenica e le festività italiane
(`PublicHoliday` country `IT`) (`projects.ts:79-102`, `computations.ts:1-28`). Se la fine è
passata → 0 ("Concluso" in UI, `Projects.tsx:192`).
Nota: la dashboard usa lo stesso calcolo ma **senza lista festività** (`dashboard.ts:73`,
array vuoto) — vedi Open Point.

**R4 — Stato RAG (semaforo forecast vs budget).** Soglie su `forecast/budget`
(`computations.ts:90-103`): `≤ 1.05 → IN_LINEA`, `≤ 1.15 → A_RISCHIO`, `> 1.15 → FUORI_BUDGET`.
Casi limite: budget ≤ 0 con forecast > 0 → FUORI_BUDGET; budget ≤ 0 e forecast ≤ 0 → IN_LINEA.
In lista il RAG deriva da `revisedForecast` calcolato per riga (`projects.ts:109-110`);
in dashboard dal rollup di `phaseFinancialEngine` (`dashboard.ts:77-78`).

**R5 — Forecast rivisto.** Media tra forecast time-based (`speso + burn×giorni`) e cost-based
(`speso + costo_medio_ora × ore_residue`); se nessuna ora consumata usa solo il time-based
(`computations.ts:66-82`).

**R6 — Tag come JSONB.** `Project.tags` è JSONB con default `[]` e indice GIN
(`012_knowledge_graph_capture.sql:6-9`). La similarità usa operatore overlap `?|` e conta i
match con `jsonb_array_elements_text` (`projects.ts:152-156`).

**R7 — Budget BAC vs totale live.**
- Budget **totale live** = `SUM(AllocationEntry.weekly_cost)` ricalcolato ad ogni GET
  (`projects.ts:18-22`, `dashboard.ts:25`); riflette la working copy, non è congelato.
- Budget **speso** = ultimo `cost_spent_to_date` per fase dagli `OngoingSnapshot`
  (`DISTINCT ON (phase_id)`, `projects.ts:23-31`).
- **% budget** = `round(speso / totale × 100)` (`projects.ts:91`, `dashboard.ts:79`).
- La `BudgetBar` colora la barra: `> 115 → rosso`, `> 105 → giallo`, altrimenti verde,
  larghezza clampata a 100% (`BudgetBar.tsx:6-11`). Le soglie visive coincidono con quelle RAG.
- Il BAC congelato (`Baseline.total_budget_at_lock`) è gestito dal modulo Baseline, non qui;
  la varianza in dashboard viene dal rollup del financial engine (`dashboard.ts:80`).

**R8 — Fase corrente.** È la prima fase in `in_progress` per `order` (`projects.ts:64-70`);
se assente la card mostra "—" (`Projects.tsx:173`).

**R9 — Valuta.** Default `GBP` a DB e in risposta (`001:16`, `projects.ts:123`); UI formatta
in £ (etichetta colonna "Budget £", `Dashboard.tsx:69`).

## 7. Verifica CLAUDE.md

Confronto tra CLAUDE.md e codice reale per quest'area:

- **Accurato**: filtro `pm_id` in lista con bypass DM; `/similar` tag-overlap; PATCH status;
  RAG con soglie 1.05/1.15; giorni rimanenti via NETWORKDAYS+festività IT; tag jsonb;
  budget totale live da `SUM(weekly_cost)`.
- **Impreciso / da sfumare**:
  - CLAUDE.md descrive `requireProjectAccess` che risponde **404** per progetti di altri PM.
    In lista la separazione è invece via **filtro `pm_id`** (non 404) (`projects.ts:10-12`);
    il 404 vale sulle route `/api/projects/:id/*`.
  - CLAUDE.md indica valuta di dominio implicitamente EUR/€, ma il default reale è **GBP/£**
    (`001:16`, `Dashboard.tsx:69`).
  - La dashboard calcola i giorni rimanenti **senza festività** (`dashboard.ts:73`), a
    differenza della lista che le include — non documentato.

## Open Point

- **OP1** — Incoerenza festività: `projects.ts` passa le festività IT a `calculateNetworkDays`,
  `dashboard.ts:73` passa `[]`. Voluto o bug? Produce giorni rimanenti diversi tra card e
  cruscotto per lo stesso progetto.
- **OP2** — Il ciclo di stato in UI non raggiunge `archived` (`Projects.tsx:14`); nessuna UI
  per archiviare/riattivare. È previsto un flusso di archiviazione o resta solo via API?
- **OP3** — `share_token` / `share_token_expires_at` esistono a schema (`001:18-19`) ma non
  risultano usati in questo modulo (feature condivisione dormiente).
- **OP4** — Valuta: default GBP ma festività/working days su calendario IT. Confermare la
  valuta target di business (GBP vs EUR) per label e formattazione.
</content>
</invoke>
