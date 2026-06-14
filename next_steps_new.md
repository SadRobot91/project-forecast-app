# Differenziazione del Prodotto — Prossimi Passi

> Analisi statistica di `project-forecast-app` rispetto a sei competitor nel settore della gestione risorse/forecasting.
> Metodo: ricerca web su ciascun competitor (Giugno 2026) + lettura completa delle rotte backend,
> dei servizi, delle migrazioni DB 001–014 e delle pagine frontend. Nessuna modifica al codice — solo analisi.

**In breve.** L'app offre già, gratuitamente, il *rigore finanziario* per cui i competitor richiedono un pagamento premium (previsione EAC per fase, BAC bloccato + varianza, controllo del tetto FTE). Il suo vero vantaggio competitivo (moat) è qualcosa che **nessun competitor promuove**: un **Knowledge Graph** strutturato (decisioni → rischi → ritardi → retrospettive) unito alla **similarità semantica dei progetti** (pgvector) e a un **livello di intelligenza Claude**. Tre di questi asset sono *già pronti ma dormienti*: collegarli è la mossa a più alto impatto e minor costo, e richiede **zero nuove migrazioni**. Costruire prima il ciclo "Memoria Istituzionale / Intelligenza delle Stime".

---

## 1. Mappa delle Funzionalità dei Concorrenti

| Funzionalità | **Questa app** | Forecast.app | Runn.io | Float.com | Productive.io | Mosaic | Smartsheet RM |
|---|---|---|---|---|---|---|---|
| EAC per fase / previsione revisionata | ✅ doppio metodo (tempo+costi) | ✅ basata su AI | ⚠️ varianza progetto | ⚠️ leggera | ✅ | ✅ AI | ⚠️ |
| Baseline bloccata (BAC) + varianza | ✅ snapshot immutabile | ⚠️ | ❌ | ❌ | ⚠️ | ⚠️ | ⚠️ |
| Controllo tetto FTE / rilevamento sovrallocazione | ✅ blocco consultivo, batch | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Registro risorse multi-progetto | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Scenario / what-if ("tentativo") | ❌ | ⚠️ | ✅ progetti tentativi | ⚠️ | ✅ | ✅ | ⚠️ |
| Matching basato sulle competenze | ❌ (solo ruolo) | ✅ | ⚠️ | ✅ | ✅ | ✅ team AI | ✅ AI |
| Domanda vs capacità / segnale assunzioni | ❌ | ⚠️ | ✅ | ✅ | ✅ | ✅ principale | ✅ |
| Timesheet nativi | ❌ (Keyedin/manuale) | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Fatturazione / margini / redditività | ❌ (solo costi) | ✅ | ⚠️ | ⚠️ | ✅ principale | ✅ | ⚠️ |
| Gestione ferie / permessi | ❌ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Integrazione consuntivi (ERP/PSA) | ✅ stub Keyedin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **KG decisioni/rischi/lezioni strutturato** | ✅ **unico** | ❌ | ❌ | ❌ | ❌ | ⚠️ usa cronologia piani | ❌ |
| **Similarità semantica (vettori)** | ✅ pronta (dormiente) | ❌ | ❌ | ❌ | ❌ | ⚠️ | ❌ |
| Gantt + milestone (pianificato vs reale) | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❌ no Gantt |

**Prezzi / Segmento / Lacune note (da G2/Capterra/SoftwareAdvice, 2026):**

| Competitor | Prezzo | Segmento | Differenziatore dichiarato | Debolezza segnalata |
|---|---|---|---|---|
| **Forecast.app** | ~$29/utente/mo | PSA / mid-market | AI prevede completamento task, date fine, consumo budget; margini di profitto | Curva di apprendimento ripida per le funzioni AI; costoso per piccole org; setup tecnico |
| **Runn.io** | Free ≤5; $7–10/risorsa/mo | SMB / team delivery | Scenari "progetti tentativi", Gantt interattivo, utilizzo e varianza | Più leggero sul rigore della baseline finanziaria; semplice per design |
| **Float.com** | da $7/persona/mo | Agenzie / pianific. capacità | Capacità in tempo reale, scheduling basato su skill, tracciamento tempo | Reporting superficiale; analisi debole su redditività/tempi; ruoli limitati |
| **Productive.io** | da $20/persona/mo | Agenzie 50–200 | PSA all-in-one: risorse+budget+fatture+previsioni | Reporting macchinoso/limitato, curva di apprendimento, app mobile lenta |
| **Mosaic** | su preventivo | Servizi prof. Mid/Enterprise | AI domanda-vs-capacità per ruolo, creazione team AI | Difficoltà nell'onboarding interno; prezzi poco trasparenti |
| **Smartsheet RM** | utente + piattaforma | Enterprise | Previsioni AI, matching skill, riduzione predittiva sforamenti | **Nessun tracciamento task, no dipendenze, no Gantt**; dashboard poco personalizzabili |

*Tema trasversale:* ogni competitor ottimizza **capacità futura e utilizzo**; quelli premium (Forecast, Productive, Mosaic) aggiungono **finanza e AI** ma a $20–29/utente con una curva di apprendimento. **Nessuno** trasforma i risultati dei progetti chiusi in una **memoria istituzionale** strutturata e interrogabile che migliori la stima successiva. La ricerca conferma che i repository delle "lezioni apprese" sono apprezzati ma "raramente revisionati o abbandonati" — ovvero, un problema irrisolto.

---

## 2. Analisi dei Gap: Questa App vs Mercato

### 2a. Già costruito — i competitor lo fanno pagare caro
- **Motore EAC per fase** (`services/phaseFinancialEngine.ts`): completato → costo reale; in corso → *media tra previsione basata sul tempo e sui costi* (più sfumata di un semplice burn-rate); non iniziato → budget. Si aggrega al progetto con RAG. Forecast.app/Productive offrono l'equivalente a $20–29/utente.
- **Baseline bloccata + varianza** (`migrazione 008`, `routes/baseline.ts`): immutabile `total_budget_at_lock` + `phase_snapshot_at_lock` JSONB; la copia di lavoro si evolve mentre la varianza è misurata rispetto allo snapshot. Disciplina EVM-lite che Float/Runn non hanno.
- **Controllo tetto FTE** (`services/allocationAggregator.ts` `getWeeklyTotalsBatch` + advisory locks): tetto rigido 1.0-FTE/settimana con validazione batch e registro multi-progetto — la funzionalità principale a pagamento di Float/Runn.
- **Storico tariffe giornaliere** (`migrazione 011`): analisi delle tariffe nel tempo che molti strumenti SMB omettono.

### 2b. Capacità architetturali che potrebbero sbloccare funzioni uniche
- **Schema Knowledge Graph** (`migrazione 012`): `Decision` (razionale, conseguenza attesa, fase, autore) → `Risk` (FK `decision_id`, categoria Budget/Timeline/Resource/Scope) → `SlippageEvent` (atteso/inatteso, causa) → `Retrospective` (Q/A). Un vero archivio causale di ragionamento per progetto e fase. **Nessun competitor ha questo come dato strutturato.**
- **pgvector similarità semantica** (`migrazione 013`): `description_embedding vector(1536)`, indice cosine ivfflat, provider OpenAI con fallback NoOp. **Dormiente:** la colonna viene *scritta* da `upsertProjectEmbedding` ma **mai letta** — `/similar` ordina solo per sovrapposizione tag. Manca la query kNN cosine; tutto il resto esiste.
- **Livello di intelligenza Claude** (`services/intelligence/ClaudeProvider.ts`): `summarizeScopingRisks` e `generateRetroQuestions` sono implementati. **Dormiente:** `summarizeScopingRisks` viene invocato una volta (POST `/decisions`) ma con un `similarHistory` **vuoto**, quindi il guard di cold-start restituisce `''` e il risultato viene scartato; `generateRetroQuestions` non è chiamato da **nessuna rotta**.
- **Granularità finanziaria per fase + consuntivi Keyedin**: la base per un ciclo di feedback sull'accuratezza delle stime (piano → reale → varianza → lezione → prossimo piano).

### 2c. Funzionalità presenti nei competitor ma assenti in questa app
1. **Pianificazione Scenari / what-if** (Runn "progetti tentativi", Mosaic) — manca un livello di bozza non confermata.
2. **Tassonomia competenze & matching basato su skill** (tutti) — `Resource.role` è una stringa libera.
3. **Previsione domanda vs capacità a livello org / segnale assunzioni** (Mosaic) — l'allocazione esiste ma non c'è una vista sul gap futuro domanda/offerta.
4. **Timesheet nativi** — dipende da Keyedin/snapshot manuali.
5. **Ricavi / fatturazione / margini** — il modello traccia i costi (`day_rate`) ma non le tariffe di vendita, quindi nessuna redditività.
6. **Ferie/permessi, notifiche/alert, portale condivisione clienti** (`share_token` è dormiente), integrazioni (Slack/calendario), mobile.

---

## 3. Opportunità di Differenziazione
*Ordinate per Impatto (DESC), poi Sforzo (ASC). "% Fondamenta" = quanto è già esistente.*

### 3.1 — Intelligenza delle Stime: la memoria istituzionale a ciclo chiuso  ⭐ Prodotto di punta
*(Impatto: Alto · Sforzo: M · Fondamenta: ~65%)*

- **Cos'è:** Quando un PM definisce l'ambito (scoping) di un nuovo progetto/fase, appare un pannello che (a) trova i progetti passati più **semanticamente simili** (pgvector cosine su `description_embedding`), (b) mostra la loro **varianza di budget, cause di ritardo e lezioni retrospettive** estratte dal KG, e (c) genera un **"risk brief" di Claude** basato su quella cronologia reale. Dopo la consegna, gli stessi progetti alimentano la stima successiva.
- **Perché è differenziante:** Nessun competitor memorizza decisioni/rischi/lezioni strutturati, quindi nessuno può dare consigli sullo scoping basati sulla similarità. Mosaic usa la cronologia della *pianificazione* per lo staffing, non quella del *ragionamento* per la qualità della stima. Questa è l'unica funzione che migliora quanto più l'azienda usa lo strumento — un vero vantaggio competitivo basato sui dati.
- **Come costruirlo:** Attivare tre asset dormienti, **nessuna nuova migrazione**.
  - Aggiungere una rotta kNN vettoriale, es. `GET /api/projects/:id/similar-semantic` → `SELECT id,name,... FROM "Project" ORDER BY description_embedding <=> $1 LIMIT 5`.
  - Inserire `similarHistory` reale (nome/tag/descrizione + varianza e ritardi dagli endpoint GET del KG) in `ClaudeProvider.summarizeScopingRisks`.
  - Frontend: estendere `components/SimilarProjects.tsx` + una card "Scoping Insight" su `Dashboard.tsx` / modale scoping in `Projects.tsx`.
- **Sforzo:** M (1–2 settimane). **Impatto:** Alto.

### 3.2 — Heatmap Domanda vs Offerta di Capacità (punto forte di Mosaic, quasi pronto)
*(Impatto: Alto · Sforzo: S–M · Fondamenta: ~70%)*

- **Cos'è:** Una griglia a livello org: per ogni risorsa × settimana futura, totale FTE impegnati vs capacità, con codice colore (eccesso/ottimale/sottoutilizzo), con un riepilogo "chi è libero / chi è sovraccarico / assumi qui" e successivamente raggruppamento per skill.
- **Perché è differenziante:** Raggiunge la parità con la vista più venduta di Mosaic/Runn, ma sopra il registro esistente con tetti FTE — e può essere collegato ai RAG di previsione.
- **Come costruirlo:** `allocationAggregator.ts` calcola già i totali settimanali. Aggiungere una rotta di aggregazione che restituisca una matrice densa risorsa×settimana; nuova pagina frontend riutilizzando l'utility `fteSemaphore`.
- **Sforzo:** S–M (3–6 giorni). **Impatto:** Alto.

### 3.3 — Automazione Rischi e Retrospettive basata sulla Varianza (riattiva Claude)
*(Impatto: Alto · Sforzo: S–M · Fondamenta: ~75%)*

- **Cos'è:** Quando uno snapshot porta una fase in `A_RISCHIO`/`FUORI_BUDGET` o viene loggato un ritardo, crea automaticamente una bozza di record `Risk` e propone domande retrospettive generate da Claude specifiche per quei dati alla chiusura del progetto.
- **Perché è differenziante:** Trasforma i numeri RAG passivi in un suggerimento di ragionamento guidato; i competitor segnalano gli sforamenti ma non li *interrogano*. Alimenta direttamente la memoria del punto 3.1.
- **Come costruirlo:** `generateRetroQuestions` esiste già ed è **inutilizzato** — aggiungere `GET /api/projects/:id/retro-questions` che calcola `RetroContext` dai dati esistenti di ritardi/varianza/fase; mostrare in `RetrospectiveModal.tsx`.
- **Sforzo:** S–M (3–6 giorni). **Impatto:** Alto.

### 3.4 — Scorecard Accuratezza delle Stime (il payoff della memoria istituzionale)
*(Impatto: Medio–Alto · Sforzo: M · Fondamenta: ~55%)*

- **Cos'è:** Sui progetti chiusi, confronto pianificato-vs-reale per **tipo di fase, PM e tag** — es. "Le fasi di Build sforano del +18% in media; la Fattibilità è affidabile". Fa emergere i bias sistemici e riporta i dati nel punto 3.1.
- **Perché è differenziante:** Un livello di analisi retrospettiva che nessuno dei competitor offre; trasforma lo strumento da "tracker" a "stimatore che impara".
- **Come costruirlo:** Aggregare `Baseline.phase_snapshot_at_lock` vs ultimo `OngoingSnapshot` raggruppato per `phase_type`/`pm_id`/tag. Nuova rotta di sola lettura + una pagina "Insights".
- **Sforzo:** M (1–2 settimane). **Impatto:** Medio–Alto.

### 3.5 — Pianificazione Allocazione Scenario / What-if (parità con Runn, ma più profonda)
*(Impatto: Alto · Sforzo: M–L · Fondamenta: ~50%)*

- **Cos'è:** Creare bozze di allocazioni "what-if" che non vengono confermate, mostrando istantaneamente budget/previsione/RAG e conflitti di capacità proiettati, affiancati alla baseline bloccata.
- **Perché è differenziante:** I "progetti tentativi" di Runn sono superficiali sulla parte finanziaria. Qui uno scenario riutilizza l'intero motore EAC per fase + rilevamento tetti, quindi il what-if mostra le conseguenze su **denaro e capacità** insieme.
- **Come costruirlo:** Nuovo overlay `scenario_id` (migrazione: `scenario_id` nullable); calcolare tramite `phaseFinancialEngine`/`allocationAggregator` esistenti passando un filtro scenario.
- **Sforzo:** M–L (2–3 settimane). **Impatto:** Alto.

---

## 4. Quick Wins (<1 settimana, nessuna migrazione)

1. **Tab "Memoria Progetto"** — comporre gli endpoint di lettura KG esistenti in un'unica narrazione cronologica del progetto, evidenziando i collegamenti causali (`Risk.decision_id`). Pura composizione frontend.
2. **"Progetti simili" semantici live** — aggiungere una rotta pgvector cosine (`ORDER BY description_embedding <=> $1`) e integrarla in `SimilarProjects.tsx`. La colonna esiste già.
3. **Domande retrospettive AI** — collegare l'inutilizzato `ClaudeProvider.generateRetroQuestions` dietro `GET /api/projects/:id/retro-questions`, mostrare in `RetrospectiveModal.tsx`.
4. **Riepilogo Portfolio "A Rischio"** — il RAG per progetto è già calcolato; aggiungere un banner in `pages/Projects.tsx` ("2 progetti FUORI BUDGET, 1 A RISCHIO") con filtri rapidi.
5. **Esportazione Excel / CSV di dashboard + matrice allocazioni** — chiude il cerchio della storia delle origini ("abbiamo sostituito `Project_Forecast_v16.xlsx`"). Solo frontend.

---

## 5. Roadmap Strategica

| Orizzonte | Tema | Elementi | Perché ora |
|---|---|---|---|
| **Ora (0–4 sett)** | Attivare asset dormienti | Quick wins 1–5; **3.1 Intelligenza Stime**; **3.2 Heatmap Capacità**; **3.3 Automazione Varianza→Retro** | Zero/poche migrazioni, sfrutta basi già pronte. Massimo valore percepito per l'adozione interna. |
| **Prossimo (1–3 mesi)** | Costruire il vantaggio | **3.4 Scorecard Accuratezza Stime**; **3.5 Pianificazione Scenario/What-if**; timesheet nativi leggeri; attivazione `share_token` | Funzioni che accumulano valore dai dati e colmano i gap di parità richiesti dai buyer. |
| **Dopo (3–6 mesi)** | Parity + scale bets | **3.6 Tassonomia Skill**; modello tariffe/margini; pianificatore assunzioni; integrazioni notifiche/Slack/calendario; mobile | Investimenti più grandi che ampliano il set di potenziali buyer una volta provato il nucleo differenziante. |

---

## 6. Prima Azione Raccomandata

**Costruire il ciclo di "Intelligenza delle Stime" (3.1) rilasciando i Quick Wins 1–3 insieme come un'unica funzionalità.** È la mossa a più alto impatto perché attiva tre asset che sono *già codificati ma morti* — il Knowledge Graph (migrazione 012), gli embedding pgvector (migrazione 013) e il provider Claude — in una narrazione coerente e visibile: *"ecco i 3 progetti passati più simili, ecco dove le stime sono andate male ed ecco il risk brief per il tuo progetto."* Richiede **nessuna nuova migrazione**, degrada fluidamente in assenza di chiavi API e dimostra l'unica cosa che **nessun competitor — Forecast, Runn, Float, Productive, Mosaic o Smartsheet — può mostrare**: uno strumento di forecasting le cui stime diventano più intelligenti ogni volta che un progetto si chiude. Questa è la storia che vince la decisione di adozione interna, ed è principalmente un lavoro di *collegamento*, non di nuova ingegneria.

---

## Fonti (ricerca competitor, Giugno 2026)

- Runn.io — [GetApp](https://www.getapp.com/all-software/a/runn/), [SaaSworthy](https://www.saasworthy.com/product/runn-io), [Capterra](https://capterra.com/p/202595/Runn/)
- Float.com — [SelectHub](https://www.selecthub.com/p/resource-management-software/float-com/), [SoftwareAdvice](https://www.softwareadvice.com/product/72023-Float/)
- Forecast.app — [G2](https://www.g2.com/products/forecast-forecast/reviews), [Research.com](https://research.com/software/reviews/forecast)
- Productive.io — [Capterra](https://www.capterra.com/p/169710/Productive/reviews/), [The CFO Club](https://thecfoclub.com/tools/productive-review/)
- Mosaic — [mosaicapp.com AI forecasting](https://www.mosaicapp.com/product/ai-automation-forecasting), [G2](https://www.g2.com/products/mosaicapp-inc-mosaic/reviews)
- Smartsheet RM — [Smartsheet platform](https://www.smartsheet.com/platform/resource-management), [G2](https://www.g2.com/products/resource-management-by-smartsheet/reviews)
- Institutional memory / lessons-learned — [ACM SIGSOFT](https://dl.acm.org/doi/10.1145/1317471.1317477), [Automatic Recall of Software Lessons Learned (arXiv)](https://arxiv.org/pdf/2110.05261)
