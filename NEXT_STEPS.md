# Next Steps — Prerequisiti prima della fase successiva

> Branch corrente: `feature/step-9-pianificazione`
> Documento di riferimento per lo stato attuale: `docs/ARCHITECTURE_AS_IS.md`
> Capability target dopo questi step: `EDIP_CAPABILITIES.md`

Questo documento elenca tutto ciò che va fatto prima di iniziare lo Step 10
(seeding) e prima di attaccare le Capability EDIP. È diviso in tre parti:

1. **Fix architetturali** — debito tecnico bloccante
2. **Semplificazioni di design** — riduzione di complessità nel dominio
3. **Semplificazioni UI** — riduzione di superficie nelle pagine

---

## 1. Fix architetturali — debito bloccante

Vedi `ARCHITECTURE_AS_IS.md` per i dettagli completi. Qui solo il riepilogo
operativo in ordine di esecuzione.

### Step A — Lock check su PUT /allocation (1h) — **STOPGAP**

> ⚠️ **Step A è intenzionalmente uno stopgap di sicurezza** valido solo fino
> al merge di Step B. Una volta che la BAC è materializzata come snapshot
> sul record `Baseline` (Step B), il blocco hard su `PUT /allocation` va
> **rimosso**: la working copy (AllocationEntry, ProjectPhase) torna
> liberamente modificabile per gestire slittamenti reali (ritardi sorgente,
> riorganizzazione risorse, dilatazione timeline). La variance si misura
> contro lo snapshot congelato, non contro lo stato corrente.

In `backend/src/routes/allocations.ts`, all'inizio del PUT, leggere
`Baseline.locked_at` e rifiutare con 400 se valorizzato. Stessa cosa per
`PUT /resources/:id` se la risorsa è allocata su un progetto con baseline
lockata (limitato al caso di day_rate cambiato).

**File toccati:** `allocations.ts`, `resources.ts`
**Test:** scenario "lock + tentativo write API diretto deve restituire 400"

**Quando rimuovere Step A:** in Step B, dopo aver verificato che la BAC è
correttamente snapshottata sul record `Baseline` e che la dashboard legge
la variance dallo snapshot, non più dal SUM live.

### Step B — Snapshot totali nella Baseline (0.5–1gg)

Migration `008_baseline_snapshot.sql`:
```sql
ALTER TABLE "Baseline"
  ADD COLUMN total_budget_at_lock      DECIMAL(15,2),
  ADD COLUMN total_forecast_at_lock    DECIMAL(15,2),
  ADD COLUMN total_working_days_at_lock INTEGER,
  ADD COLUMN phase_snapshot_at_lock     JSONB;
  -- phase_snapshot_at_lock contiene per ogni fase:
  -- { phase_id, phase_type, display_name, order,
  --   planned_start, planned_end, working_days, planned_hours,
  --   budget, contingency_pct, status }
```

In `POST /baseline/lock`, dentro la stessa transazione, prima di settare
`locked_at`:
1. Leggere fasi correnti da `ProjectPhase`
2. Calcolare `SUM(weekly_cost)` per fase da `AllocationEntry`
3. Costruire il JSONB con dati per fase + totali
4. INSERT/UPSERT su `Baseline` con tutti i campi snapshot

Da quel momento il `Baseline` salvato è la **BAC immutabile**. Working copy
(`ProjectPhase`, `AllocationEntry`) resta mutabile.

**Lato GET `/baseline`:**
- Se `is_locked`: ritornare i campi `*_at_lock` (snapshot)
- Se non lockata: ritornare il calcolo live attuale
- Frontend non si accorge della differenza, vede sempre `{ phases, totals }`

**Lato dashboard:**
- `kpis.budget_total` → da snapshot quando locked, da SUM live altrimenti
- `kpis.variance` → `current_forecast − total_budget_at_lock`
- I numeri "originale" e "corrente" diventano confrontabili

**Conseguenze sui blocchi di Step A:**
Una volta che la BAC è nello snapshot, modificare `AllocationEntry` o
`day_rate` non altera più la BAC. Quindi in questa stessa PR si **rimuove**
il blocco di Step A su:
- `PUT /allocation` — torna libero
- `PUT /resources/:id day_rate` — torna libero

Resta lockato solo `PUT /baseline` (i parametri di progetto: contingency,
display_name fase) perché quelli SONO la BAC.

**Aperto come follow-up (non bloccante per chiudere step 9):**
- Modificare le date di una fase dopo il lock (caso "ritardo sorgente,
  dilatare timeline"): oggi `PUT /baseline` aggiorna dates+contingency
  nello stesso payload, va splittato in `PATCH /phases/:id` (dates only,
  permesso anche dopo lock) e `PUT /baseline` (parametri BAC, locked).

### Step C — Service-layer aggregator (~3–4h) — **DONE**

> ✅ Implementato in `backend/src/services/allocationAggregator.ts`.
> Refactor di `/resources/registry` e `/allocation/warnings` per delegare
> al service. `canAllocate` esposta e pronta per Step D (write-side
> enforcement con advisory lock).

Estratto la SUM cross-project che era duplicata in tre endpoint
(`/resources/registry`, `/allocation/warnings`, e implicita nel calcolo
budget) in un service condiviso che diventa il **single point of truth**
per la regola `Σ FTE ≤ 1.0`. AllocationEntry resta l'unica fonte di verità
— niente tabella aggiuntiva, niente sync code, niente rischio di drift.

API del service:
- `getWeeklyTotal(resource_id, week_start, opts?)` — somma FTE su tutti i progetti
- `canAllocate(resource_id, week_start, requested_fte, opts?)` — { ok, current_total, requested, would_be, excess?, breakdown? }
- `getRegistryAggregate(opts?)` — versione aggregata per `/resources/registry`

Tutti accettano `opts.query` per injection (i test unitari usano stub
fn, niente jest.mock sul modulo db).

### Step D — FTE cap enforcement sul write (~1gg, dopo Step C)

Nel `PUT /allocation`, dentro la transazione:
1. `pg_advisory_xact_lock(hashtext(resource_id || ':' || week_start))` per
   serializzare scritture concorrenti sulla stessa coppia
2. `aggregator.canAllocate(...)` per il check
3. INSERT/UPDATE su `AllocationEntry` solo se autorizzato
4. Risposta 409 con dettaglio se rifiutato

Il vantaggio del service: la regola `> 1.0 → reject` vive in **un solo
file**. Tre call site la usano (registry, warnings informativi, write
enforcement) ma la logica è sola.

### Step E — `phase_id` su OngoingSnapshot (1gg)

Migration `009_ongoing_phase_id.sql`:
```sql
ALTER TABLE "OngoingSnapshot"
  ADD COLUMN phase_id INTEGER REFERENCES "ProjectPhase"(id);
```

Aggiornare UI di `/avanzamento` per chiedere a quale fase si riferisce lo
snapshot. Adattare `KeyedinApiProvider` (anche se stub) con mapping WBS → phase.

### Step F — Phase Financial Engine (2–3gg, dopo Step E)

Nuovo service `backend/src/services/phaseFinancialEngine.ts`. Sostituire il
calcolo flat di `dashboard.ts:58` con somma di forecast per-fase. Eliminare
`totalWorkingDays / totalBudget` come scorciatoia.

### Step G — day_rate cascade o versionamento (1–2gg)

Quick fix: trigger cascade su `PUT /resources/:id` che ricalcola
`weekly_cost`. Long term: tabella `ResourceDayRateHistory` con
`effective_from`.

### Step H — Auth backend (3–5gg)

Vedi punto ⑥ in `ARCHITECTURE_AS_IS.md`. Workstream separato, può andare in
parallelo agli altri da B in poi.

### Step I — Date di fase mutabili dopo lock (~1gg, dopo B) — **ANTICIPATO**

> 🟢 **Anticipato rispetto alla sequenza A→B→C→D→…**
> Implementato subito dopo Step B per chiudere il loop sulla mutabilità
> della working copy. Senza Step I, il caso "ritardo sorgente → dilato la
> timeline" rimaneva scoperto perché `PUT /baseline` resta giustamente
> rifiutato dopo il lock e non c'era altro endpoint per spostare le date.
> Backend completo, frontend ancora da consumare (vedi follow-up sotto).

Quando la sorgente dati slitta o un dipendency cambia tempistiche, il PM
deve poter dilatare la timeline della working copy senza che questo tocchi
la BAC. Oggi `PUT /baseline` aggrega in un solo payload sia parametri BAC
(contingency, display_name) sia dati working copy (planned_start,
planned_end) — e dopo Step B è ancora rifiutato in toto sulle baseline
lockate.

Soluzione: splittare l'endpoint.
- `PUT /api/projects/:id/baseline` → solo parametri BAC, rifiuta se lockata (come oggi)
- `PATCH /api/projects/:id/phases/:phase_id` → solo `planned_start`,
  `planned_end`, `status`; permesso anche dopo il lock perché modifica
  working copy, non BAC.

Frontend: in Pianificazione tab Fasi, dopo il lock, gli input date restano
editabili (con etichetta "Working copy — la BAC originale è del DD/MM/YY").
Contingency e display_name diventano read-only.

**Stato implementazione:**
- ✅ Backend `PATCH /api/projects/:id/phases/:phase_id` — fatto
- ✅ Validazione: status enum, end ≥ start (con valore corrente per la
  side non fornita), 404 se phase non appartiene al progetto
- ✅ Test su tutti i path (status alone, date change con ricalcolo
  working_days, status+date insieme, validation 400, 404)
- ⏳ Frontend: `Pianificazione.tsx` deve usare il nuovo endpoint quando
  baseline è lockata, invece di PUT /baseline. Da fare in una PR dedicata.

### Step J — Re-baselining (scope change formale, future feature)

Quando lo sponsor approva un cambio di scope significativo (es. £30k di
lavoro aggiuntivo), la BAC stessa deve cambiare ma con audit trail. Caso
standard PM (PRINCE2 "exception plan", PMBOK "change request approved").

Schema proposto:
```sql
ALTER TABLE "Baseline" ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Baseline" ADD COLUMN effective_from DATE;
ALTER TABLE "Baseline" ADD COLUMN reason TEXT;
-- più righe per project_id, una per versione approvata
-- PRIMARY KEY (project_id, version)
```

Workflow:
- PM clicca "Richiedi re-baseline" → modal con motivo + delta
- Sponsor approva (qui serve almeno l'auth di Step H)
- Nuovo record `Baseline v2` con nuovo snapshot
- Dashboard ha selettore "Variance vs Baseline v1 / v2 / current"
- Variance pre-cambio scope misurata vs v1, post-cambio vs v2

Fuori dai bloccanti del POC. Da affrontare quando l'auth è pronta e
c'è un caso reale.

---

## 2. Semplificazioni di design — dominio e architettura

### 2.1 Resource Registry come service-layer aggregator

**Problema oggi:** la regola `Σ FTE ≤ 1.0` non vive in un punto solo. Vive
distribuita in tre endpoint che fanno lo stesso calcolo:
- `GET /resources/registry` — `SUM(fte) GROUP BY resource_id, week_start`
- `GET /allocation/warnings` — stessa logica per dare warning informativi
- `PUT /allocation` — non la fa affatto (è il bug ③)

**Proposta:** introdurre un service applicativo che centralizza la regola.
**Senza nuove tabelle.** `AllocationEntry` resta l'unica fonte di verità.

`backend/src/services/allocationAggregator.ts`:
```typescript
export class AllocationAggregator {
  // Σ FTE su tutti i progetti per una coppia (resource, week)
  async getWeeklyTotal(
    resource_id: number,
    week_start: string,
    opts?: { excludeProjectId?: number }
  ): Promise<number>

  // Restituisce { ok, current_total, requested, would_be, excess?, breakdown? }
  async canAllocate(
    resource_id: number,
    week_start: string,
    requested_fte: number,
    excludeProjectId?: number
  ): Promise<AllocationDecision>

  // Versione aggregata multi-resource per /resources/registry
  async getRegistryAggregate(opts?: {
    includeClosed?: boolean
  }): Promise<RegistryAggregate>
}
```

**Atomicità sul write (Step D):** dentro la transazione del `PUT /allocation`,
prima del check, prendere un advisory lock sulla coppia:
```typescript
await client.query(
  `SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2))`,
  [resource_id, week_start]
);
const decision = await aggregator.canAllocate(...);
if (!decision.ok) return res.status(409).json({ ... });
// poi INSERT/UPDATE su AllocationEntry
```
L'advisory lock serializza solo le scritture sulla coppia toccata, non
blocca chi sta scrivendo su risorse o settimane diverse.

**Conseguenze:**
- `GET /resources/registry` chiama `aggregator.getRegistryAggregate()` — stessa SQL di oggi, ma incapsulata
- `GET /allocation/warnings` chiama `aggregator.getWeeklyTotal()`
- `PUT /allocation` chiama `aggregator.canAllocate()` per enforcement (Step D)
- La regola `> 1.0 → reject` vive in `canAllocate` e basta

**Costo:** ~3–4h. Un service da ~100 righe, refactor degli endpoint
esistenti per delegargli la SUM, due test unitari (uno per
`getWeeklyTotal`, uno per la race condition con advisory lock).

**Perché non la materialized table:**
- Single source of truth = `AllocationEntry`, zero rischio di drift
- Niente migration di seeding da dati esistenti
- Niente CASCADE handling quando una fase viene cancellata
- A scala POC la SUM è O(allocazioni-per-coppia) = pochi millisecondi
- Reversibile: se a volume reale serve performance, l'API del service resta
  identica e si cambia solo l'implementazione interna (passa a leggere da
  una tabella mantenuta da trigger). I call site non se ne accorgono.

### 2.2 Baseline e Allocation: il merge è corretto, ma va completato

L'unione di `/baseline` e `/allocation` in `/pianificazione` è la scelta
giusta perché baseline e allocation **sono la stessa entità vista a due
livelli di aggregazione**. Tenerle separate creava l'illusione di
indipendenza e produceva bug come il problema ① (lock non protegge il
budget).

Per completare correttamente il merge serve un cambiamento mentale:
non c'è "una baseline" e "una allocation" — c'è una sola **pianificazione**
con due stati nel ciclo di vita: working copy (modificabile) e locked
(immutabile, è la BAC). Lo Step B (snapshot totali) materializza questa
distinzione.

A regime:
- `Baseline` = snapshot della pianificazione al lock + parametri di progetto
  (contingency)
- `AllocationEntry` = working copy corrente, modificabile
- Variance = working copy attuale vs snapshot lockato

Non servono altre entità.

### 2.3 OngoingSnapshot: passare da incrementale a per-fase

Oggi un `OngoingSnapshot` rappresenta lo stato consuntivato dell'intero
progetto a una data. È un modello "fotografia". Quando aggiunto il
`phase_id` (Step E), il modello cambia da "fotografia di progetto" a
"fotografia di fase". Va bene così, ma va dichiarato esplicitamente:

- 5 snapshot per data di reporting (uno per fase) → ricostruibile l'aggregato
  di progetto sommando
- Alternativa: un solo snapshot con breakdown JSONB per fase → più compatto,
  meno query, ma meno SQL-friendly per analisi

Raccomandazione: 5 righe separate. Più verbosi ma SQL-friendly per la futura
analisi storica e per i grafici di trend nel tempo.

### 2.4 Eliminare ridondanze nello schema

- `User` non viene mai letta. Lasciarla finché Step H non parte (è il suo
  consumatore naturale). Ma se passano altre due settimane senza touch,
  rimuoverla nel branch di auth — droppare e ricreare con i campi giusti.
- `Project.share_token` e `share_token_expires_at` sono presenti in schema
  ma mai usati. Lasciarli o droppare nel branch share-link. Niente in mezzo.
- `Project.country_code` ha default 'IT' ed è hardcoded ovunque. Per il POC
  va benissimo. Documentarlo come tech debt voluto, non come dimenticanza.

---

## 3. Semplificazioni UI — pagine e navigazione

L'audit visivo mostra ridondanze e overhead che vale la pena rimuovere prima
di aggiungere altre pagine (DM views, share portal). Più pagine ci sono, più
costa rifattorizzare dopo.

### 3.1 Dashboard: 6 KPI cards → 4

Oggi la riga KPI ha:
1. Speso
2. Budget
3. Previsione **(con sub: "Scostamento: £X")**
4. Costo/gg
5. **Scostamento** (card separata, stessa informazione del sub sopra)
6. Giorni rimasti

Card 3 e card 5 mostrano lo stesso dato. Proposta:

- Rimuovere card "Scostamento" separata
- Riorganizzare in 4 card: **Speso · Budget · Previsione (con Δ inline) · Giorni rimasti**
- "Costo/gg" è un dato derivato, sposta in tabella Budget per Fase dove ha già una colonna

Risultato: meno rumore visivo, più focus sul RAG banner e sulla tabella
budget per fase.

### 3.2 Settings: vale ancora come pagina dedicata?

Oggi `/settings` contiene esclusivamente la gestione dei `PhaseTemplate`.
Quando il `display_name` per fase è già modificabile direttamente in
`/pianificazione` Tab Fasi (inline edit), la pagina Settings serve solo a
gestire i **default** per i nuovi progetti.

Opzioni:
- **(a)** Lasciare così. Honest scope: "questa pagina gestisce i template
  che vengono usati alla creazione di nuovi progetti."
- **(b)** Spostare la gestione template dentro la modal "Crea nuovo progetto",
  rimuovere la pagina Settings, liberare il link dalla nav.
- **(c)** Estendere Settings con altre configurazioni di tenant (festività,
  contingency default globale, currency default).

Raccomandazione: **(a) per ora**, ma sapere che quando arriverà l'auth si
prevedrà la **(c)** come "Admin area" del DM.

### 3.3 Navigation: collassare i due livelli

Oggi la nav ha:
- A sinistra: logo + breadcrumb progetto
- Al centro: 4 tab di progetto (Dashboard / Pianificazione / Gantt / Avanzamento)
- A destra: 3 link globali (Portfolio / Registro Risorse / Impostazioni)

Funziona ma scoraggia l'aggiunta di nuove pagine (es. DM portfolio, share
link admin). Quando si arriverà a 6-7 link globali la nav esplode.

Proposta: collassare i link globali in un menu utente (avatar + dropdown)
in alto a destra. Il centro della nav diventa esclusivamente la
contestualizzazione del progetto corrente.

```
[Logo] / [Nome Progetto]   Dashboard · Pianif. · Gantt · Avanz.    [Avatar ▾]
                                                                      └─ Portfolio
                                                                      └─ Registro Risorse
                                                                      └─ Impostazioni
                                                                      └─ Esci
```

Vantaggio: scala a N link senza overflow, separa "contesto progetto" da
"navigazione applicativa", lascia spazio mentale per le DM views future.

### 3.4 Avanzamento: ridurre la duplicazione di entry point

Oggi l'avanzamento è raggiungibile da:
- Tab "Avanzamento" nella nav progetto
- Bottone "Vai ad Avanzamento" nel banner Dashboard quando non c'è snapshot
- Bottone "Inserisci primo snapshot" nella card Avanzamento della Dashboard
- Bottone "Inserimento Manuale" nella stessa card quando lo snapshot esiste

Quattro entry point per la stessa pagina. Va bene per il primo onboarding,
ma il duplicato in Dashboard è eccessivo. Proposta:

- Mantenere il banner "il budget è configurato, vai ad Avanzamento" come
  empty state forte (è educativo)
- Rimuovere il bottone "Inserimento Manuale" dalla card laterale (la tab
  nav è già lì)
- Semplificare la card Avanzamento nella dashboard a "ultimo snapshot:
  data + ore + costo + sorgente". Niente CTA, è informativa.

### 3.5 Projects page: una sola label

Oggi il titolo cambia in base al ruolo: "I Tuoi Progetti" (PM) o
"Portfolio — Tutti i Progetti" (DM). Tecnicamente corretto, ma la pagina
fa la stessa cosa.

Quando arriveranno le viste DM dedicate (`/dm/portfolio` con swimlane,
`/dm/resources` con semafori), questa pagina avrà senso solo per il PM. Il
DM avrà il suo entry point dedicato.

Per ora va bene così, ma documentare che alla nascita di `/dm/*` la pagina
`/projects` torna a un solo titolo: "I Tuoi Progetti".

---

## 4. Definizione di "pronto per la fase successiva"

Per dichiarare lo Step 9 chiuso e poter iniziare lo Step 10 (seeding dati
reali del progetto PChallenges) i seguenti devono essere fatti:

**Bloccanti** (definition of done):
- [ ] Step A — Lock check su PUT /allocation
- [ ] Step B — Snapshot totali in Baseline
- [ ] Step C — Resource Registry materializzato
- [ ] Step D — FTE cap enforcement sulla scrittura

**Fortemente consigliati prima del seeding** (ridurranno il rework):
- [ ] Step E — phase_id su OngoingSnapshot
- [ ] Step F — Phase Financial Engine
- [ ] Step I — Date fase mutabili dopo lock (richiesto da casistiche reali)
- [ ] 3.1 — Dashboard KPI cards a 4
- [ ] 3.4 — Avanzamento dedup entry point

**Possono aspettare uno step dedicato:**
- [ ] Step G — day_rate versioning (può fare cascade tattico per ora)
- [ ] Step H — Auth backend (workstream parallelo)
- [ ] Step J — Re-baselining con versioning (post-auth)
- [ ] 3.2, 3.3, 3.5 — Settings, nav, label projects

---

## 5. Prompt operativo per Claude Code

Quando aprirai una sessione Claude Code per attaccare questi step, usa
questo prompt come kickoff:

```
Sto lavorando sul branch feature/step-9-pianificazione del repo
project-forecast-app. Leggi nell'ordine:

1. AGENTS.md (design document principale)
2. docs/ARCHITECTURE_AS_IS.md (stato attuale e problematiche)
3. docs/NEXT_STEPS.md (questo documento)

Voglio iniziare dallo Step A (Lock check su PUT /allocation).
Procedi in questo modo:

- Crea un branch dedicato: fix/step-a-baseline-lock-enforcement
- Modifica allocations.ts aggiungendo il check su Baseline.locked_at
  all'inizio del PUT, prima di BEGIN
- Aggiungi lo stesso check a resources.ts PUT (se la risorsa ha allocation
  su progetti con baseline lockata)
- Scrivi un test in routes.test.ts che verifica:
    1. PUT /allocation su baseline non lockata → 200
    2. POST /baseline/lock → 200, locked_at valorizzato
    3. PUT /allocation su baseline lockata → 400
- Verifica con npm test che tutto passi
- Fai un commit semantico e apri una PR

Quando Step A è merged, passa allo Step B. Ferma dopo ogni step per
review.
```

Esegui uno step per volta. Niente "vado avanti fino a quando finisco i
token". Ogni step → branch → test → PR → review → merge → next.
