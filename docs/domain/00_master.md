# Master Document — Dominio & Business di Project Forecast App

> Documentazione di dominio ricostruita dal **codice reale** (non dai doc esistenti), il 2026-07-22,
> tramite analisi modulare per macro-area. Ogni macro-area ha un documento dedicato (link sotto);
> questo file è la sintesi trasversale + il dizionario del dominio.
>
> Metodo: 6 analisi parallele guidate da un Product Owner, ciascuna con lettura diretta di route,
> servizi, migrazioni e pagine. CLAUDE.md è stato usato solo come ipotesi e verificato voce per voce.

---

## 1. Visione Generale e Scopo

**Problema di business.** Il forecasting economico di progetti di delivery (consulenza/system
integration) vive tipicamente in un foglio Excel (`Project_Forecast_v16.xlsx`) che non scala su
più progetti e più Project Manager, non è multi-utente, non conserva la storia e non trasforma i
progetti chiusi in conoscenza riutilizzabile. Questa web app replica e supera quell'Excel.

**Cosa fa il software.** Permette a un PM di:
1. definire un progetto in **fasi** sequenziali con date pianificate;
2. **allocare risorse** settimana per settimana (matrice FTE), calcolando il costo pianificato;
3. **bloccare una baseline** (BAC) come riferimento immutabile;
4. registrare l'**avanzamento reale** (actuals, manuali o via Keyedin) e ottenere un **forecast a
   finire (EAC)** per fase con semaforo **RAG**;
5. visualizzare **Gantt** e **milestone**;
6. accumulare una **memoria istituzionale** (decisioni → rischi → slittamenti → retrospettive) e,
   sopra di essa, una **Estimate Intelligence** AI che suggerisce progetti simili e brief di rischio.

**Il moat dichiarato** non è il capacity planning (che ogni competitor ha) ma la **memoria
istituzionale strutturata + similarità semantica + lente AI**: le stime migliorano ad ogni progetto
chiuso (vedi `06_memoria_estimate_intelligence.md` e `../next_steps_new.md`).

**Attori del sistema:**
- **PM (Project Manager)** — possiede i propri progetti (`pm_id`), vede e modifica solo quelli.
- **DM (Delivery Manager)** — ruolo di governance: bypassa l'ownership, vede tutti i progetti.
- **Sistemi esterni:** Supabase (autenticazione), Keyedin (actuals, stub), Claude/OpenAI (AI opzionale).

**Stato:** POC, target deploy Vercel. Valuta di default nel codice: **£ / GBP** (non EUR).

---

## 2. Dizionario del Dominio (Ubiquitous Language)

| Termine | Definizione |
|---|---|
| **Project** | Iniziativa di delivery posseduta da un PM (`pm_id`), con status, tag, descrizione e (opz.) embedding. |
| **ProjectPhase** | Fase sequenziale del progetto (tipicamente 1–5) con date pianificate, `working_days`, status; "schedule vivo" editabile anche dopo il lock. |
| **PhaseTemplate** | Default di sistema per nuovi progetti (5 fasi; es. Feasibility con 10% di contingenza). |
| **Baseline / BAC** | *Budget At Completion* congelato al **lock**: snapshot immutabile (`total_budget_at_lock`, `phase_snapshot_at_lock` JSONB) contro cui si misurano gli scostamenti. |
| **Working copy** | Stato corrente di fasi/allocazioni, che resta modificabile dopo il lock senza alterare il BAC. |
| **Resource** | Voce del registro centrale condiviso cross-project, con `day_rate`; cancellabile solo se mai allocata. |
| **ResourceDayRateHistory** | Storico point-in-time del `day_rate` (`effective_from`): il costo riflette il rate in vigore alla settimana. |
| **AllocationEntry** | Cella risorsa × progetto × fase × settimana → `fte`, con `weekly_cost` materializzato all'INSERT. |
| **FTE** | Full-Time-Equivalent; frazione di capacità (0..1) di una risorsa su una settimana. Cap rigido **1.0** cross-project. |
| **weekly_cost** | `day_rate × fte × working_days_in_week`, calcolato e salvato all'INSERT. |
| **OngoingSnapshot** | Rilevazione di avanzamento reale (**actuals**) a una `reporting_date`, per fase, origine `manual`/`keyedin_api`. |
| **Actuals** | Dati reali consuntivati: costo speso, ore, giorni. |
| **EAC / Forecast rivisto** | *Estimate At Completion*: previsione a finire, calcolata per stato fase; base del RAG. |
| **Variance / Scostamento** | `revised_forecast − budget` (per fase e totale). |
| **RAG status** | Semaforo di salute economica su `ratio = forecast/budget`: **IN_LINEA** ≤1.05 · **A_RISCHIO** ≤1.15 · **FUORI_BUDGET** >1.15. |
| **Burn rate** | `budget / working_days_total` (giornaliero), usato nel forecast time-based. |
| **NETWORKDAYS** | Giorni lavorativi (Lun–Ven) tra due date, esclusi weekend e **festività IT** pre-seeded. |
| **Capacity heatmap** | Vista densa domanda-vs-offerta cross-project; capacità fissa 1.0 FTE/settimana; bande <0.5 / 0.5–1.0 / >1.0. |
| **GanttTask** | Entità unica per **task** (barra) e **milestone** (rombo), discriminante `is_milestone`; FK a progetto e fase. |
| **Milestone** | Task puntuale (`end_date = start_date`); unica entità che usa `actual_date` (planned vs actual). |
| **Decision** | Decisione di progetto (`title`, `rationale`, `expected_consequence`); radice della catena causale del KG. |
| **Risk** | Rischio con `category` ∈ {Budget, Timeline, Resource, Scope}, opz. legato a una Decision (`decision_id`). |
| **SlippageEvent** | Evento di slittamento con flag `expected` (atteso/inatteso) + causa; segnale di delivery. |
| **Retrospective** | Coppia domanda/risposta di chiusura progetto; alimenta lo storico per stime future. |
| **description_embedding** | Vettore `vector(1536)` (OpenAI) sulla descrizione; ricalcolato solo se descrizione >20 char e con `EMBEDDING_API_KEY`. |
| **Cold-start** | Sotto **3** progetti simili nessun brief AI (evita insight fabbricati). |
| **Provider pattern** | `IntelligenceProvider` (Claude/NoOp), `EmbeddingProvider` (OpenAI/NoOp), `OngoingDataProvider` (Keyedin/Manual): degradano a NoOp senza API key. |
| **Ownership (`pm_id`)** | Relazione di proprietà progetto↔PM; base del multi-tenancy. |
| **Provisioning** | Presenza dell'utente nella tabella `User` collegata a Supabase via `supabase_uid`; senza → 403. |
| **Policy 404-non-403** | Risorse inesistenti e risorse altrui restituiscono entrambe 404 (enumeration protection). |

---

## 3. Indice delle Macro-Aree

| # | Documento | Dominio | Entità principali |
|---|-----------|---------|-------------------|
| 01 | [Accesso & Multi-tenancy](./01_accesso_multitenancy.md) | Auth Supabase, ruoli, ownership, sessione | User |
| 02 | [Progetti & Portfolio](./02_progetti_portfolio.md) | Lifecycle, status, tag, portfolio, cruscotto KPI, RAG | Project |
| 03 | [Pianificazione](./03_pianificazione.md) | Fasi, Baseline/BAC, Risorse, Matrice FTE, Capacity | ProjectPhase, Baseline, Resource, AllocationEntry, PhaseTemplate |
| 04 | [Motore Finanziario & Avanzamento](./04_motore_finanziario_avanzamento.md) | EAC/forecast, RAG, actuals, Keyedin | OngoingSnapshot |
| 05 | [Timeline: Gantt & Milestone](./05_timeline_gantt.md) | Task/milestone, planned vs actual, viste | GanttTask |
| 06 | [Memoria & Estimate Intelligence](./06_memoria_estimate_intelligence.md) | Knowledge Graph + similarità semantica + AI | Decision, Risk, SlippageEvent, Retrospective |

---

## 4. Flusso di Business End-to-End

```
[01] PM autenticato (Supabase + provisioning) — vede solo i propri progetti (pm_id)
      │
[02] Crea/apre un Project (status active, tag di scoping)
      │
[03] Definisce le ProjectPhase (da PhaseTemplate) → alloca Resource per settimana (matrice FTE, cap 1.0)
      │   weekly_cost materializzato · phase.budget = SUM(weekly_cost) live
      ├─► LOCK Baseline → BAC immutabile (total_budget_at_lock, phase_snapshot_at_lock)
      │
[04] Durante la delivery registra OngoingSnapshot (manuale o Keyedin) per fase
      │   phaseFinancialEngine calcola revised_forecast per stato fase → rollup progetto → RAG
      │
[05] Gantt/milestone visualizzano planned vs actual
      │
[06] Cattura Decision→Risk, SlippageEvent, Retrospective (memoria istituzionale)
          Estimate Intelligence: progetti simili (kNN) + risk brief AI (cold-start ≥3) → migliora la stima successiva
```

---

## 5. Regole di Business Trasversali (cross-cutting)

1. **Multi-tenancy per ownership** — PM: `WHERE pm_id = userId`; DM bypassa. Le route figlie di
   `/api/projects/:id` ereditano il guard `requireAuth + requireProjectAccess` montato una volta.
   Le route `/api/resources/*` sono `requireAuth`-only e **cross-project by design**.
2. **404 mai 403** per risorse inesistenti o altrui; `403` solo per utente non provisioned; `409`
   per violazioni di business (cap FTE con breakdown); `500` sempre generico (mai `err.message`).
3. **Cap FTE 1.0** per (risorsa, settimana) cross-project — advisory lock transazionale + DELETE-first.
4. **weekly_cost** materializzato all'INSERT = `day_rate × fte × working_days_in_week`;
   **phase.budget** = `SUM(weekly_cost)` ricalcolato live ad ogni GET.
5. **Baseline immutabile** al lock; la working copy resta modificabile → la variance ha un riferimento fisso.
6. **NETWORKDAYS + festività IT** per ogni calcolo di giorni lavorativi/working_days.
7. **Soglie RAG** uniche (1.05 / 1.15) condivise tra dashboard, portfolio e BudgetBar.
8. **Graceful degradation AI** — ogni provider (Claude/OpenAI/Keyedin) ha un NoOp/fallback:
   nessuna feature AI genera mai errore; cold-start <3 → nessun insight.
9. **Transazioni** solo via `withTransaction()`; mai `query('BEGIN')` sul pool.

---

## 6. Verifica dello Stato di CLAUDE.md

**Complessivamente accurato** dopo il riallineamento post-audit: architettura, guard di sicurezza,
Knowledge Graph, provider pattern, migrazioni 001–014 e milestone M-001→M-005 corrispondono al codice.

**Imprecisioni/omissioni rilevate durante l'analisi** (dettaglio negli Open Point di ciascun doc):

| Area | Nota |
|---|---|
| 01 | Omette: policy `403 User not provisioned`; identità `dm` iniettata dal bypass di test; degradazione `503` senza credenziali Supabase; `requireRole` presente ma inutilizzato. |
| 02 | In lista la separazione PM è via filtro `pm_id`, **non** 404. Valuta reale di default **£/GBP** (non EUR). La dashboard calcola i giorni rimanenti **senza** festività (incoerente con la lista). |
| 03 | Le route `/api/resources/*` sono `requireAuth`-only cross-project (non `requireProjectAccess`). Cascade day-rate limitato al **futuro** (`week ≥ CURRENT_DATE`). |
| 04 | Il RAG confronta forecast vs **budget corrente**, non vs BAC lockato. Il sync Keyedin salva snapshot **senza** `phase_id` mentre il POST manuale lo esige obbligatorio. |
| 05 | Il layout documenta `Gantt.tsx` come file singolo; il codice reale è la cartella `pages/gantt/`. |
| 06 | Non documenta il modello `claude-haiku-4-5-20251001`; embedding è `vector(1536)` OpenAI. |

---

## 7. Open Point consolidati (da chiarire con il business/tech)

Raggruppati; il dettaglio con file:riga è nei singoli documenti di macro-area.

**Coerenza di calcolo**
- Giorni rimanenti: dashboard senza festività vs lista con festività (02, OP1).
- RAG vs **BAC lockato** invece che budget corrente: da confermare la semantica voluta (04).
- Soglie semaforo capacità: divergenza 0.5 vs 0.8 tra heatmap e FTECell (03).
- `working_days` del Gantt ignora le festività e non viene ricalcolato in PUT (05).

**Modello dati / vincoli**
- `status = on_hold` non presente nel CHECK originale a DB (03).
- Constraint `unique_allocation` ancora a granularità mensile (03).
- Colonna legacy `ProjectPhase.budget` inutilizzata (03).
- `author_id` delle Decision non valorizzato; `decided_at` non validato (06).

**Integrazione**
- Sync Keyedin salva snapshot senza `phase_id`: comportamento vs vincolo del POST manuale (04).

**Nota:** gli item di *sicurezza/manutenzione* (requireRole non wired, helmet/rate-limit, ecc.) e le
*feature future* NON sono open point di dominio → vivono in [`../../backlog.md`](../../backlog.md).
