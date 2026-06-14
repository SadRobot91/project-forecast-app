# Plan

## Overview

Tre asset gia codificati ma morti (description_embedding mai letto, summarizeScopingRisks invocato con storia vuota, generateRetroQuestions senza rotta) impediscono il differenziatore unico: un forecasting la cui stima migliora a ogni progetto chiuso. Nessuna feature competitiva esce dalla memoria istituzionale finche questi non sono collegati.

**Approach**: Spedire prima i Quick Wins (zero migrazioni, massimo impatto demo) e poi le opportunita 3.1/3.2/3.3 ordinate per Impatto DESC poi Sforzo ASC, riusando architettura esistente (pgvector mig 013, Claude provider, KG mig 012, allocationAggregator, phaseFinancialEngine) prima di qualsiasi nuova dipendenza esterna. Ogni rotta degrada con NoOp quando le API key mancano; ogni feature rende in mock mode per la demo Vercel.

## Planning Context

### Decision Log

| ID | Decision | Reasoning Chain |
|---|---|---|
| DL-001 | Aggiungere una rotta semantica /similar-semantic affiancata alla /similar a tag, invece di riscrivere la logica tag | description_embedding e popolato solo con EMBEDDING_API_KEY + pgvector -> riscrivere /similar romperebbe la ricerca in assenza di embedding e in mock mode -> mantenere il tag-overlap come fallback sempre-attivo e aggiungere la cosine kNN come strato addizionale garantisce graceful degradation e demo funzionante senza API key |
| DL-002 | Le tre rotte di intelligence (semantic similarity, scoping-insight, retro-questions) vivono in un nuovo router backend/src/routes/intelligence.ts montato sotto /api/projects/:id, NON dentro knowledge.ts | il guard requireAuth+requireProjectAccess e gia montato una volta sul prefisso /api/projects/:id -> qualsiasi router figlio eredita ownership (404 per progetti altrui, dm bypassa) senza nuovo middleware -> raggruppare le tre feature AI/vettoriali in un router dedicato intelligence.ts (separato dal CRUD KG di knowledge.ts) tiene coesa la superficie Estimate Intelligence e deriva ogni vettore/contesto dal progetto :id, mai da input client |
| DL-003 | Costruire similarHistory reale per summarizeScopingRisks dai vicini semantici (fallback tag) arricchiti con varianza KG, e esporre il risk brief via GET /api/projects/:id/scoping-insight invece del fire-and-forget dentro POST /decisions | il guard cold-start (<3 progetti) scarta il brief quando similarHistory e vuoto -> il fire-and-forget in POST /decisions non puo mai produrre output e non e leggibile dal client -> una rotta GET dedicata che compone vicini + KG e ritorna il brief rende il valore visibile, cacheabile a livello UI e testabile, e lascia POST /decisions puro |
| DL-004 | Collegare generateRetroQuestions dietro GET /api/projects/:id/retro-questions calcolando RetroContext da dati esistenti (SlippageEvent, varianza da phaseFinancialEngine, fasi in ritardo) | generateRetroQuestions e implementato ma senza rotta -> serve un RetroContext reale per superare il guard (slippage_count o budget_variance != 0) -> aggregare slippage count/unexpected dal KG e variance/phases_delayed dal rollup gia calcolato produce domande specifiche e riusa motori esistenti senza nuova logica finanziaria |
| DL-005 | La heatmap capacita riusa getRegistryAggregate (matrice densa resource x week gia prodotta) con una rotta read-only GET /api/resources/capacity-heatmap, capacita per-risorsa fissata a 1.0 FTE/settimana | allocationAggregator gia restituisce rows con totals per settimana e flag has_overallocation -> aggiungere una vista derivata (colore per banda <0.5 sotto, 0.5-1.0 ottimale, >1.0 eccesso) evita nuove query e mantiene il tetto 1.0 coerente con canAllocate -> nessuna migrazione, capacita 1.0 e l invariante gia imposto dal cap FTE esistente |
| DL-006 | Le funzioni API frontend nuove passano tutte per withMock con dati in mockData.ts; fetchSimilarProjects viene avvolto in withMock (oggi chiama apiClient diretto) | la demo target gira su Vercel in mock mode (VITE_USE_MOCK) -> una rotta non-mockata romperebbe la narrazione demo senza backend -> incanalare ogni nuova chiamata in withMock(mockFn, realFn) e sanare la fetchSimilarProjects esistente garantisce che ogni feature renda senza API ne DB |
| DL-007 | Nessuna nuova migrazione DB in questo piano; prossima rimane 015 per lavori futuri (scorecard/scenario) | pgvector vector(1536)+indice cosine (mig 013) e schema KG (mig 012) esistono gia -> kNN read, scoping brief e retro questions sono puro collegamento -> evitare migrazioni mantiene il vincolo Quick-Wins-first e riduce il rischio di deploy serverless |
| DL-008 | La Tab Memoria Progetto (M-001) compone gli endpoint GET KG esistenti lato frontend in una timeline, senza nuovo endpoint aggregato backend | gli endpoint GET di knowledge.ts (decisions/risks/slippage/retrospectives) gia esistono e ritornano dati per progetto -> un nuovo endpoint aggregato BE duplicherebbe logica gia disponibile e aggiungerebbe superficie da testare -> comporre/ordinare la timeline nel componente frontend (Risk.decision_id risolto client-side contro le decisioni gia fetchate) e puro lavoro di composizione, coerente col Quick Win 1 zero-migrazioni e rende in mock mode |
| DL-009 | Il piano introduce 5 milestone (M-001..M-005): 2 Quick Wins (memoria KG, similar-semantic) + 3.1 scoping-insight + 3.3 retro-questions + 3.2 capacity-heatmap; nessuna troncatura di DL-003/004/005 | DL-003 (scoping-insight), DL-004 (retro-questions) e DL-005 (capacity heatmap) descrivono feature distinte con impatto Alto -> lasciarle senza milestone le renderebbe non eseguibili -> mappare ogni DL su un milestone dedicato e ordinarli per Impatto DESC poi Sforzo ASC (M-001 Quick Win comp, M-002 Quick Win semantic, M-003 scoping-insight 3.1, M-004 retro-questions 3.3, M-005 heatmap 3.2) rispetta il vincolo di ordinamento del context |

### Rejected Alternatives

| Alternative | Why Rejected |
|---|---|
| Partire da Scenario what-if (3.5) come prima feature differenziante | Sforzo M-L e richiede una nuova migrazione (scenario_id nullable), violando il vincolo 'riusare architettura esistente prima di nuove dipendenze' e l'ordinamento Impatto DESC/Sforzo ASC dei Quick Wins zero-migrazioni (context.json constraints[2], next_steps_new.md Sec 3.5) (ref: DL-007) |
| Tassonomia skill / fatturazione-margini / pianificatore assunzioni (3.6 + 2c) | Orizzonte Later della roadmap, modellazione nuova e ampia senza fondamenta esistenti; fuori scope esplicito del task (context.json out-of-scope, next_steps_new.md Sec 5) (ref: DL-007) |
| Riscrivere la logica tag di /similar sostituendola con la ricerca semantica | Romperebbe la ricerca in assenza di embedding e in mock mode; si mantiene il tag-overlap e si AGGIUNGE la rotta semantica affianco per graceful degradation (context.json rejected_alternatives[2], next_steps_new.md Sec 3.1) (ref: DL-001) |

### Constraints

- MUST: Quick Wins (Sec 4) per primi - zero migrazioni DB, massimo impatto demo (context.json constraints[0])
- MUST: ordinare i milestone per Impatto DESC poi Sforzo ASC (context.json constraints[1])
- MUST: preferire opportunita che riusano architettura esistente (pgvector/Claude/KG/phaseFinancialEngine) prima di nuove dipendenze esterne (context.json constraints[2])
- MUST: per ogni milestone elencare file esatti, migrazione DB (015_*.sql in poi se necessaria), test da aggiornare (Jest/Supertest BE, Vitest FE), nuove env var per .env.example + CLAUDE.md (context.json constraints[3])
- MUST: aggiornare CLAUDE.md (Architecture, Data Model, Open Issues) a ogni milestone completato (context.json constraints[4])
- MUST NOT: toccare report-*.md, fix-log.md, ARCHITECTURE_AS_IS.md (context.json constraints[5])
- MUST: transazioni solo via withTransaction(), mai query('BEGIN') sul pool (context.json constraints[6])
- MUST: 404 (mai 403) per risorse di altri PM; mai err.message nel body 500 (generico + console.error) (context.json constraints[7])
- MUST: graceful degradation quando le API key mancano (provider NoOp gia esistenti) (context.json constraints[8])
- SHOULD: le feature devono funzionare in mock mode (VITE_USE_MOCK) per la demo (context.json constraints[9])

### Known Risks

- **description_embedding popolato solo con EMBEDDING_API_KEY + pgvector e descrizione >20 char: la rotta semantica puo non avere vettori da leggere**: La rotta /similar-semantic ritorna lista vuota in modo graceful e la UI ripiega sul tag-overlap esistente; nessuna feature si rompe senza embedding ne in mock mode
- **Il guard cold-start di summarizeScopingRisks scarta il brief quando ci sono <3 progetti simili (similarHistory vuota)**: GET /scoping-insight ritorna brief vuoto graceful sotto soglia; il valore appare solo quando esiste storia reale (>=3 vicini), evitando output fuorviante
- **La heatmap assume capacita per-risorsa fissa a 1.0 FTE/settimana; risorse part-time o con capacita diversa sarebbero rappresentate erroneamente**: 1.0 FTE e l'invariante gia imposto dal cap esistente (canAllocate/getWeeklyTotalsBatch); la heatmap resta coerente col modello attuale e la capacita variabile e rimandata a feature future (context.json assumptions[2])
- **Le chiamate Claude (scoping brief, retro questions) avvengono on-request senza caching: latenza percepibile per il PM**: Accettabile per il POC; nessun caching introdotto in questo piano (rimandato); le rotte degradano a output vuoto con NoOp provider mantenendo la UI reattiva (context.json assumptions[1])

## Invisible Knowledge

### System

Tesi di punta (moat): il vantaggio competitivo e la memoria istituzionale (Knowledge Graph + similarita semantica pgvector + livello Claude), NON capacita/utilizzo che ogni competitor ha gia. La feature 3.1 Estimate Intelligence e l'unica che migliora quanto piu l'azienda usa lo strumento. Azione raccomandata: spedire i Quick Wins 1-3 insieme COME la feature 3.1, principalmente lavoro di collegamento, zero nuove migrazioni, graceful degradation senza API key (next_steps_new.md Sec 6).

### Invariants

- Cap FTE 1.0 per (resource, week): imposto da canAllocate/getWeeklyTotalsBatch in allocationAggregator; la heatmap usa 1.0 come capacita di riferimento e non lo viola (CLAUDE.md Calcoli chiave)
- weekly_cost materializzato all'INSERT (day_rate x fte x working_days); phase.budget = SUM(weekly_cost) live a ogni GET: la memoria/scorecard confronta snapshot pianificato vs reale, non ricalcola (CLAUDE.md Calcoli chiave, next_steps_new.md Sec 2b)
- 404 mai 403 per risorse di altri PM: non confermare l'esistenza; le nuove rotte sotto /api/projects/:id ereditano questo guard dal prefisso (CLAUDE.md Gestione errori, requireProjectAccess)

### Tradeoffs

- Rotta semantica AGGIUNTA accanto al tag-overlap invece di sostituirlo: piu superficie ma garantisce funzionamento con zero embedding e in mock mode (DL-001)
- Scoping brief e retro questions esposti via GET dedicati invece del fire-and-forget in POST /decisions: piu rotte ma valore visibile, testabile e cacheabile a livello UI (DL-003, DL-004)
- Timeline Memoria Progetto composta lato frontend invece di un endpoint aggregato BE: meno superficie backend da testare ma logica di merge nel client (DL-008)

## Milestones

### Milestone 1: QW1 - Tab Memoria Progetto (composizione KG read-only)

**Files**: frontend/src/components/ProjectMemoryTab.tsx, frontend/src/api/knowledge.ts, frontend/src/mocks/mockData.ts, frontend/src/pages/Dashboard.tsx, frontend/src/types/index.ts

**Flags**: needs-rationale

**Requirements**:

- Compone gli endpoint GET KG esistenti in una timeline cronologica per il progetto
- Evidenzia i collegamenti causali Risk.decision_id
- Rende in mock mode con dati KG di esempio

**Acceptance Criteria**:

- La tab mostra una timeline che unisce decisioni rischi slippage retrospettive
- Un rischio con decision_id mostra il titolo della decisione collegata
- Con VITE_USE_MOCK=true la tab si popola senza backend

**Tests**:

- type:unit|backing:doc-derived|file:frontend/src/components/ProjectMemoryTab.test.tsx|normal:timeline ordinata|edge:KG vuoto stato vuoto|error:fetch fallita messaggio errore

#### Code Intent

- **CI-M-001-001** `frontend/src/components/ProjectMemoryTab.tsx`: Nuovo componente: fetch parallelo di decisions/risks/slippage/retrospectives per :id, merge in timeline cronologica ordinata; risolve Risk.decision_id contro le decisioni fetchate per mostrare il titolo della decisione collegata; stato vuoto quando KG vuoto; messaggio errore su fetch fallita (refs: DL-008, DL-009)
- **CI-M-001-002** `frontend/src/api/knowledge.ts`: Avvolge in withMock(mockFn, realFn) le fetch GET KG esistenti (decisions/risks/slippage/retrospectives) cosi la tab rende senza backend. Avvolge anche fetchSimilarProjects (oggi apiClient diretto senza withMock) in withMock con MOCK_SIMILAR_PROJECTS come dato mock: aggiunge MOCK_SIMILAR_PROJECTS a frontend/src/mocks/mockData.ts (array di ProjectSummary con id/name/tags) e usa withMock(() => Promise.resolve(MOCK_SIMILAR_PROJECTS), realFn) in modo che la tab SimilarProjects tag-based rende in mock mode (VITE_USE_MOCK=true) senza rompere il demo. (refs: DL-006, DL-008)
- **CI-M-001-003** `frontend/src/mocks/mockData.ts`: Aggiunge dati KG di esempio (decisioni con rischi collegati via decision_id, slippage, retrospettive) per popolare la timeline in mock mode. Aggiunge anche MOCK_SIMILAR_PROJECTS (array di oggetti con id/name/tags simili al progetto corrente) esportato come costante, consumato da CI-M-001-002 tramite withMock per rendere la tab SimilarProjects senza backend. (refs: DL-006)
- **CI-M-001-004** `frontend/src/pages/Dashboard.tsx`: Monta ProjectMemoryTab come tab/sezione nella dashboard di progetto (refs: DL-008)

#### Code Changes

**CC-M-001-001** (frontend/src/components/ProjectMemoryTab.tsx) - implements CI-M-001-001

**Documentation:**

```diff
--- a/frontend/src/components/ProjectMemoryTab.tsx
+++ b/frontend/src/components/ProjectMemoryTab.tsx
@@ -0,0 +1,10 @@
+/**
+ * Timeline composed from four independent KG endpoints (decisions, risks,
+ * slippage, retrospectives). Composition happens client-side rather than
+ * behind a new aggregating backend endpoint because the individual GET
+ * handlers in knowledge.ts already serve per-project data; a backend
+ * aggregator would duplicate that surface and require new tests without
+ * adding capability. Risk.decision_id is resolved client-side against
+ * decisions fetched in the same parallel pass. (ref: DL-008)
+ */

```


### Milestone 2: QW2 - Progetti simili semantici (rotta pgvector cosine + UI)

**Files**: backend/src/routes/intelligence.ts, backend/src/index.ts, backend/src/routes/routes.test.ts, frontend/src/components/SimilarProjects.tsx, frontend/src/api/intelligence.ts

**Flags**: error-handling, needs-rationale

**Requirements**:

- GET /api/projects/:id/similar-semantic ordina per distanza cosine sul vettore del progetto :id LIMIT 5 esclude :id
- Ritorna lista vuota quando il progetto non ha embedding o pgvector assente
- SimilarProjects mostra i risultati semantici accanto al fallback tag-overlap esistente

**Acceptance Criteria**:

- Con embedding presenti ritorna fino a 5 progetti ordinati per distanza cosine crescente
- Senza embedding ritorna lista vuota e la UI ripiega sui risultati a tag
- Progetto di altro PM 404 eredita guard del prefisso /api/projects/:id

**Tests**:

- type:integration|backing:doc-derived|file:backend/src/routes/routes.test.ts|normal:righe ordinate con embedding presente|edge:progetto senza embedding vuoto|error:errore DB 500 generico senza err.message

#### Code Intent

- **CI-M-002-001** `backend/src/routes/intelligence.ts`: Nuovo router Router({mergeParams:true}); handler GET /similar-semantic: legge description_embedding del progetto :id; se embedding e null ritorna [] immediatamente; esegue SELECT id,name,... FROM Project ORDER BY description_embedding <=> $1 LIMIT 5 escludendo :id; se la query fallisce per pgvector assente (errore DB con operator <=> non disponibile) il catch intercetta e ritorna [] (lista vuota graceful, non 500); solo errori DB non-pgvector propagano 500 generico (console.error, mai err.message) (refs: DL-001, DL-002, DL-007)
- **CI-M-002-002** `backend/src/index.ts`: Monta intelligenceRouter sotto /api/projects/:id (eredita guard requireAuth+requireProjectAccess gia presente sul prefisso) (refs: DL-002)
- **CI-M-002-003** `frontend/src/api/intelligence.ts`: Nuovo modulo frontend/src/api/intelligence.ts: esporta fetchSimilarSemantic(projectId: string) avvolto in withMock(() => Promise.resolve([]), realFn) dove realFn chiama GET /api/projects/:id/similar-semantic via apiClient con Bearer token. Il mock ritorna array vuoto cosi in mock mode la tab SimilarProjects degrada silenziosamente ai risultati tag-based senza errori. SimilarProjects.tsx consuma sia tag (fetchSimilarProjects da knowledge.ts) che semantic (fetchSimilarSemantic da intelligence.ts) con fallback su array vuoto. (refs: DL-006, DL-001)
- **CI-M-002-004** `frontend/src/components/SimilarProjects.tsx`: Mostra i risultati semantici accanto al fallback tag-overlap esistente; quando semantic vuoto ripiega sui risultati a tag (refs: DL-001)

#### Code Changes

**CC-M-002-001** (backend/src/routes/intelligence.ts) - implements CI-M-002-001

**Documentation:**

```diff
--- a/backend/src/routes/intelligence.ts
+++ b/backend/src/routes/intelligence.ts
@@ -0,0 +1,12 @@
+/**
+ * GET /similar-semantic: reads description_embedding of project :id.
+ * Returns [] immediately when embedding is null (project has no vector yet).
+ * On pgvector-absent DB error (operator <=> unavailable), the catch block
+ * returns [] instead of propagating 500 — the tag-overlap route /similar
+ * remains the always-available fallback, so the UI degrades silently
+ * rather than surfacing an infrastructure error to the PM. (ref: DL-001)
+ * Only non-pgvector DB errors propagate to 500 (console.error, no
+ * err.message in body per security convention).
+ * No new DB migration: reads existing pgvector column from mig 013. (ref: DL-007)
+ */

```


#### Documentation

**Module Comment**:

backend/src/routes/intelligence.ts: Router({mergeParams:true}) mounted under /api/projects/:id. Surfaces Estimate Intelligence endpoints (similar-semantic, scoping-insight, retro-questions). Inherits requireAuth+requireProjectAccess from the prefix mount in index.ts (DL-002); no duplicate middleware. Each handler derives vectors/context from the project :id in scope, never from client-supplied data.

frontend/src/api/intelligence.ts: API module for intelligence endpoints. Every exported function passes through withMock(mockFn, realFn) so features render in VITE_USE_MOCK=true demo mode without a live backend (DL-006). Mock return values are defined in mockData.ts; real calls use apiClient() with Bearer token from AuthContext.

### Milestone 3: 3.1 - Scoping Insight (similarHistory reale + risk brief Claude)

**Files**: backend/src/routes/intelligence.ts, backend/src/services/intelligence/ClaudeProvider.ts, backend/src/routes/routes.test.ts, frontend/src/pages/Dashboard.tsx, frontend/src/api/intelligence.ts, frontend/src/mocks/mockData.ts

**Requirements**:

- GET /api/projects/:id/scoping-insight compone i vicini semantici (fallback tag) e ne arricchisce nome/tag/varianza/ritardi dal KG
- Passa similarHistory reale a ClaudeProvider.summarizeScopingRisks superando il guard cold-start (>=3 progetti)
- Ritorna brief vuoto in modo graceful quando NoOp provider o <3 progetti
- Card Scoping Insight su Dashboard rende il brief e passa per withMock

**Acceptance Criteria**:

- Con >=3 progetti simili e ANTHROPIC_API_KEY ritorna un risk brief non vuoto basato sulla storia reale
- Con <3 progetti o NoOp provider ritorna brief vuoto senza errore
- Progetto di altro PM 404 eredita guard del prefisso
- 500 generico senza err.message su errore DB
- La card rende in mock mode con VITE_USE_MOCK=true

**Tests**:

- type:integration|backing:doc-derived|file:backend/src/routes/routes.test.ts|normal:brief con similarHistory popolata|edge:<3 progetti brief vuoto|error:errore provider 500 generico

#### Code Intent

- **CI-M-003-001** `backend/src/routes/intelligence.ts`: Handler GET /scoping-insight: compone vicini semantici (fallback tag) e arricchisce ciascuno con nome/tag/varianza/cause ritardo dal KG -> costruisce similarHistory reale -> chiama summarizeScopingRisks; ritorna brief vuoto graceful se <3 progetti o NoOp; 500 generico su errore (refs: DL-002, DL-003)
- **CI-M-003-002** `frontend/src/pages/Dashboard.tsx`: Card Scoping Insight che rende il risk brief; fetch via withMock (refs: DL-003, DL-006)

#### Code Changes

**CC-M-003-001** (backend/src/routes/intelligence.ts) - implements CI-M-003-001

**Documentation:**

```diff
--- a/backend/src/routes/intelligence.ts
+++ b/backend/src/routes/intelligence.ts
@@ -0,0 +1,14 @@
+/**
+ * GET /scoping-insight: the >=3 project threshold exists because
+ * summarizeScopingRisks requires a non-trivial similarHistory to produce
+ * meaningful output; below the threshold the brief would be fabricated
+ * rather than derived from institutional memory, which is worse than
+ * returning nothing. (ref: DL-003, R-002)
+ *
+ * Empty-brief graceful path: when <3 similar projects exist, or when the
+ * IntelligenceProvider is NoOp (ANTHROPIC_API_KEY absent), the handler
+ * returns { brief: "" } without an error status. The frontend card shows
+ * a placeholder instead of an error, keeping the UI stable during cold
+ * start and in mock/demo mode.
+ */

```


### Milestone 4: 3.3 - Retro Questions AI (collega generateRetroQuestions)

**Files**: backend/src/routes/intelligence.ts, backend/src/services/intelligence/ClaudeProvider.ts, backend/src/routes/routes.test.ts, frontend/src/components/RetrospectiveModal.tsx, frontend/src/api/intelligence.ts, frontend/src/mocks/mockData.ts

**Requirements**:

- GET /api/projects/:id/retro-questions calcola RetroContext da SlippageEvent (count/unexpected) e varianza/fasi in ritardo da phaseFinancialEngine
- Invoca generateRetroQuestions e ritorna le domande
- Degrada a lista vuota con NoOp provider o contesto privo di segnale
- RetrospectiveModal mostra le domande AI e passa per withMock

**Acceptance Criteria**:

- Con slippage_count>0 o budget_variance!=0 e ANTHROPIC_API_KEY ritorna domande specifiche
- Con NoOp provider ritorna lista vuota senza errore
- Progetto di altro PM 404 eredita guard del prefisso
- 500 generico senza err.message su errore
- Il modale rende le domande in mock mode

**Tests**:

- type:integration|backing:doc-derived|file:backend/src/routes/routes.test.ts|normal:domande con RetroContext segnalato|edge:nessun segnale lista vuota|error:errore provider 500 generico

#### Code Intent

- **CI-M-004-001** `backend/src/routes/intelligence.ts`: Handler GET /retro-questions: calcola RetroContext da SlippageEvent (count/unexpected) + varianza/fasi in ritardo dal rollup phaseFinancialEngine; chiama generateRetroQuestions; lista vuota graceful con NoOp o nessun segnale; 500 generico su errore (refs: DL-002, DL-004)
- **CI-M-004-002** `frontend/src/components/RetrospectiveModal.tsx`: Mostra le domande retrospettive AI; fetch via withMock (refs: DL-004, DL-006)

### Milestone 5: 3.2 - Heatmap Capacita Domanda vs Offerta (read-only su allocationAggregator)

**Files**: backend/src/routes/resources.ts, backend/src/services/allocationAggregator.ts, backend/src/routes/routes.test.ts, frontend/src/pages/Resources.tsx, frontend/src/api/allocation.ts, frontend/src/mocks/mockData.ts

**Requirements**:

- GET /api/resources/capacity-heatmap ritorna matrice densa resource x week con totale FTE per cella riusando getRegistryAggregate
- Codifica banda colore <0.5 sotto / 0.5-1.0 ottimale / >1.0 eccesso con capacita per-risorsa 1.0 FTE
- Orizzonte settimane forward configurabile (default 12)
- Nuova vista frontend rende la griglia e passa per withMock

**Acceptance Criteria**:

- Ritorna una riga per risorsa con celle per settimana e totale FTE coerente con getWeeklyTotalsBatch
- Celle >1.0 FTE marcate come eccesso (coerenti con has_overallocation)
- Registry condiviso cross-project: endpoint sotto /api/resources con requireAuth only (nessun filtro pm_id per design)
- La griglia rende in mock mode con VITE_USE_MOCK=true

**Tests**:

- type:integration|backing:doc-derived|file:backend/src/routes/routes.test.ts|normal:matrice densa con totali per settimana|edge:risorsa senza allocazioni celle a zero|error:errore DB 500 generico senza err.message

#### Code Intent

- **CI-M-005-001** `backend/src/routes/resources.ts`: Nuovo handler GET /capacity-heatmap aggiunto al router resources.ts esistente (montato su /api/resources, solo requireAuth senza requireProjectAccess: registry condiviso cross-project per design, nessun filtro pm_id); riusa getRegistryAggregate per matrice densa resource x week; orizzonte settimane forward configurabile via query param weeks (default 12); arricchisce ogni cella con banda colore (<0.5 sotto, 0.5-1.0 ottimale, >1.0 eccesso) coerente con il cap 1.0 gia imposto da canAllocate; 500 generico su errore DB non atteso (refs: DL-005)
- **CI-M-005-002** `backend/src/services/allocationAggregator.ts`: Espone/riusa getRegistryAggregate per produrre celle resource x week con totale FTE e flag has_overallocation; capacita per-risorsa 1.0 FTE coerente con canAllocate (refs: DL-005)
- **CI-M-005-003** `frontend/src/pages/Resources.tsx`: Nuova vista griglia heatmap con banda colore <0.5 sotto / 0.5-1.0 ottimale / >1.0 eccesso; fetch via withMock (refs: DL-005, DL-006)

#### Code Changes

**CC-M-005-001** (backend/src/routes/resources.ts) - implements CI-M-005-001

**Documentation:**

```diff
--- a/backend/src/routes/resources.ts
+++ b/backend/src/routes/resources.ts
@@ -0,0 +1,13 @@
+/**
+ * GET /capacity-heatmap: capacity per resource is fixed at 1.0 FTE/week
+ * because that is the invariant already enforced by canAllocate() and
+ * getWeeklyTotalsBatch() in allocationAggregator. Using any other reference
+ * capacity here would produce a heatmap inconsistent with the allocation
+ * enforcement layer, misleading PMs about actual headroom. (ref: DL-005)
+ *
+ * Part-time resources (FTE < 1.0 contract) are not modelled in the current
+ * schema; a resource working 0.5 FTE by contract would appear under-utilised
+ * at 0.5 allocation even when fully booked. This trade-off is accepted for
+ * the POC and deferred to a future capacity-model feature. (ref: R-003)
+ */

```


## Execution Waves

- W-001: M-001
- W-002: M-002
- W-003: M-003
- W-004: M-004
- W-005: M-005
