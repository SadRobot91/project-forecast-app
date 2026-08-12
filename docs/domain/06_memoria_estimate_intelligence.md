# Macro-Area 06 — Memoria Istituzionale (Knowledge Graph) & Estimate Intelligence (AI)

> Documento funzionale/business. Fonte: codice reale al 2026-07-22 (non CLAUDE.md).
> Riferimenti in formato `file:riga`.

---

## 1. Nome Modulo

**Memoria Istituzionale & Estimate Intelligence**

Composto da due sotto-sistemi complementari:

- **Knowledge Graph (KG)** — cattura strutturata di Decisioni, Rischi, Slittamenti e Retrospettive per ogni progetto (`backend/src/routes/knowledge.ts`, migrazione `012_knowledge_graph_capture.sql`).
- **Estimate Intelligence** — servizi AI/semantici che leggono il KG e lo storico progetti per produrre progetti simili, brief di rischio in scoping e domande di retrospettiva mirate (`backend/src/routes/intelligence.ts`, migrazione `013_pgvector_embeddings.sql`).

---

## 2. Obiettivo di Business — il Moat

La app sostituisce un Excel di forecasting; il vantaggio difendibile ("moat") non è il calcolo del budget ma la **memoria istituzionale**: ogni progetto chiuso arricchisce una base di conoscenza che rende le stime dei progetti futuri più accurate.

Il meccanismo del valore incrementale:

1. Durante ogni progetto il PM registra **perché** ha preso certe decisioni, quali **rischi** ne sono derivati, quali **slittamenti** sono accaduti e cosa ha imparato nella **retrospettiva** finale.
2. Alla partenza di un nuovo progetto il sistema recupera i **progetti simili** (semanticamente, sulla descrizione) e sintetizza in un **brief di rischio** le insidie tipiche già viste nello storico (`intelligence.ts:122` scoping-insight).
3. In chiusura, l'AI genera **domande di retrospettiva** calibrate sui segnali reali del progetto (slittamenti + scostamento di budget), così le lezioni raccolte sono pertinenti e non generiche (`intelligence.ts:156`).

Conseguenza: più progetti chiusi ⇒ più vicini semantici disponibili ⇒ brief di scoping più ricchi. Sotto una soglia minima il sistema tace deliberatamente (cold-start, vedi §6), perché una raccomandazione basata su 1–2 progetti sarebbe rumore.

---

## 3. Attori

- **Project Manager (PM)** — proprietario del progetto (`pm_id`). Cattura decisioni/rischi/slippage/retrospettive; consulta memoria, progetti simili e insight. Tutte le route sono sotto il prefisso `/api/projects/:id` protetto da `requireAuth + requireProjectAccess` (ownership).
- **Delivery Manager (DM)** — ruolo che bypassa l'ownership `pm_id`; vede la memoria di progetti di altri PM (trasversalità organizzativa).
- **IntelligenceProvider (attore di sistema)** — Claude (`ClaudeProvider.ts`) quando è presente `ANTHROPIC_API_KEY`, altrimenti `NoOpProvider` che restituisce output vuoto (`intelligenceService.ts:5`).
- **EmbeddingProvider (attore di sistema)** — OpenAI (`OpenAIEmbeddingProvider.ts`) quando è presente `EMBEDDING_API_KEY`, altrimenti `NoOpEmbeddingProvider` (`embeddingService.ts:6`).

---

## 4. Funzionalità Operative

### 4.1 Cattura della conoscenza (Knowledge Graph)

| Elemento | Endpoint | Campi salienti | Validazione |
|---|---|---|---|
| **Decisione** | `POST /decisions` (`knowledge.ts:57`) | `title` (obbligatorio), `rationale`, `expected_consequence`, `phase_id`, `decided_at` | `title` non vuoto → altrimenti 400 (`:67`) |
| **Rischio** | `POST /risks` (`knowledge.ts:123`) | `description` (obbligatorio), `category`, `decision_id` (link alla decisione) | `description` non vuota (`:131`); `category` ∈ {Budget, Timeline, Resource, Scope} (`:135`, `:8`) |
| **Slittamento** | `POST /slippage` (`knowledge.ts:183`) | `expected` (bool obbligatorio), `cause`, `phase_id` | `expected` deve essere booleano (`:191`) |
| **Retrospettiva** | `POST /retrospectives` (`knowledge.ts:233`) | `answer` (obbligatorio), `question`, `phase_id` | `answer` non vuota (`:241`) |
| **Scoping progetto** | `PATCH /` (`knowledge.ts:13`) | `description`, `tags[]` | almeno uno dei due (`:17`); su change descrizione ricalcola embedding fire-&-forget (`:45`) |

Ogni POST verifica prima l'esistenza del progetto (`SELECT 1 FROM "Project"`) → 404 se assente.

### 4.2 Timeline Memoria Progetto

`ProjectMemoryTab.tsx` fonde in un'unica timeline cronologica le quattro entità (decisioni, rischi, slippage, retrospettive), ordinate per data (`:150`). Ogni tipo ha colore/etichetta propria (`:24`). I rischi mostrano la **decisione correlata** risolvendo `decision_id` (mappa client-side + fallback `decision_title` dal join backend, `:134`). Stati vuoto/loading/errore gestiti (`:163`–`:186`). Montata come tab nella Dashboard.

### 4.3 Progetti simili (semantici + fallback tag)

`SimilarProjects.tsx` on-demand (all'espansione) chiama in parallelo semantico e tag-overlap (`:28`): se la ricerca semantica ritorna risultati li mostra con % di affinità (`:120`), altrimenti mostra i risultati per tag con conteggio tag in comune (`:125`). Backend semantico: `GET /similar-semantic` (`intelligence.ts:70`), kNN cosine `<=>` su `description_embedding`, top 5.

### 4.4 Risk brief in scoping

`GET /scoping-insight` (`intelligence.ts:122`) compone lo `similarHistory` reale (vicini semantici, fallback tag via `fetchSimilarContext`, `:34`) e chiede al provider un brief di 2–3 rischi tipici (`ClaudeProvider.summarizeScopingRisks`, `:13`). Ritorna `{ brief, similar_count }`. Brief vuoto → il frontend mostra placeholder.

### 4.5 Domande di retrospettiva AI

`GET /retro-questions` (`intelligence.ts:156`) calcola un `RetroContext` dai dati reali: conteggio slittamenti totali/inattesi (`:173`) + scostamento budget e fasi in ritardo da `computeProjectFinancials` (`:180`). Il provider genera 3 domande mirate (`ClaudeProvider.generateRetroQuestions`, `:37`). `RetrospectiveModal.tsx` usa le domande AI se presenti, altrimenti il set statico (`:33`, `:45`), mostrando badge "Domande generate dall'AI" (`:89`).

---

## 5. Flussi di Lavoro

### Momento 1 — Scoping (avvio progetto)

1. PM definisce `description` + `tags` (`PATCH /`); il cambio descrizione innesca il calcolo embedding se `EMBEDDING_API_KEY` presente e descrizione > 20 char (`embeddingService.ts:15-16`).
2. PM apre "Progetti simili" → vicini semantici (o tag).
3. PM consulta lo Scoping Insight → brief dei rischi tipici dallo storico.
4. PM registra le **Decisioni** iniziali con conseguenza attesa.

### Momento 2 — Delivery / Slippage (esecuzione)

1. Durante l'avanzamento, ogni ritardo genera uno **SlippageEvent** (atteso/inatteso + causa) via `SlippageModal`.
2. I **Rischi** che si materializzano vengono registrati, collegati opzionalmente alla Decisione che li ha originati (`decision_id`).

### Momento 3 — Chiusura / Retrospettiva

1. In chiusura il sistema calcola i segnali reali (slittamenti + varianza budget) e propone **domande AI mirate**.
2. Il PM risponde; le risposte diventano **Retrospective**, entrando nella memoria e alimentando lo storico per i progetti futuri.

### Catena causale Decision → Risk

Il modello lega esplicitamente causa ed effetto: `Risk.decision_id → Decision.id` (`012_knowledge_graph_capture.sql:28`, `ON DELETE SET NULL`). Il GET rischi fa `LEFT JOIN "Decision"` per esporre `decision_title` (`knowledge.ts:167`). Così la memoria non è una lista piatta ma un grafo "questa decisione ha generato questo rischio".

---

## 6. Regole di Business

1. **Catena causale Risk.decision_id** — un rischio può referenziare la decisione che lo ha originato; se la decisione è cancellata il rischio sopravvive con link nullo (`ON DELETE SET NULL`, mig 012). Il link è opzionale.
2. **Cold-start (< 3 progetti simili)** — `summarizeScopingRisks` ritorna stringa vuota se `similarHistory.length < COLD_START_THRESHOLD (=3)` (`ClaudeProvider.ts:3,14`). Nessun brief con storico insufficiente.
3. **Graceful NoOp senza API key**:
   - Senza `ANTHROPIC_API_KEY` → `NoOpProvider`: brief `''` e domande `[]` (`intelligenceService.ts:10`, `NoOpProvider.ts`).
   - Senza `EMBEDDING_API_KEY` → `NoOpEmbeddingProvider`; `upsertProjectEmbedding` esce subito (`embeddingService.ts:16`) e nessun embedding viene scritto.
   - Nessuna feature AI genera errore: sempre risposte vuote/degradate.
4. **kNN cosine su description_embedding con fallback tag-overlap** — la ricerca principale ordina per `description_embedding <=> $1::vector` (cosine distance, mig 013 usa `vector_cosine_ops`). Se il progetto non ha embedding o pgvector è assente (codici `42703/42883/42704/42P01`, `intelligence.ts:22`) si degrada: `/similar-semantic` ritorna `[]` (`:83`, `:108`), e `fetchSimilarContext` ripiega su tag-overlap `tags ?| $1` ordinato per tag in comune (`:55`). Il fallback tag è sempre disponibile.
5. **Guard descrizione > 20 char** — l'embedding viene calcolato solo se `description.trim().length > 20` (`embeddingService.ts:15`): descrizioni troppo brevi non producono vettori semantici (evita rumore su testi non informativi).
6. **Segnale retro nullo → nessuna domanda AI** — `generateRetroQuestions` ritorna `[]` se `slippage_count === 0 && budget_variance === 0` (`ClaudeProvider.ts:38`); il modale usa allora le 3 domande statiche.
7. **Fire-and-forget non bloccante** — embedding upsert (`knowledge.ts:46`) e stub scoping in POST decision (`:86`) non falliscono mai la richiesta principale.
8. **Sicurezza** — tutte le route ereditano `requireAuth + requireProjectAccess` dal prefisso `/api/projects/:id`; i vettori/contesti derivano sempre dal `:id` in scope, mai da dati client (commento `intelligence.ts:1-8`). 404 (non 403) per progetti altrui.
9. **Embedding vector(1536)** — dimensione fissa compatibile con OpenAI `text-embedding-ada-002` (`OpenAIEmbeddingProvider.ts:5`, mig 013).

---

## 7. Verifica CLAUDE.md

Confronto con la sezione "Open Issues" / Data Model di CLAUDE.md:

| Affermazione CLAUDE.md | Stato reale nel codice | Esito |
|---|---|---|
| M-001 Tab Memoria = timeline KG | `ProjectMemoryTab.tsx` fonde 4 entità ordinate per data | **Confermato** |
| M-002 similar-semantic kNN cosine su `description_embedding`, fallback tag | `intelligence.ts:70`, degradazione a `[]`/tag | **Confermato** |
| M-003 scoping-insight compone similarHistory reale + `summarizeScopingRisks`, brief `''` graceful / cold-start | `intelligence.ts:122`, `ClaudeProvider.ts:14` | **Confermato** |
| M-004 retro-questions da SlippageEvent + variance | `intelligence.ts:156-189` | **Confermato** |
| Cold-start < 3 progetti | Soglia = 3 (`ClaudeProvider.ts:3`) | **Confermato** |
| Categorie rischio Budget/Timeline/Resource/Scope | CHECK in mig 012 + validazione route | **Confermato** |
| Provider NoOp senza key | `intelligenceService.ts`, `embeddingService.ts` | **Confermato** |
| Modello Claude | CLAUDE.md non specifica; codice usa `claude-haiku-4-5-20251001` (`ClaudeProvider.ts:7`) | **Dettaglio non documentato** |

Nessuna discrepanza sostanziale rilevata. CLAUDE.md è **accurato** su questa macro-area.

---

## Open Point

- **Stub POST /decisions** (`knowledge.ts:86-96`): invoca `summarizeScopingRisks` con `similarHistory` vuoto e progetto fittizio — è un wiring del call-path che oggi è un no-op garantito (cold-start). Da valutare se rimuovere o completare; oggi non produce valore.
- **Autore decisione**: la tabella `Decision` ha `author_id` (mig 012:16) ma la route POST non lo valorizza (`knowledge.ts:78-81`) — l'autore non viene tracciato.
- **`decided_at` client-supplied**: la POST decision accetta `decided_at` dal body senza validazione formato (`knowledge.ts:81`); rischio di date incoerenti in timeline.
- **ScopingInsightCard**: citata in CLAUDE.md (M-003) e `api/intelligence.ts` (`fetchScopingInsight`) ma il componente `.tsx` non è stato letto in questa analisi — presenza da confermare.
- **Modello embedding ada-002 deprecato**: `text-embedding-ada-002` è legacy; nessun impatto funzionale ma da rivedere per accuratezza semantica.
