# EDIP — Next Steps (completo): Bug architetturali + Delivery Knowledge Graph

> Branch: `feature/leGenn`
> Data analisi: 9 giugno 2026 — Ultima revisione: 9 giugno 2026
> Commit implementazione: `ac6cc9f`

---

## 1. Stato verificato (testato, non dichiarato)

Ho clonato il branch, installato le dipendenze ed eseguito build e test. Questi sono i fatti:

| Area | Stato | Verifica |
|------|-------|----------|
| 7 fix architetturali (Steps A–I) | ✅ reali | Letti uno per uno nel codice |
| Forecast phase-aware | ✅ reale | `dashboard.ts` usa `computeProjectFinancials`; il burn flat sopravvive solo come KPI legacy di display, non guida più il forecast |
| FTE cap enforcement | ✅ solido | Transazione + `pg_advisory_xact_lock` + DELETE-first + check + 409 |
| Auth + ownership | ✅ reale | Supabase, `requireAuth`, filtro `WHERE p.pm_id = $1` per ruolo `pm` |
| Bug 2.1 — doppio sistema actuals | ✅ risolto | `dashboard.ts` usa rollup; `phase_id` obbligatorio su POST `/ongoing`; fallback legacy per snapshot pre-migrazione |
| Bug 2.2 — `day_rate` riscrive storia | ✅ risolto | Migrazione 011 + `ResourceDayRateHistory`; cascade limitato a `DATE_TRUNC('week', CURRENT_DATE)` |
| Bug 2.3 — N+1 in phaseFinancialEngine | ✅ risolto | 3 query batch (`ANY` + `DISTINCT ON`) invece di `1 + 2N` |
| Knowledge Graph (schema + CRUD + UI) | ✅ implementato | Migrazioni 012–013; route `/api/projects/:id/*`; form Scoping/Slippage/Retro |
| KG retrieval strutturato | ✅ implementato | `GET /api/projects/similar` con `?|` JSONB tag-match |
| KG pgvector + embedding service | ✅ implementato | Migrazione 013 + `embeddingService.ts` (guard: skip se no API key o desc ≤ 20ch) |
| KG IntelligenceProvider | ✅ implementato | `NoOpProvider` + `ClaudeProvider` (cold-start guard < 3, error fallback) |
| Quality fixes post code-review | ✅ applicati | `withTransaction` atomica; `budget_spent` SUM per fase; `total_hours/working_days_used` nel rollup; `NaN` guard su `phase_id`; auto-select fase in Avanzamento |
| Test | ✅ 116/116 verde | +22 test rispetto all'analisi iniziale (94 → 116) |
| TypeScript | ✅ 0 errori | `tsc --noEmit` pulito su BE e FE |

**Verdetto:** lo strato di integrità finanziaria è chiuso e robusto, i tre bug architetturali sono stati corretti, il Knowledge Graph è stato implementato dalla cattura alla sintesi AI. Commit `ac6cc9f` su `feature/leGenn`.

---

## 2. Bug e problemi architetturali trovati nel codice

> **Tutti e tre i bug sono stati corretti nel commit `ac6cc9f`.** Le sezioni sotto sono mantenute come documentazione dell'analisi e del fix applicato.

### 2.1 — Doppio sistema di "actuals" non riconciliato — ✅ RISOLTO

Dopo lo Step E, `OngoingSnapshot.phase_id` è nullable: `NULL` = snapshot di progetto (legacy), valore = snapshot di fase. Il problema è che oggi **convivono due letture parallele**:

- `phaseFinancialEngine.ts` legge **solo** snapshot di fase (`WHERE project_id = $1 AND phase_id = $2`). Ignora gli snapshot project-level.
- `dashboard.ts` calcola il KPI `cost_spent` da uno snapshot **project-level**.

**Rottura concreta:** se un PM inserisce uno snapshot a livello di progetto (`phase_id NULL`), l'engine vede zero actuals per ogni fase → forecast = budget per tutte le fasi in corso, mentre il KPI di progetto mostra un costo speso. I due numeri si contraddicono nella stessa schermata.

**Fix applicato:** `phase_id` obbligatorio su `POST /ongoing` (400 se null). `dashboard.ts` usa `rollup.total_cost_spent` e i nuovi campi `rollup.total_hours_spent` / `rollup.total_working_days_used`. `phaseFinancialEngine.ts` aggiunge fallback legacy per snapshot pre-migrazione (`phase_id IS NULL`). `projects.ts GET /` usa `DISTINCT ON (phase_id) + SUM` per `budget_spent`/`hours_spent`. `Avanzamento.tsx` auto-seleziona la prima fase al caricamento.

### 2.2 — `day_rate` riscrive la storia — ✅ RISOLTO

Lo Step G fa il cascade tattico: cambi il `day_rate` di una risorsa e un `UPDATE` riscrive `weekly_cost` su **tutte** le `AllocationEntry` esistenti, comprese quelle passate. Funziona per la consistenza immediata, ma **distrugge la verità point-in-time**: se Vivek costava €400/gg a marzo e €450/gg da giugno, dopo il cambio tutto marzo risulta a €450.

**Perché è critico per il Knowledge Graph:** nel momento in cui il grafo inizia ad apprendere dallo storico ("l'ultima volta che hai usato microservizi con team junior la Build è slittata del 34%"), stai addestrando il modello su costi storici falsificati. Il fix va fatto **prima** di accumulare progetti completati, non dopo.

```sql
CREATE TABLE "ResourceDayRateHistory" (
  resource_id    INTEGER REFERENCES "Resource"(id),
  day_rate       NUMERIC NOT NULL,
  effective_from DATE NOT NULL,
  PRIMARY KEY (resource_id, effective_from)
);
-- weekly_cost si calcola sul rate vigente alla week_start, non sul rate corrente
```

**Fix applicato:** migrazione `011_resource_day_rate_history.sql` crea `ResourceDayRateHistory` con PK `(resource_id, effective_from)`. `PUT /resources/:id` (ora in `withTransaction`) inserisce il nuovo rate in history e aggiorna `AllocationEntry` solo per `week_start >= DATE_TRUNC('week', CURRENT_DATE)` — le entry passate sono immutabili.

### 2.3 — N+1 in phaseFinancialEngine — ✅ RISOLTO (parziale: batch query, no materialized view)

`computeProjectFinancials` fa un pattern **N+1**: un loop sulle fasi con, dentro, una query budget e una query snapshot per ogni fase. Per 1 progetto × 5 fasi = ~11 query, irrilevante. Ma la Capability 9 (Portfolio Dashboard) moltiplica per N progetti: N × M fasi × 2 query, ricalcolate a ogni GET. Non scala.

La decisione architetturale "PostgreSQL + materialized views" è già nelle tue note ma **non è ancora realizzata** — nessuna `MATERIALIZED VIEW` nelle migration. Prima del portfolio, introdurre `mv_phase_financials` (refresh on-write o schedulato) o almeno batchare le query in un'unica `JOIN` aggregata. Sforzo: 2–3 gg.

---

## 3. Il gap strategico: il Knowledge Graph non esiste

Ho cercato nello schema e nelle route qualsiasi traccia delle entità del moat. Le tabelle sono dieci, tutte operative/finanziarie:

```
User, Project, ProjectPhase, Resource, AllocationEntry,
OngoingSnapshot, Baseline, PublicHoliday, GanttTask, PhaseTemplate
```

Nessuna `Decision`, `Risk`, `Assumption`, `Retrospective`. Nessuno dei tre momenti di cattura è implementato.

**Perché è urgente e non rimandabile:** il valore del grafo viene dall'**accumulo**, e l'accumulo non si recupera a posteriori. Ogni progetto chiuso senza catturare decisioni e retrospettive è conoscenza persa per sempre. Non puoi aggiungere il grafo nell'anno 2 e pretendere che abbia 50 progetti di storia. L'orologio del moat parte quando scrivi la prima riga dello schema.

---

## 4. Knowledge Graph: serve l'AI, come si implementa, quanto costa

### 4.1 — Serve aggiungere un'AI? (risposta onesta)

**No, non per la parte che costruisce il moat.** Tre livelli, solo l'ultimo tocca l'AI:

| Livello | Cosa fa | Serve AI? |
|---------|---------|-----------|
| **Cattura** | Salva decisioni, rischi, slittamenti, retrospettive | ❌ No — form + schema, CRUD puro |
| **Retrieval** | Trova progetti passati simili | ⚠️ Opzionale — si parte con SQL, si migliora con embeddings |
| **Sintesi** | Trasforma lo storico in un consiglio leggibile | ✅ Sì, ma on-demand e leggero |

Il punto strategico: **il moat è la struttura dati accumulata, non l'AI.** L'AI è una lente sottile che rende i dati leggibili nei tre momenti. Se la togli, hai comunque un database di conoscenza organizzativa che nessun altro tool possiede. Per il posizionamento: EDIP non è "un PM tool con l'AI" (categoria affollata, copiabile) — è "la memoria cognitiva della delivery di un'azienda", e l'AI è solo il modo comodo di interrogarla. Coerente con il tuo scetticismo: l'AI qui è una comodità di retrieval, non il prodotto.

Conseguenza pratica: il **livello cattura** si spedisce subito, senza una sola chiamata API. Il moat accumula dal primo progetto.

### 4.2 — Come si implementa

**Livello cattura (zero AI).** Quattro tabelle che agganciano i tre momenti:

```sql
CREATE TABLE "Decision" (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES "Project"(id),
  phase_id   INTEGER REFERENCES "ProjectPhase"(id),
  author_id  INTEGER REFERENCES "User"(id),
  title TEXT NOT NULL,
  rationale TEXT,
  expected_consequence TEXT,   -- ciò che EDIP monitorerà nel tempo
  decided_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE "Risk" (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES "Project"(id),
  decision_id INTEGER REFERENCES "Decision"(id),  -- catena causale decisione→rischio
  category TEXT,        -- Budget / Timeline / Resource / Scope
  description TEXT,
  identified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE "SlippageEvent" (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES "Project"(id),
  phase_id   INTEGER REFERENCES "ProjectPhase"(id),
  expected BOOLEAN NOT NULL,   -- atteso o inatteso? (Momento 2)
  cause TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE "Retrospective" (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES "Project"(id),
  phase_id   INTEGER REFERENCES "ProjectPhase"(id),
  question TEXT,        -- generata da EDIP sui dati osservati
  answer TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

UI: tre form leggeri dentro il flusso esistente — **nessuna pagina "grafo" separata** (l'errore di UX da evitare):
- **Momento 1 (scoping):** campo "descrivi il progetto in 3 righe" + tag strutturati (tipo architettura, seniority team, cliente).
- **Momento 2 (delivery):** quando una fase slitta, prompt "atteso/inatteso + causa" → `SlippageEvent`.
- **Momento 3 (chiusura):** retrospettiva di 10 minuti, domande generate dai dati.

**Livello retrieval (parti senza AI).** Due gradini:
1. **Matching strutturato (SQL, da subito):** confronta tag e attributi. Deterministico, spiegabile, copre ~l'80% del valore dal progetto 1.
2. **Matching semantico (pgvector, quando hai testo):** embedding della descrizione in una colonna `vector`, ricerca nearest-neighbor. Gira dentro il Postgres che hai già — niente Databricks/Spark.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "Project" ADD COLUMN description_embedding vector(1024);
-- ricerca: ORDER BY description_embedding <=> $queryEmbedding LIMIT 5
```

**Livello sintesi (qui entra l'AI).** Solo nei tre momenti, on-demand, mai a ogni page-load. Riusa il **provider pattern** che hai già per Keyedin: astrai un `IntelligenceProvider` con `NoOpProvider` (sistema funziona senza AI) e `ClaudeProvider` (sostituibile/disinnescabile).

```typescript
interface IntelligenceProvider {
  summarizeScopingRisks(project, similarHistory): Promise<string>;
  generateRetroQuestions(project, observedData): Promise<string[]>;
}
```

**Cold start (da gestire esplicitamente):** con n < 3 progetti simili, **nessun consiglio** — solo cattura. Fingere insight su dati inesistenti distrugge fiducia. Mostra "sto imparando dai tuoi progetti" finché il grafo non ha massa.

### 4.3 — Quanto costa gestirlo

**Costo AI: trascurabile.** Prezzi API verificati al 9 giugno 2026 (per milione di token, input/output):

| Modello | Input | Output |
|---------|-------|--------|
| Claude Haiku 4.5 | $1 | $5 |
| Claude Sonnet 4.6 | $3 | $15 |
| Claude Opus 4.8 | $5 | $25 |

*Batch API −50%; prompt caching −90% sull'input ripetuto.*

Servono **2 chiamate per ciclo di vita di un progetto** (scoping + domande retro); la classificazione slittamenti è umana, zero AI. Stima con **Sonnet 4.6**:
- Scoping: ~6.000 token input + ~800 output ≈ **$0,03**
- Retro: ~3.000 input + ~500 output ≈ **$0,017**
- **Totale ≈ $0,05 per progetto** (≈ $0,10 con retry/sperimentazione). Anche con Opus 4.8 resti sotto **$0,08**.

Alla tua scala (beta, ~10–50 progetti attivi): **< $5/mese di produzione reale.** Budget con margine: **€20–50/mese**. Embeddings via provider dedicato: **< €1/mese**. `pgvector` nel Postgres esistente: **€0 infrastruttura**.

**Il costo vero non è il denaro:**

| Voce | Costo | Tipo |
|------|-------|------|
| Sviluppo (cattura + retrieval + sintesi) | ~4–6 settimane | Una tantum |
| API LLM in produzione | < €5/mese (budget €20–50) | Ricorrente, trascurabile |
| Embeddings + pgvector | < €1/mese + €0 infra | Ricorrente, trascurabile |
| **Tuning qualità retrieval** | attenzione umana continua | **Il costo reale** |
| **GDPR / data residency** | vedi sotto | **Da non sottovalutare** |

**GDPR — la voce da affrontare prima dei clienti italiani.** Mandando dati di progetto di clienti EU a un provider LLM US servono: **DPA** firmato, opzione **zero data retention** (Anthropic la offre — prompt non loggati né usati per training), idealmente **data residency EU** (disponibile, sovrapprezzo ~10–25% sul token rate per regione). Per system integrator italiani è una domanda che ti faranno in due: risolverla a livello contrattuale/architetturale **prima** del primo beta evita di rifare tutto. È anche argomento di vendita: "il modello apprende in-tenant, i tuoi dati non addestrano nessun altro".

---

## 5. Roadmap unificata

Bug e moat sequenziati insieme. Logica: la cattura del grafo parte **in parallelo** ai fix (sono additivi, nessun conflitto); i fix che bloccano il grafo vanno prima dei livelli che li usano.

| # | Step | Tipo | Sforzo | AI? | Blocca / Sblocca |
|---|------|------|--------|-----|------------------|
| 1 | **KG — schema cattura (4 tabelle) + 3 form** | Moat | 1–2 sett. | ❌ | Fa partire l'orologio del moat. Parte subito, in parallelo |
| 2 | **Bug 2.1 — riconciliazione actuals** | Fix | 1–2 gg | ❌ | Toglie l'incoerenza visibile in dashboard; sblocca fiducia nei numeri |
| 3 | **Bug 2.2 — `ResourceDayRateHistory`** | Fix | 2–3 gg | ❌ | Verità point-in-time **prima** che il grafo apprenda da storico falsato |
| 4 | **KG — retrieval strutturato (SQL su tag)** | Moat | 3–4 gg | ❌ | Valore dal progetto 1 |
| 5 | **Bug 2.3 — materialized view phase financials** | Fix | 2–3 gg | ❌ | Sblocca il Portfolio Dashboard senza degrado |
| 6 | **KG — pgvector + embeddings (semantico)** | Moat | 3–4 gg | ⚠️ | Matching sfumato quando lo strutturato non basta |
| 7 | **KG — `IntelligenceProvider` + sintesi Claude** | Moat | 1 sett. | ✅ | I tre momenti diventano "intelligenti", on-demand |
| 8 | **KG — cold-start + UX dei tre momenti** | Moat | 3–4 gg | ❌ | Onestà del prodotto sotto n<3 |
| 9 | **GDPR — DPA + zero-retention + residency EU** | Compliance | parallelo | — | Prerequisito per clienti EU; argomento di vendita |
| 10 | Keyedin: parser PDF/Excel | Integrazione | 1 sett. | ⚠️ | L'uso AI utile: elimina l'inserimento manuale snapshot |
| 11 | Portfolio Dashboard (Cap.9) | Feature | — | ❌ | Dopo lo Step 5 |
| 12 | Jira/ADO, Risk Engine "vero" | Feature | — | ⚠️ | **Rimandare.** Table-stakes copiabili; il Risk Engine ha senso solo quando il grafo ha dati |

---

## 6. Sintesi per il posizionamento

- **Il financial engine è chiuso e robusto** (94/94 test, forecast phase-aware): ti fa vincere la trattativa. È pronto.
- **Tre bug architetturali residui** (actuals, day_rate history, materialized view) sono da chiudere — il secondo prima che il grafo apprenda dallo storico.
- **Il Knowledge Graph è a zero**, ed è il vero moat: ti rende impossibile da abbandonare. L'orologio parte ora.
- **L'AI non è il prodotto, è la lente.** Il prodotto è il grafo accumulato. L'AI costa centesimi e si può spegnere; il grafo no.
- **Il costo gestionale dell'AI è un non-problema** (decine di euro/mese). I costi reali sono il tuo tempo di sviluppo e la qualità del retrieval.
- **La voce da affrontare per prima** non è tecnica ma contrattuale: GDPR / zero-retention per i clienti EU. Trasformala in argomento di vendita.

---

*Build e suite di test eseguiti sul branch `feature/leGenn`; un run end-to-end (React + Express + PostgreSQL) richiede DB ed env configurati e non è stato eseguito. Prezzi API verificati il 9 giugno 2026 da fonti pubbliche aggiornate; le stime di costo per-progetto sono ordini di grandezza, non un preventivo.*
