# Macro-Area 05 — Timeline: Gantt & Milestone

> Documento funzionale/di dominio. Fonte: codice reale (non CLAUDE.md).
> File analizzati: `backend/src/routes/gantt.ts`, `frontend/src/pages/gantt/*`,
> `backend/src/db/migrations/005_missing_tables.sql`, `014_core_indexes.sql`.

---

## 1. Nome Modulo

**Timeline — Gantt & Milestone** (route API `/api/projects/:id/gantt`, pagina FE `pages/gantt/`).

---

## 2. Obiettivo di Business

Fornire la **rappresentazione temporale** del progetto: visualizzare le fasi lungo un
asse settimanale, dettagliare il lavoro in **task** all'interno di ogni fase e tracciare
i **traguardi (milestone)** con il confronto tra data pianificata ed effettiva.

Sostituisce il foglio "Gantt" dell'Excel originale, aggiungendo:
- interattività (drill-down fase → task, editing inline),
- confronto pianificato vs effettivo sulle milestone,
- una linea "Oggi" per leggere a colpo d'occhio l'avanzamento temporale.

Il modulo è puramente **temporale/di scheduling**: non calcola costi (quelli vivono in
Pianificazione/Baseline). Le date dei task sono vincolate dentro i confini della fase
di appartenenza.

---

## 3. Attori

- **Project Manager (PM)** proprietario del progetto — crea/modifica/elimina task e
  milestone, aggiorna la data effettiva delle milestone. L'accesso passa dal guard
  `requireAuth + requireProjectAccess` montato sul prefisso `/api/projects/:id`
  (ownership `pm_id`).
- **Delivery Manager (DM)** — bypassa l'ownership (vede/gestisce progetti di qualunque PM).
- **Sistema** — al `GET` calcola `working_days` e i confini temporali del progetto
  (`project_start`/`project_end`) come min/max delle date di fase.

---

## 4. Funzionalità Operative

### 4.1 Lettura Gantt completo
`GET /api/projects/:id/gantt` (`gantt.ts:13`). Restituisce nome progetto, `project_start`
e `project_end` (derivati da min/max delle `planned_start`/`planned_end` delle fasi,
`gantt.ts:60-63`), e l'elenco fasi ciascuna con i propri task ordinati per
`phase_id, start_date` (`gantt.ts:28`).

### 4.2 Creazione task
`POST /api/projects/:id/gantt/tasks` (`gantt.ts:79`). Richiede `phase_id`, `name`,
`start_date`; opzionali `owner`, `end_date`, `is_milestone`, `status`. Il backend calcola
`working_days` con `calculateNetworkDays` (`gantt.ts:113`) e materializza il record.
Dal FE la creazione parte dalla riga "＋ Aggiungi task" nella Vista Completa
(`FullView.tsx:87-100` → `openAddModal` in `index.tsx:67`).

### 4.3 Creazione milestone
È un task con `is_milestone = true`. Nel modale la checkbox "È una milestone"
(`TaskModal.tsx:133-141`) forza `end_date = start_date` (`TaskModal.tsx:42-43`,
payload `TaskModal.tsx:68`) e mostra il campo "Data effettiva" (`actual_date`,
`TaskModal.tsx:177-186`).

### 4.4 Modifica task/milestone
`PUT /api/projects/:id/gantt/tasks/:tid` (`gantt.ts:138`). Update parziale (solo i campi
presenti nel body, `gantt.ts:184-190`). Se cambiano le date, rivalida i confini di fase
(`gantt.ts:147-177`). FE: click su una riga task in Vista Completa apre il modale in
`mode:'edit'` (`FullView.tsx:48` → `openEditModal` `index.tsx:48`).

### 4.5 Aggiornamento data effettiva milestone (inline)
Campo `DateInput` inline nella Vista Completa (`FullView.tsx:62-70`) e nella Vista
Milestone (`MilestoneView.tsx:38-43`), che chiama `handleUpdateMilestone`
(`index.tsx:85-89`) → `PUT` con solo `actual_date`. `actual_date` vuoto → `null`
(`gantt.ts:184`).

### 4.6 Eliminazione task
`DELETE /api/projects/:id/gantt/tasks/:tid` (`gantt.ts:209`). FE: pulsante "Elimina" nel
modale in modalità edit (`TaskModal.tsx:206-213`).

### 4.7 Le tre viste (`index.tsx:17-21`)
- **Vista Fasi** (`PhasesView.tsx`): una riga per fase con la barra della fase; sulla
  stessa riga compaiono **solo le milestone** (`PhasesView.tsx:23-25`). Sola lettura.
- **Vista Completa** (`FullView.tsx`): fasi espandibili/collassabili
  (`index.tsx:40-46`, `collapsed`); ogni fase elenca tutti i task, con barra task,
  editing al click e riga "aggiungi task". Milestone mostrano rombo pianificato + rombo
  effettivo verde (`FullView.tsx:75-81`).
- **Vista Milestone** (`MilestoneView.tsx`): elenco piatto di tutte le milestone di tutte
  le fasi (`MilestoneView.tsx:11-13`), con date P(ianificata)/E(ffettiva) e doppio rombo
  sulla timeline; messaggio "Nessuna milestone definita" se vuota (`MilestoneView.tsx:15`).

---

## 5. Flussi di Lavoro

**F1 — Pianificare i task di una fase**
1. PM apre Gantt → Vista Completa, espande la fase.
2. Click su "＋ Aggiungi task" → modale con `start_date` pre-popolato all'inizio fase
   (`index.tsx:77`).
3. Inserisce nome, owner opzionale, intervallo date; salva → `POST tasks`.
4. Il sistema calcola i giorni lavorativi e disegna la barra.

**F2 — Definire un traguardo (milestone)**
1. Nel modale spunta "È una milestone" → data unica pianificata.
2. Salvataggio: task con `is_milestone=true`, `end_date=start_date`.
3. Appare come rombo ◆ in tutte le viste.

**F3 — Consuntivare una milestone**
1. Al raggiungimento reale, PM inserisce la "Data effettiva" (inline o da modale).
2. Compare un secondo rombo verde: lo scostamento pianificato↔effettivo è visibile
   graficamente (`MilestoneView.tsx:47-58`).

**F4 — Riprogrammare un task**
1. Click sul task → modale edit → cambia date.
2. Il backend rivalida contro i confini di fase prima di persistere (`gantt.ts:147-177`);
   errore 400 con messaggio in italiano se fuori limite.

---

## 6. Regole di Business

**R1 — Task vs Milestone (`is_milestone`).** La stessa entità `GanttTask` rappresenta
entrambi. Discriminante: colonna booleana `is_milestone` (`005_missing_tables.sql:54`).
Milestone → data puntuale: `end_date` forzato uguale a `start_date` sia lato FE
(`TaskModal.tsx:42-43,68`) sia lato BE (default `end_date ?? start_date`, `gantt.ts:119`).
Rendering: task = barra orizzontale; milestone = rombo ◆ (`bars.tsx:37-57`).

**R2 — Planned vs Actual.** `start_date`/`end_date` = pianificato; `actual_date` (nullable,
`005_missing_tables.sql:55`) = data effettiva, **usata solo per le milestone** nell'UI.
Rombo pianificato colore `milestone`, rombo effettivo colore `rag-green`
(`MilestoneView.tsx:47-58`, `FullView.tsx:75-81`). Per i task non-milestone `actual_date`
non ha rappresentazione visiva.

**R3 — Associazione a fase e progetto.** Ogni task ha FK `project_id` e `phase_id`
(`005_missing_tables.sql:47-48`), entrambe `ON DELETE CASCADE` (eliminando fase/progetto
spariscono i task). Ereditano `phase_type` dalla fase nel payload di risposta
(`gantt.ts:39,125`). In create/update la fase deve appartenere al progetto
(`gantt.ts:87-91`).

**R4 — Vincoli temporali (fase come contenitore).** Regole applicate sia in `POST`
(`gantt.ts:98-110`) sia in `PUT` (`gantt.ts:164-176`) e ridondate lato FE
(`TaskModal.tsx:52-60`):
- `end_date ≥ start_date`;
- `start_date ≥ planned_start` della fase;
- `end_date ≤ planned_end` della fase.
Violazioni → `400` con messaggio esplicativo in italiano.

**R5 — Giorni lavorativi.** `working_days` calcolato dal backend con
`calculateNetworkDays(start, end, [])` (`gantt.ts:112-113`) — attualmente **senza lista
festività** (array vuoto). Valore materializzato alla create; **non ricalcolato** in
update (l'UPDATE tocca `start_date`/`end_date` ma non `working_days`).

**R6 — Stato task.** `status ∈ {not_started, in_progress, completed}` con CHECK a DB
(`005_missing_tables.sql:56`, default `not_started`). Determina il colore della barra
(`config.ts:38-42`: completed=verde, in_progress=accent, not_started=grigio).

**R7 — Rendering settimanale.** La griglia è su scala **settimanale**: `WEEK_PX=60`
(`config.ts:3`). `getWeeks` allinea la prima settimana al lunedì (`config.ts:29`) e itera
di 7 giorni. Posizione/larghezza in px derivate dai giorni diviso 7
(`toPx`/`spanPx`, `config.ts:18-24`); larghezza minima barra 6px. Linea "Oggi" =
`TODAY` in ISO (`config.ts:6`) disegnata se dentro il range progetto (`index.tsx:175`,
`bars.tsx:12`).

**R8 — Confini del progetto derivati.** `project_start`/`project_end` non sono persistiti:
sono min/max delle date di fase calcolati a ogni GET; fallback a "oggi" se assenti
(`gantt.ts:60-63`).

**R9 — Ordinamento.** Fasi per campo `order` (`gantt.ts:21`); task per
`phase_id, start_date` (`gantt.ts:28`). Indice `(project_id, is_milestone)` a supporto
(`014_core_indexes.sql:25-26`).

---

## 7. Verifica CLAUDE.md

Riferimento in CLAUDE.md: *"`gantt.ts` — Task e milestone CRUD"* e tabella `GanttTask`
= *"Task e milestone per fase"*. **Accurato ma sintetico.**

Precisazioni/omissioni rispetto al codice:
- CLAUDE.md non menziona le **tre viste** (Fasi/Completa/Milestone) né la distinzione
  planned/actual sulle milestone — dettaglio funzionale rilevante presente nel codice.
- Non documenta i **vincoli temporali task-dentro-fase** (R4), che sono una regola di
  business forte.
- La struttura FE reale è `frontend/src/pages/gantt/` (cartella con `index.tsx`, `views/`,
  `bars.tsx`, `config.ts`, `TaskModal.tsx`), mentre CLAUDE.md nel Repository Layout cita
  `Gantt.tsx` come singolo file di pagina: **disallineato** (refactor in cartella non
  riflesso nel layout documentato).
- La tabella `GanttTask` è creata nella migrazione **005** (`005_missing_tables.sql`), non
  001; coerente con "Data Model" ma la migrazione specifica non è indicata.

---

## Open Point

- **OP1 — Festività ignorate in `working_days`.** `calculateNetworkDays` è invocato con
  `[]` (`gantt.ts:113`) nonostante esista `PublicHoliday` pre-seeded. Voluto o da
  collegare? Impatta l'accuratezza dei giorni lavorativi mostrati.
- **OP2 — `working_days` non aggiornato in `PUT`.** Modificando le date di un task il
  valore resta quello iniziale. Comportamento atteso o bug?
- **OP3 — `actual_date` per task non-milestone.** Il campo esiste a DB e nel payload ma
  l'UI lo espone/renderizza solo per le milestone. È previsto un uso futuro per i task?
- **OP4 — Nessun vincolo di ordinamento/dipendenza tra task** (no predecessori/successori):
  il Gantt è puramente posizionale. Confermare che le dipendenze non siano in scope.
