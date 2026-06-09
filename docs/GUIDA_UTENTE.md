# Guida Utente — Project Forecast App

> Versione: giugno 2026 — Applicabile ai ruoli PM e DM

---

## Indice

1. [Introduzione e Scopo](#1-introduzione-e-scopo)
2. [Accesso all'Applicazione](#2-accesso-allapplicazione)
3. [Portfolio Progetti (pagina principale)](#3-portfolio-progetti-pagina-principale)
4. [Dashboard di Progetto](#4-dashboard-di-progetto)
5. [Pianificazione](#5-pianificazione)
   - 5.1 [Tab Fasi & Date](#51-tab-fasi--date)
   - 5.2 [Tab Risorse & Budget (Allocation Matrix)](#52-tab-risorse--budget-allocation-matrix)
6. [Avanzamento (Ongoing)](#6-avanzamento-ongoing)
7. [Gantt](#7-gantt)
8. [Registro Risorse (vista DM)](#8-registro-risorse-vista-dm)
9. [Impostazioni](#9-impostazioni)
10. [Concetti Chiave](#10-concetti-chiave)
11. [Flussi Passo-Passo (How-To)](#11-flussi-passo-passo-how-to)
12. [FAQ e Risoluzione Problemi](#12-faq-e-risoluzione-problemi)

---

## 1. Introduzione e Scopo

Project Forecast App è uno strumento web per gestire budget, allocazione risorse, milestone e Gantt di uno o più progetti. Sostituisce il file Excel `Project_Forecast_v16.xlsx` con una piattaforma multiutente accessibile da browser, senza bisogno di inviare file via email o gestire versioni manuali.

### Cosa migliora rispetto a Excel

| Excel (`Project_Forecast_v16.xlsx`) | Project Forecast App |
|---|---|
| Un file per progetto, gestione manuale delle versioni | Tutti i progetti in un unico sistema, sempre aggiornati |
| Formule fragili, nessuna validazione | Calcoli centralizzati, validazione integrata (FTE cap, date, budget) |
| Nessun controllo accessi | Ogni PM vede solo i propri progetti; il DM vede tutto il portfolio |
| Nessun storico delle modifiche | Baseline bloccabile + storico snapshot avanzamento |
| Esportazione manuale verso altri strumenti | Integrazione Keyedin per importare dati di avanzamento reali |
| Nessun alert visivo sul rischio | Semaforo RAG automatico (verde / giallo / rosso) |

### I due ruoli: PM vs DM

**PM — Project Manager**
- Accede solo ai propri progetti (il sistema filtra automaticamente).
- Gestisce pianificazione, allocazioni, avanzamento e Gantt di ogni progetto.
- Non vede i progetti degli altri PM.

**DM — Delivery Manager**
- Vede tutti i progetti del portfolio, indipendentemente dal PM assegnato.
- Ha accesso al **Registro Risorse** globale, con la matrice cross-project di allocazione FTE.
- Può monitorare lo stato RAG di tutti i progetti dalla pagina Portfolio.

💡 **Suggerimento:** Il tuo ruolo è visibile nella barra di navigazione in alto dopo il login.

---

## 2. Accesso all'Applicazione

### Come fare il login

1. Apri l'URL dell'applicazione nel browser (Chrome o Firefox consigliati).
2. Nella schermata di accesso, inserisci il tuo indirizzo **Email** aziendale.
3. Inserisci la tua **Password**.
4. Clicca il pulsante **Accedi**.

Se le credenziali non sono corrette, viene mostrato il messaggio: *"Credenziali non valide. Riprova."* Verifica email e password prima di riprovare.

⚠️ **Nota:** I campi Email e Password sono obbligatori. Se uno dei due è vuoto, l'applicazione mostra un avviso sotto il campo interessato prima ancora di inviare la richiesta.

**Esempio:** L'utente Giuseppe Cerbero (PM) accede con `giuseppe@company.com` e la propria password. Dopo il login viene reindirizzato direttamente alla lista dei suoi progetti.

### Cosa vedo dopo il login

Dopo il login vieni reindirizzato alla pagina **Portfolio Progetti**:
- Se sei **PM**: vedi solo i tuoi progetti.
- Se sei **DM**: vedi tutti i progetti del portfolio con la dicitura *"Portfolio — Tutti i Progetti"* in cima alla pagina.

La sessione rimane attiva finché non esci esplicitamente o la sessione scade (circa 1 ora di inattività). Se la sessione scade, verrai reindirizzato automaticamente alla pagina di login.

### Come uscire

1. Cerca il pulsante di **logout** nella barra di navigazione in alto.
2. Clicca su di esso per terminare la sessione e tornare alla pagina di login.

Dopo il logout, le credenziali vengono rimosse dal browser. Chiunque riapra l'URL vedrà la pagina di login.

---

## 3. Portfolio Progetti (pagina principale)

La pagina Portfolio è il punto di ingresso dopo il login. Mostra tutti i progetti accessibili al tuo ruolo, organizzati in schede (card).

### Come leggere la lista dei progetti

Ogni scheda progetto mostra:
- **Nome progetto** — es. *RXI Platform*
- **Fase corrente** — es. *Build*
- **Badge RAG** — semaforo colorato in alto a destra (verde / giallo / rosso)
- **Barra budget consumato** — percentuale visiva del budget speso rispetto al totale
- **Budget speso / Budget totale** — es. *£36.200 spesi / £64.600 budget*
- **Giorni al termine** — giorni lavorativi mancanti alla fine pianificata, es. *48 gg al termine*
- **Badge stato** — piccola etichetta in basso a destra con lo stato del progetto

Cliccando sulla scheda progetto si apre la **Dashboard** di quel progetto.

### Indicatori RAG (verde/giallo/rosso): cosa significano

Il badge RAG riflette la salute finanziaria del progetto rispetto alla baseline:

| Colore | Etichetta | Significato |
|---|---|---|
| 🟢 Verde | IN_LINEA | La previsione di costo finale non supera il 105% del budget di baseline |
| 🟡 Giallo | A_RISCHIO | La previsione supera il 105% ma non il 115% del budget |
| 🔴 Rosso | FUORI_BUDGET | La previsione supera il 115% del budget di baseline |

**Esempio:** Il progetto *RXI Platform* mostra il badge giallo **A_RISCHIO**. Il budget di baseline è £64.600, la previsione attuale è £69.800 — pari al 108% del budget, oltre la soglia verde del 105%.

💡 **Suggerimento:** Un badge RAG rosso non significa necessariamente che il progetto sia fuori controllo. Verifica prima i dati in Avanzamento — il RAG dipende dall'ultimo snapshot inserito.

### Come filtrare i progetti per stato

In alto a destra nella pagina Portfolio trovi un gruppo di pulsanti filtro:
- **Tutti** — mostra ogni progetto indipendentemente dallo stato
- **Attivo** — solo i progetti con stato *Attivo*
- **In pausa** — solo i progetti sospesi temporaneamente
- **Chiuso** — solo i progetti conclusi

Clicca il pulsante corrispondente per applicare il filtro. Il pulsante attivo diventa evidenziato.

**Esempio:** Vuoi vedere solo i progetti attivi per il PM del portfolio. Clicca **Attivo** e la lista si aggiorna mostrando solo *RXI Platform* e *PChallenges Portal*, escludendo *DataMesh Migration* (chiuso).

### Come cambiare lo stato di un progetto

In ogni scheda progetto, il badge di stato in basso a destra (es. **Attivo**, **In pausa**, **Chiuso**) è cliccabile.

- Ogni clic fa avanzare lo stato nel ciclo: **Attivo → In pausa → Chiuso → Attivo**
- Il cambiamento è immediato e viene salvato automaticamente.

⚠️ **Attenzione:** Lo stato **Archiviato** non è accessibile da questo ciclo. Un progetto archiviato viene escluso dalla visualizzazione normale.

**Esempio:** Il progetto *RXI Platform* è attivo. Clicchi sul badge **Attivo** per sospenderlo temporaneamente — lo stato diventa **In pausa**.

### Budget consumato: come interpretare la barra

La barra orizzontale sotto il nome progetto mostra visivamente la percentuale di budget consumato:
- La barra si riempie proporzionalmente da sinistra a destra.
- Sotto la barra: importo speso (sinistra) e budget totale (destra).
- La percentuale è riportata anche come numero sopra la barra.

**Esempio:** *RXI Platform* — barra al 56% — £36.200 spesi su £64.600 budget. Circa metà budget consumato con il progetto ancora in fase Build.

---

## 4. Dashboard di Progetto

La Dashboard è la vista sintetica di un singolo progetto. Per aprirla, clicca su una scheda nella pagina Portfolio.

### Come aprire la dashboard

Clicca su qualsiasi punto della scheda progetto (tranne il badge di stato). La pagina Dashboard si apre con il nome del progetto nella barra di navigazione.

### I KPI principali

La Dashboard mostra sei schede KPI disposte in fila:

| KPI | Descrizione |
|---|---|
| **Speso** | Costo effettivo registrato fino all'ultimo snapshot di avanzamento |
| **Budget** | Budget totale del progetto (somma dei budget di tutte le fasi) |
| **Previsione** | EAC (Estimated At Completion) — stima del costo finale a completamento |
| **Costo/gg** | Burn rate giornaliero medio, calcolato sull'ultimo snapshot |
| **Scostamento** | Differenza tra Previsione e Budget. Valore positivo = sforamento; negativo = risparmio |
| **Giorni rimasti** | Giorni lavorativi rimanenti fino alla data di fine dell'ultima fase |

**Esempio — RXI Platform:**
- **Speso:** £36.200 (56% del budget)
- **Budget:** £64.600
- **Previsione:** £69.800
- **Costo/gg:** £520
- **Scostamento:** +£5.200 (sopra budget — il valore appare in rosso)
- **Giorni rimasti:** 48

⚠️ **Nota:** Se non hai ancora inserito uno snapshot in Avanzamento, i KPI Speso, Previsione e Scostamento mostrano valori a zero o non sono significativi. La dashboard mostra un avviso che ti invita a inserire il primo snapshot.

### Il banner di stato (verde/giallo/rosso): quando si attiva

In cima alla Dashboard appare un banner colorato che riflette lo stato RAG del progetto:
- 🟢 Sfondo verde chiaro: progetto **IN_LINEA**
- 🟡 Sfondo giallo chiaro: progetto **A_RISCHIO**
- 🔴 Sfondo rosso chiaro: progetto **FUORI_BUDGET**

Il colore del banner corrisponde al badge RAG visibile anche nel Portfolio.

### Budget per Fase: cosa mostra la tabella

La sezione **Budget per Fase** elenca ogni fase del progetto con le colonne:

| Colonna | Descrizione |
|---|---|
| **Fase** | Nome visualizzato della fase (es. Build) |
| **Periodo** | Data inizio → data fine pianificata |
| **GG** | Giorni lavorativi pianificati per la fase (esclusi weekend e festività italiane) |
| **Ore** | Ore pianificate totali (GG × 8) |
| **Burn Rate/gg** | Costo medio giornaliero della fase |
| **Budget £** | Budget totale della fase, calcolato dalle allocazioni risorse |
| **% Totale** | Peso percentuale del budget fase sul budget progetto totale |

In fondo alla tabella una riga **TOTALE** aggrega i valori.

**Esempio — RXI Platform:**

| Fase | Periodo | GG | Budget | % |
|---|---|---|---|---|
| Feasibility | 05/01 → 20/01 | 12 | £4.080 | 6.3% |
| Planning & Design | 21/01 → 27/02 | 28 | £12.320 | 19.1% |
| Build | 02/03 → 19/06 | 80 | £41.600 | 64.4% |
| Deployment | 22/06 → 10/07 | 15 | £6.000 | 9.3% |
| Closure | 13/07 → 22/07 | 8 | £2.600 | 4.0% |
| **TOTALE** | | **143** | **£66.600** | **100%** |

### Forecast per Fase (EAC): come interpretarlo

La sezione **Forecast per Fase (EAC)** appare solo quando sono presenti snapshot di avanzamento. Per ogni fase mostra:

| Colonna | Descrizione |
|---|---|
| **Budget** | Budget pianificato della fase |
| **Speso** | Costo effettivo registrato per la fase |
| **Forecast EAC** | Stima del costo finale a completamento per la fase |
| **Variance** | Differenza EAC - Budget (verde se negativo, rosso se positivo) |
| **% Complet.** | Percentuale di completamento stimata |
| **RAG** | Stato semaforo per la singola fase |

💡 **Suggerimento:** Se la colonna Forecast EAC non è visibile, non sono stati ancora inseriti snapshot in **Avanzamento** per questo progetto.

### Milestone Tracker: come leggere le milestone

In fondo alla Dashboard, la sezione **Milestone Tracker** mostra le ultime 5 milestone del progetto. Per ogni milestone:
- Un **punto colorato** indica lo stato: verde = completata, giallo pulsante = in corso, grigio = non iniziata.
- Il **nome della milestone** (preceduto da ◆).
- La **data pianificata**.
- La **data effettiva** (se compilata): verde se puntuale o in anticipo, giallo se in ritardo.

**Esempio — RXI Platform:**
- ◆ *Feasibility Sign-off* — pianificata 20/01 — effettiva 22/01 (🟡 2 giorni di ritardo)
- ◆ *Design Approved* — pianificata 27/02 — effettiva 01/03 (🟡 2 giorni di ritardo)
- ◆ *Alpha Build Ready* — pianificata 30/04 — nessuna data effettiva (completata)
- ◆ *UAT Complete* — pianificata 12/06 — in corso (punto giallo pulsante)
- ◆ *Go Live* — pianificata 10/07 — non iniziata (punto grigio)

### Pannello Avanzamento: ultimo snapshot registrato

A destra del Milestone Tracker il pannello **Avanzamento** mostra l'ultimo snapshot inserito:
- La **fonte**: "Inserimento Manuale" o "Keyedin API"
- La **data e ora** dell'ultimo aggiornamento
- Un riepilogo: ore spese, costo speso, giorni usati

Se non è stato ancora inserito nessuno snapshot, il pannello mostra *"Nessuno snapshot registrato."* con un pulsante **Inserisci primo snapshot →** che porta direttamente alla pagina Avanzamento.

---

## 5. Pianificazione

La pagina **Pianificazione** è dove si configurano le date delle fasi e si allocano le risorse. Si accede dal menu di navigazione del progetto.

La pagina è divisa in due tab:
- **Fasi & Date** — definisce il calendario del progetto
- **Risorse & Budget** — assegna le risorse settimana per settimana

### 5.1 Tab Fasi & Date

Questa tab mostra una tabella con una riga per ogni fase del progetto.

#### Come definire le date di ogni fase

1. Nella riga della fase che vuoi modificare, clicca sul campo **Inizio** e seleziona la data dal calendario.
2. Clicca sul campo **Fine** e seleziona la data di fine.
3. Ripeti per tutte le fasi.
4. Quando hai terminato, clicca **Salva**.

⚠️ **Validazione:** Se la data di fine è precedente alla data di inizio, il sistema mostra un errore e non salva. Correggi la data prima di riprovare.

#### Giorni lavorativi: come vengono calcolati

Il campo **GG Lavorativi** si aggiorna automaticamente al momento del salvataggio. Il valore esclude:
- Sabati e domeniche
- Festività italiane 2025–2027 (Capodanno, Epifania, Pasquetta, 25 Aprile, 1 Maggio, 2 Giugno, Ferragosto, 1 Novembre, 8 Dicembre, Natale, Santo Stefano e altre festività nazionali)

💡 **Suggerimento:** L'anteprima mostrata nella tabella prima del salvataggio esclude solo i weekend. Il valore definitivo con le festività viene calcolato dal server al momento del salvataggio.

**Esempio:** Fase Build dal 02/03 al 19/06/2026 → 80 giorni lavorativi (weekend + festività del 25/04 e 1/05 esclusi).

#### Contingenza %: cosa è e come usarla

La colonna **Contingenza %** permette di aggiungere una percentuale di riserva sul budget di ogni fase.

- Inserisci un valore tra `0` e `100` nel campo della fase.
- Accanto al campo compare il valore in valuta della contingenza (es. `+£408`).
- La contingenza si riflette nel riquadro **BASELINE TOTAL FORECAST** in fondo alla pagina.

**Esempio:** La fase Feasibility ha un budget di £4.080. Con una contingenza del 10%, il forecast di fase diventa £4.488 (+£408).

La **Baseline Total Forecast** (in basso a destra) somma budget + contingenze di tutte le fasi. Per RXI Platform: £66.600 budget totale, £67.008 forecast totale (contingenza solo su Feasibility al 10%).

#### Budget per fase: come viene calcolato

Il campo **Budget £** nella tabella Fasi è in sola lettura: viene calcolato automaticamente dalla somma delle allocazioni risorse inserite nel tab **Risorse & Budget**. Se non hai ancora allocato nessuna risorsa per una fase, il campo mostra `£0 — definito in Risorse`.

#### Come salvare le modifiche

Dopo aver modificato date, nomi o contingenze, clicca il pulsante **Salva** in alto a destra del tab. Se il salvataggio va a buon fine, il pulsante mostra brevemente `✓ Salvato`.

✅ Le modifiche non vengono applicate finché non clicchi **Salva**. Puoi annullare uscendo dalla pagina senza salvare (il browser potrebbe chiedere conferma se ci sono modifiche non salvate).

#### Blocca Baseline: cosa significa e quando farlo

Il pulsante **🔒 Blocca Baseline** fissa definitivamente date, budget e contingenze come punto di riferimento permanente (BAC — Budget at Completion).

⚠️ **Azione irreversibile.** Una volta bloccata, la baseline non può essere modificata. Tutte le variazioni future (scostamenti, EAC) vengono calcolate rispetto a questo valore fisso.

**Quando bloccare la baseline:**
- Quando il progetto ha ottenuto l'approvazione formale del budget
- Prima di iniziare a registrare l'avanzamento
- Prima della fase di Build

Dopo il blocco, la pagina Fasi mostra l'avviso: *"🔒 Bloccata il [data]. I dati sono in sola lettura."* e tutti i campi diventano non modificabili.

**Come bloccare la baseline:**

1. Verifica che date e contingenze siano corrette per tutte le fasi.
2. Clicca **🔒 Blocca Baseline**.
3. Leggi con attenzione il messaggio di conferma.
4. Clicca **Blocca Definitivamente** per confermare.

---

### 5.2 Tab Risorse & Budget (Allocation Matrix)

Questo tab mostra un blocco per ogni fase del progetto. Ogni blocco contiene una matrice con:
- **Righe:** le risorse allocate alla fase
- **Colonne:** le settimane comprese tra l'inizio e la fine della fase
- **Celle:** il valore FTE assegnato a quella risorsa per quella settimana

#### Come aggiungere un'allocazione risorsa

1. Clicca su un blocco di fase per espanderlo (se collassato).
2. In fondo al blocco, clicca **＋ Aggiungi risorsa**.
3. Si apre una finestra modale con due tab:
   - **Dal registro:** mostra le risorse già esistenti nel sistema. Clicca sulla risorsa da aggiungere.
   - **Nuova risorsa:** permette di creare una nuova risorsa inserendo nome, ruolo e day rate.
4. Dopo aver selezionato o creato la risorsa, questa appare come nuova riga nella matrice.

**Esempio:** Nella fase Build di RXI Platform vuoi aggiungere Vishal Patel (Senior Developer, £600/gg). Clicchi **＋ Aggiungi risorsa** → tab **Dal registro** → clicchi su Vishal. La riga appare nella matrice con le settimane della fase Build (da 02/03 a 19/06).

#### FTE: cosa significa e come inserirlo

**FTE (Full Time Equivalent)** indica la quota di tempo dedicato a quel progetto in quella settimana:
- `FTE = 1.0` → la risorsa lavora a tempo pieno su questo progetto per tutta la settimana
- `FTE = 0.5` → la risorsa dedica metà del proprio tempo (es. 4 ore al giorno su 8)
- `FTE = 0.2` → la risorsa dedica il 20% del tempo (es. 1,5 ore al giorno)

Per inserire un valore FTE:
1. Clicca sulla cella corrispondente alla risorsa e alla settimana desiderata.
2. Digita il valore (es. `0.5`).
3. Il valore viene accettato nell'intervallo `0.0`–`1.0` per singola cella.

Il **costo settimanale** viene calcolato automaticamente: `FTE × Day Rate × Giorni lavorativi nella settimana`.

**Esempio:** Vishal Patel (£600/gg) con FTE `0.8` nella settimana del 02/03 (5 giorni lavorativi):
`0.8 × £600 × 5 = £2.400` costo settimanale.

#### I colori delle celle: cosa indicano

Sotto ogni cella FTE appare un'icona semaforo che indica lo stato di allocazione complessivo di quella risorsa in quella settimana **su tutti i progetti**:

| Icona | Significato |
|---|---|
| ⚪ | Risorsa non allocata in quella settimana |
| 🟡 | Allocazione sottoutilizzata (FTE totale < 80%) |
| ✅ | Allocazione ottimale (FTE totale 80%–100%) |
| 🔴 | Sovrallocazione (FTE totale > 100%) — la cella diventa rossa |

💡 **Suggerimento:** Il semaforo considera la somma FTE della risorsa su **tutti i progetti**, non solo su quello corrente. Se Vishal è già allocato al 80% su PChallenges Portal nella settimana del 06/01, aggiungere un FTE di 0.5 su RXI Platform per quella settimana farebbe scattare il semaforo rosso (totale: 1.3 > 1.0).

#### Limite FTE 1.0: cosa succede se si supera

Il sistema visualizza l'alert di sovrallocazione 🔴 ma non impedisce il salvataggio a livello di singola cella (il limite è informativo nella matrice). La vera prevenzione avviene a livello di salvataggio dell'intera fase.

⚠️ Se tenti di salvare allocazioni che portano una risorsa oltre il 100% FTE in una settimana, il server restituisce un errore 409. Il pulsante **Salva fase** non completa il salvataggio e viene mostrato un messaggio di errore.

**Come risolvere:** Riduci il valore FTE nella cella incriminata (quella evidenziata in rosso) finché il semaforo passa da 🔴 a ✅ o 🟡, poi riprova a salvare.

#### Come salvare le allocazioni per fase

Ogni blocco di fase ha un proprio pulsante **Salva fase**:
- Il pulsante diventa **● Salva fase** (colore giallo-arancio) quando ci sono modifiche non ancora salvate.
- Clicca per salvare le allocazioni della singola fase.
- Dopo il salvataggio il pulsante torna all'aspetto normale e mostra brevemente `✓ Salvato`.

⚠️ **Attenzione:** Ogni fase si salva indipendentemente. Se modifichi più fasi, ricorda di cliccare **Salva fase** per ognuna di esse.

Se la baseline è bloccata, il pulsante non è disponibile e viene mostrato il messaggio: *"🔒 Baseline bloccata — allocazioni in sola lettura"*.

---

## 6. Avanzamento (Ongoing)

La pagina **Avanzamento** registra lo stato effettivo del progetto (costi reali, ore lavorate, giorni impiegati) in un determinato momento. Questi dati alimentano i KPI della Dashboard e il calcolo del forecast EAC.

### A cosa serve la pagina Avanzamento

Ogni volta che vuoi aggiornare la situazione reale del progetto, inserisci uno **snapshot**. Uno snapshot è una fotografia della situazione a una data specifica: quante ore sono state lavorate, quanto è stato speso, quanti giorni lavorativi sono stati consumati.

### Come inserire uno snapshot manuale

Il modulo di inserimento si trova nella metà sinistra della pagina:

1. **Riferito a:** seleziona dal menu a tendina se lo snapshot si riferisce all'intero progetto (`Progetto (aggregato)`) o a una fase specifica (es. `Build`).
2. **Data di riferimento:** seleziona la data alla quale si riferiscono i dati (es. la fine del mese).
3. **Costo speso £:** inserisci il costo totale sostenuto fino a quella data (es. `36200`).
4. **Ore spese:** inserisci il totale delle ore lavorate fino a quella data (es. `320`). Quando inserisci le ore, i campi **GG lavorativi usati** e **GG lavorativi rimanenti** si aggiornano automaticamente (`ore ÷ 8 = giorni usati`; `giorni totali pianificati − giorni usati = giorni rimanenti`).
5. **GG lavorativi usati** e **GG lavorativi rimanenti:** verificabili e modificabili manualmente se necessario.
6. Clicca **Salva Snapshot**.
7. Il sistema mostra una finestra di conferma con il riepilogo: *"Stai per salvare uno snapshot alla data [data] con [ore]h e [costo] di costo. Confermi?"*
8. Clicca **Salva** per confermare.

**Esempio — RXI Platform al 30/04/2026:**
- **Riferito a:** Progetto (aggregato)
- **Data:** 30/04/2026
- **Costo speso:** `36200`
- **Ore spese:** `320` → calcola automaticamente 40 giorni usati, ma il PM inserisce manualmente `58` (le ore includono attività non a progetto pieno)
- **GG rimanenti:** `83` (calcolati automaticamente: 141 totali − 58 = 83)

✅ Dopo il salvataggio, i KPI della Dashboard si aggiornano immediatamente.

### Sync da Keyedin: cosa è e come funziona

Il pulsante **⟳ Sync da Keyedin** in alto a destra tenta di importare automaticamente i dati di avanzamento dal sistema Keyedin, se questo è configurato e disponibile.

⚠️ **Stato attuale:** L'integrazione Keyedin è in fase di test (stub attivo). Se la sincronizzazione fallisce, viene mostrato un messaggio di errore. In questo caso, usa l'inserimento manuale come alternativa sempre disponibile.

Quando uno snapshot viene importato da Keyedin, nello storico appare con il badge **Keyedin** (viola/accent) invece di **Manuale** (grigio).

### Lo storico degli snapshot

La metà destra della pagina mostra lo **Storico Snapshot**: tutti gli snapshot salvati in ordine cronologico.

Per ogni snapshot:
- **Data di riferimento** (es. 30/04/2026)
- **Costo, ore e GG usati**
- **Badge fonte** (Manuale / Keyedin)
- **Badge fase** (Progetto o nome della fase)
- **Data e ora di creazione**

Entro 24 ore dalla creazione, accanto allo snapshot appare un'icona cestino per eliminarlo. Dopo 24 ore lo snapshot non è più eliminabile.

### Come interpretare la progress bar "Utilizzo Budget"

Sopra il modulo di inserimento, la barra **Utilizzo Budget** mostra il rapporto tra il costo speso e il budget totale:
- **Verde** se < 70% del budget consumato
- **Giallo** se tra 70% e 90%
- **Rosso** se > 90%

**Esempio:** £36.200 spesi su £64.600 budget = 56% → barra verde.

---

## 7. Gantt

La pagina **Gantt** mostra il diagramma temporale del progetto con fasi, task e milestone.

### Come leggere il diagramma di Gantt

Il Gantt è strutturato con:
- **Asse orizzontale:** scala temporale a settimane (es. "05 gen", "12 gen", ...)
- **Colonna sinistra:** nome della fase o del task
- **Barre colorate:** estensione temporale di ogni fase o task
- **Linea verticale viola:** posizione di "Oggi" nella timeline
- **Diamanti ◆:** milestone (arancio = pianificata; verde = effettiva)

**Legenda colori:**
- Barra verde: Completato
- Barra viola (accent): In corso
- Barra grigia: Non iniziato
- ◆ arancione: Milestone pianificata
- ◆ verde: Milestone effettiva

### Le viste disponibili

In alto a destra della pagina trovi tre pulsanti di vista:

| Vista | Descrizione |
|---|---|
| **Vista Fasi** | Mostra solo le barre delle fasi con le milestone associate. Vista compatta ideale per overview rapida. |
| **Vista Completa** | Mostra fasi e tutti i task. Ogni fase è espandibile/collassabile. Da qui si aggiungono e modificano i task. |
| **Vista Milestone** | Mostra solo le milestone del progetto, con data pianificata e data effettiva affiancate. |

### Come aggiungere un task o una milestone

1. Passa alla **Vista Completa**.
2. Espandi la fase a cui vuoi aggiungere il task (clicca sull'intestazione della fase).
3. In fondo ai task della fase, clicca sulla riga **＋ Aggiungi task**.
4. Si apre la finestra modale con i campi:
   - **Nome** (obbligatorio)
   - **Owner** — nome del responsabile (opzionale, es. "Vishal")
   - **È una milestone ◆** — spunta se è un punto di consegna puntuale (una sola data)
   - **Inizio** e **Fine** — devono essere comprese nelle date della fase
   - **Stato** — Non iniziato / In corso / Completato
5. Clicca **Crea task**.

**Per aggiungere una milestone:**
- Spunta la casella **È una milestone ◆**.
- Il campo Fine scompare: basta la data pianificata.
- Appare il campo opzionale **Data effettiva** — quando la milestone viene raggiunta, inserisci qui la data reale.

**Esempio:** Aggiungi la milestone "Go Live" nella fase Deployment:
- Nome: `Go Live`
- Owner: (vuoto)
- Milestone: ✓ spuntata
- Data pianificata: `10/07/2026`
- Stato: Non iniziato

### Come modificare un task esistente

1. Passa alla **Vista Completa**.
2. Clicca sul task che vuoi modificare (la riga si evidenzia al passaggio del mouse).
3. Si apre la finestra modale con i valori attuali.
4. Modifica i campi necessari.
5. Clicca **Salva**.

💡 **Aggiornamento rapido milestone:** Nella Vista Completa e nella Vista Milestone, la data effettiva di una milestone può essere aggiornata direttamente dalla riga, senza aprire la modale, cliccando sul piccolo campo data a destra del nome.

### Come eliminare un task

1. Apri il task in modifica (Vista Completa → clic sul task).
2. Nella finestra modale, in basso a sinistra, clicca il pulsante rosso **Elimina**.
3. L'eliminazione è immediata (nessuna ulteriore conferma).

⚠️ **L'eliminazione di un task è irreversibile.** Assicurati di voler procedere prima di cliccare.

### Come interpretare la linea "Oggi"

La linea verticale viola sottile attraversa il Gantt in corrispondenza della data odierna. Permette di vedere immediatamente quali fasi e task sono in ritardo (la loro barra finisce a sinistra della linea) e quali sono ancora futuri (a destra).

**Esempio — RXI Platform al 09/06/2026:** La linea "Oggi" si trova dentro la barra della fase Build (in corso). Lo Sprint 3 — Integration è iniziato, lo Sprint 4 e UAT Complete sono ancora a destra della linea.

---

## 8. Registro Risorse (vista DM)

La pagina **Registro Risorse** è accessibile dalla barra di navigazione principale. Mostra una matrice cross-project di tutte le risorse del sistema e la loro allocazione FTE settimana per settimana.

### A cosa serve il registro risorse globale

Il registro permette al DM (e anche ai PM) di verificare se una risorsa è sovrallocata su più progetti contemporaneamente, prima di pianificare nuove allocazioni.

### Come leggere la matrice cross-project

La tabella ha:
- **Righe:** ogni risorsa è un gruppo di righe. La prima riga del gruppo (in grigio scuro) mostra il totale FTE della risorsa in ogni settimana. Le righe successive (rientrate) mostrano il dettaglio per progetto.
- **Colonne:** ogni colonna è una settimana (es. "W05 gen")
- **Celle:** percentuale di allocazione FTE in quella settimana

Le celle del totale risorsa mostrano sia la percentuale che l'icona semaforo:
- ⚪ 0% — non allocata
- 🟡 1–79% — sottoutilizzo
- ✅ 80–100% — ottimale
- 🔴 > 100% — sovrallocazione

Cliccando sull'intestazione di una risorsa (riga grigia), il dettaglio per progetto si comprime/espande.

**Esempio:** Vishal Patel (Senior Developer, £600/gg) nella settimana del 01/06:
- RXI Platform: 80% FTE
- PChallenges Portal: 50% FTE
- **Totale: 130% FTE** → 🔴 sovrallocazione

### Alert sovrallocazione: cosa significa e come risolvere

Se una o più risorse sono sovrallocate, in cima alla pagina appare un riquadro rosso:

> ⚠️ Sovrallocazione rilevata  
> Vishal Patel: W01 giu — FTE > 100%

Per risolvere la sovrallocazione:
1. Identifica la settimana e i progetti coinvolti (visibile nel dettaglio della riga risorsa).
2. Vai nella **Pianificazione** di uno dei progetti coinvolti → tab **Risorse & Budget**.
3. Riduci il valore FTE della risorsa in quella settimana.
4. Salva la fase.

### Come filtrare la matrice

Sopra la tabella trovi tre controlli di filtro:
- **Menu risorsa** — filtra la vista su una singola risorsa
- **Menu progetto** — filtra la vista su un singolo progetto
- **Mostra progetti chiusi** — pulsante toggle che include/esclude le settimane di progetti con stato Chiuso o Archiviato (default: esclusi)

Per azzerare i filtri, clicca il pulsante **✕ Reset filtri**.

**Esempio:** Vuoi vedere solo l'allocazione di Giuseppe Cerbero su RXI Platform. Seleziona "Giuseppe Cerbero" nel menu risorsa e "RXI Platform" nel menu progetto. La matrice si riduce a una sola riga con le settimane rilevanti.

### Come aggiungere una nuova risorsa

Le risorse possono essere create direttamente dalla **Pianificazione → Risorse & Budget → ＋ Aggiungi risorsa → tab "Nuova risorsa"**. Una risorsa creata in qualsiasi progetto diventa disponibile nel registro globale e in tutti gli altri progetti.

### Come modificare una risorsa esistente (day rate)

⚠️ **Funzionalità non disponibile direttamente dal Registro Risorse.** Il day rate si aggiorna tramite le operazioni di allocazione. Contatta l'amministratore di sistema per modificare il day rate di una risorsa esistente (la modifica si applica alle nuove allocazioni future).

### Come eliminare una risorsa

Una risorsa non può essere eliminata se è allocata su almeno un progetto attivo. Per eliminarla:
1. Rimuovila prima da tutte le fasi di tutti i progetti (Pianificazione → Risorse & Budget → clicca ✕ sulla riga della risorsa).
2. Contatta l'amministratore per la rimozione definitiva dal registro.

---

## 9. Impostazioni

La pagina **Impostazioni** è accessibile dalla barra di navigazione. Contiene la configurazione dei **template di fase** che vengono applicati ai nuovi progetti.

### Come configurare i template delle fasi

I template definiscono le fasi predefinite che vengono create automaticamente ogni volta che viene creato un nuovo progetto. Di default esistono cinque fasi standard:

1. Feasibility
2. Planning & Design
3. Build
4. Deployment
5. Closure

La pagina mostra una tabella con colonne **#** (ordine), **Nome fase**, **Contingenza %** e una colonna di azioni.

### Come aggiungere una fase template

In fondo alla tabella c'è il modulo di aggiunta rapida:
1. Nel campo **Nome nuova fase…** inserisci il nome (es. "Testing").
2. Nel campo **Cont. %** inserisci la percentuale di contingenza di default (es. `5`).
3. Clicca **＋ Aggiungi** (o premi Invio).

La nuova fase appare in fondo alla lista con ordine progressivo.

### Come modificare una fase template

Ogni riga della fase è modificabile inline:
1. Clicca sul nome della fase — il testo diventa un campo di input modificabile.
2. Modifica il nome.
3. Premi **Invio** o clicca altrove per confermare.
4. Allo stesso modo puoi cliccare sul valore di contingenza per modificarlo.

### Come riordinare le fasi template

Ogni riga ha due pulsanti freccia:
- **↑** — sposta la fase su di una posizione
- **↓** — sposta la fase giù di una posizione

I pulsanti ↑ e ↓ sono disabilitati quando la fase è già in cima o in fondo alla lista.

### Come eliminare una fase template

1. Clicca l'icona cestino nella riga della fase da eliminare.
2. Il sistema chiede conferma: *"Stai per eliminare la fase '[nome]' dal template. I progetti esistenti non saranno modificati."*
3. Clicca **Elimina** per confermare.

### Nota importante

⚠️ **Le modifiche ai template si applicano solo ai nuovi progetti.** I progetti già esistenti mantengono le proprie fasi con i propri nomi e contingenze. Per rinominare una fase di un progetto esistente, fai clic inline sul nome della fase nella pagina **Pianificazione → Fasi & Date**.

---

## 10. Concetti Chiave

### Baseline e BAC

La **Baseline** è il piano approvato del progetto: date, budget per fase e contingenze. Una volta bloccata diventa il riferimento fisso per tutti i calcoli di scostamento.

Il **BAC (Budget at Completion)** è il valore totale del budget al momento del blocco baseline. Non cambia mai dopo il blocco.

**Perché è importante:** Senza baseline bloccata, il sistema non può calcolare se il progetto è "in linea", "a rischio" o "fuori budget" in modo affidabile, perché il riferimento cambierebbe ad ogni modifica.

**Quando bloccare:** Quando il budget è approvato formalmente e prima di iniziare a registrare i costi reali.

### RAG Status: come viene calcolato

Il RAG (Red / Amber / Green) confronta il forecast EAC con il BAC:

| Condizione | Stato |
|---|---|
| EAC ≤ BAC × 1.05 | 🟢 IN_LINEA |
| EAC ≤ BAC × 1.15 | 🟡 A_RISCHIO |
| EAC > BAC × 1.15 | 🔴 FUORI_BUDGET |

**Esempio:** BAC = £64.600
- EAC £67.000 → 103.7% → 🟢 IN_LINEA
- EAC £69.800 → 108.0% → 🟡 A_RISCHIO
- EAC £75.000 → 116.0% → 🔴 FUORI_BUDGET

Il RAG viene ricalcolato ogni volta che viene salvato uno snapshot di avanzamento.

### EAC (Estimated at Completion): cosa è e come si calcola

L'**EAC** è la previsione del costo totale finale del progetto, aggiornata in base all'avanzamento reale.

Il sistema calcola l'EAC come **media** tra due metodi:
1. **Metodo time-based:** stima il costo finale proiettando il burn rate storico sui giorni rimanenti
2. **Metodo cost-based:** stima il costo finale in base alla percentuale di completamento

`EAC = (stima_time_based + stima_cost_based) / 2`

**Esempio:** Con £36.200 spesi in 58 giorni su 141 totali:
- Il burn rate storico è £624/gg
- Metodo time-based: £36.200 + (£624 × 83 giorni rimanenti) = £87.992
- Metodo cost-based: se il 41% dei giorni è completato, l'EAC è £36.200 / 0.41 = £88.293
- EAC medio ≈ £69.800 (come mostrato nel mock di RXI Platform — il calcolo tiene conto di ulteriori fattori nel modello reale)

💡 **Suggerimento:** L'EAC è una stima. Un EAC alto nelle prime settimane di progetto (quando la percentuale di completamento è bassa) non è necessariamente allarmante — la previsione si stabilizza man mano che avanza il lavoro.

### Giorni lavorativi: esclusione weekend e festività italiane

Il sistema conta solo i giorni lavorativi reali:
- Esclude sabati e domeniche
- Esclude le festività nazionali italiane (Capodanno, Epifania, Pasquetta, 25 Aprile, 1 Maggio, 2 Giugno, Ferragosto, 1 Novembre, Immacolata, Natale, Santo Stefano)

Il database include le festività pre-caricate per gli anni 2025–2027.

**Impatto pratico:** Una fase dal 30 aprile al 2 maggio 2026 conta solo 1 giorno lavorativo (1 maggio escluso, 30 aprile e 2 maggio inclusi).

### FTE (Full Time Equivalent): come usarlo

`FTE = 1.0` significa che la risorsa è dedicata al 100% al progetto per quella settimana. Valori tipici in uso:

| FTE | Utilizzo giornaliero |
|---|---|
| `1.0` | 8 ore/giorno — full time |
| `0.8` | 6,4 ore/giorno — es. sviluppatore in sprint attivo |
| `0.5` | 4 ore/giorno — es. PM part-time sul progetto |
| `0.3` | 2,4 ore/giorno — es. supervisore/sponsor |
| `0.2` | 1,6 ore/giorno — es. consulente saltuario |

Il costo settimanale è: `FTE × Day Rate × Giorni lavorativi della settimana`

**Esempio:** Vishal Patel (£600/gg), FTE `0.8`, settimana con 5 giorni lavorativi:
`0.8 × £600 × 5 = £2.400`

---

## 11. Flussi Passo-Passo (How-To)

### Come avviare un nuovo progetto dalla A alla Z

1. **Crea il progetto** — Il progetto viene creato dall'amministratore (o inserito direttamente nel database). Contatta il tuo DM o amministratore per la creazione iniziale.

2. **Configura le fasi** — Vai in **Pianificazione → Fasi & Date**:
   - Inserisci le date di inizio e fine per ogni fase.
   - Eventualmente rinomina le fasi cliccando inline sul nome.
   - Imposta la contingenza % per le fasi che la richiedono.
   - Clicca **Salva**.

3. **Alloca le risorse** — Vai nel tab **Risorse & Budget**:
   - Per ogni fase, clicca **＋ Aggiungi risorsa** e seleziona la risorsa dal registro.
   - Per ogni settimana, inserisci il valore FTE nella cella corrispondente.
   - Controlla che non ci siano semafori 🔴 (sovrallocazione).
   - Clicca **Salva fase** per ogni fase.

4. **Verifica il budget** — Torna nel tab **Fasi & Date**: ora il campo **Budget £** mostra il valore calcolato per ogni fase. Verifica che il totale sia in linea con il budget approvato.

5. **Blocca la baseline** — Quando il budget è approvato e le allocazioni sono definitive, clicca **🔒 Blocca Baseline** e conferma. Da questo momento il BAC è fisso.

6. **Aggiungi il piano Gantt** — Vai in **Gantt → Vista Completa**:
   - Per ogni fase, aggiungi i task principali con date e responsabili.
   - Aggiungi le milestone chiave con le date pianificate.

7. **Inizia a registrare l'avanzamento** — Ogni settimana (o ogni mese), vai in **Avanzamento** e inserisci lo snapshot con costi, ore e giorni aggiornati.

---

### Come registrare l'avanzamento settimanale

1. Apri il progetto → menu **Avanzamento**.
2. Nel modulo **Inserisci Snapshot Manuale**:
   - Imposta la **Data di riferimento** (es. l'ultimo venerdì della settimana).
   - Inserisci il **Costo speso £** cumulativo aggiornato (non incrementale — il totale da inizio progetto).
   - Inserisci le **Ore spese** cumulative.
   - Verifica i **GG lavorativi usati** (compilati automaticamente) e correggi se necessario.
3. Clicca **Salva Snapshot** e conferma nella finestra di dialogo.
4. ✅ Torna alla **Dashboard** per verificare che i KPI siano aggiornati.

💡 **Suggerimento:** I valori di costo e ore sono **cumulativi**, non settimanali. Se a fine marzo hai speso £21.800 totali e a fine aprile hai speso £36.200 totali, inserisci `36200` nello snapshot di aprile.

---

### Come leggere se un progetto è a rischio budget

1. Apri la **Dashboard** del progetto.
2. Osserva il **banner RAG** in cima: verde = in linea, giallo = a rischio, rosso = fuori budget.
3. Controlla la scheda KPI **Previsione (EAC)** e **Scostamento**:
   - Scostamento positivo (rosso) = la previsione supera il budget.
4. Controlla la tabella **Forecast per Fase (EAC)**: identifica quali fasi contribuiscono maggiormente allo sforamento (colonna Variance rossa).
5. Confronta con la sezione **Avanzamento** sul lato destro: verifica quando è stato inserito l'ultimo snapshot. Un snapshot vecchio significa che il forecast potrebbe non essere aggiornato.

**Esempio:** RXI Platform — banner giallo, EAC £69.800, Scostamento +£5.200. Aprendo la tabella Forecast per Fase si vede che la fase Build ha una variance positiva. Il PM deve decidere se ridurre le risorse nelle settimane rimanenti o alzare formalmente il budget.

---

### Come capire quale risorsa è sovrallocata

1. Vai in **Registro Risorse** (menu principale).
2. Se c'è sovrallocazione, in cima alla pagina appare il riquadro rosso con i nomi delle risorse e le settimane problematiche.
3. Trova la riga della risorsa nella tabella e guarda le celle con icona 🔴.
4. Espandi la riga per vedere i progetti che contribuiscono all'allocazione in quella settimana.
5. Decidi su quale progetto ridurre l'FTE e vai nella **Pianificazione** di quel progetto → **Risorse & Budget** → riduci il valore nella cella incriminata → **Salva fase**.

**Esempio:** Vishal Patel mostra 🔴 nella settimana del 01/06. Il dettaglio mostra RXI Platform 80% + PChallenges Portal 50% = 130%. Bisogna ridurre l'allocazione su uno dei due progetti.

---

### Come aggiornare le date di una fase senza toccare la baseline

⚠️ **Se la baseline è già bloccata, le date non possono essere modificate.** La baseline è il piano approvato e fisso.

Se la baseline **non è ancora bloccata:**
1. Vai in **Pianificazione → Fasi & Date**.
2. Modifica le date desiderate.
3. Clicca **Salva**.

Il budget della fase si ricalcola automaticamente in base alle allocazioni esistenti (le celle FTE rimangono invariate, ma il numero di settimane potrebbe cambiare se sposti le date).

Se la baseline è bloccata e hai necessità di aggiornare le date, è necessario un intervento dell'amministratore per sbloccarla o per gestire un processo di re-baseline formale.

---

## 12. FAQ e Risoluzione Problemi

---

**"Non vedo i miei progetti nella lista"**

- **Causa 1 — Filtro attivo:** Il filtro stato in alto a destra nella pagina Portfolio potrebbe essere impostato su "Attivo", "In pausa" o "Chiuso". I tuoi progetti potrebbero avere uno stato diverso.
  - **Soluzione:** Clicca il filtro **Tutti** per rimuovere il filtro di stato.

- **Causa 2 — Ruolo PM:** Se hai il ruolo PM, vedi solo i progetti a te assegnati. Se ti aspetti di vedere un progetto di un collega, non è accessibile dal tuo account.
  - **Soluzione:** Contatta il DM o l'amministratore per verificare quale PM è assegnato al progetto.

- **Causa 3 — Nessun progetto assegnato:** Il tuo account non ha progetti assegnati.
  - **Soluzione:** Chiedi all'amministratore di creare o assegnare un progetto al tuo account.

---

**"Il budget risulta 0 nella Dashboard"**

- **Causa:** Nessuna allocazione risorsa è stata inserita nel tab **Risorse & Budget** della Pianificazione. Il budget di ogni fase è la somma dei costi delle allocazioni — senza allocazioni, il budget è zero.
  - **Soluzione:** Vai in **Pianificazione → Risorse & Budget**, aggiungi le risorse e inserisci i valori FTE per ogni settimana, poi clicca **Salva fase** per ogni fase.

---

**"Non riesco a modificare la baseline"**

- **Causa:** La baseline è stata bloccata. Una volta bloccata è irreversibile — i campi appaiono in sola lettura e viene mostrato il messaggio *"🔒 Bloccata il [data]. I dati sono in sola lettura."*
  - **Soluzione:** Non è possibile sbloccare la baseline autonomamente. Contatta l'amministratore di sistema se hai necessità di una modifica eccezionale (es. cambio di scope formale approvato dal cliente).

---

**"Vedo 'Scostamento sopra budget' ma i lavori sono nella norma"**

- **Causa:** L'EAC (previsione a completamento) dipende dall'algoritmo di forecast che proietta il costo finale basandosi sul ritmo attuale di spesa. Nelle fasi iniziali del progetto (bassa percentuale di completamento), l'EAC tende a sovrastimare perché proietta un burn rate che potrebbe non essere rappresentativo dell'intero progetto.
  - **Soluzione 1:** Inserisci snapshot più frequenti (settimanali invece che mensili) per dare al sistema dati più accurati.
  - **Soluzione 2:** Verifica la data dell'ultimo snapshot — uno snapshot vecchio usa dati non aggiornati.
  - **Soluzione 3:** Confronta il burn rate attuale (KPI **Costo/gg**) con quello pianificato nella tabella **Budget per Fase** (colonna Burn Rate/gg). Se il burn rate attuale è significativamente diverso da quello pianificato, il forecast riflette una situazione reale.

---

**"L'allocazione non si salva"**

- **Causa:** Una o più risorse superano il limite di `FTE = 1.0` in almeno una settimana. Il server restituisce un errore 409 (violazione del cap FTE cross-project).
  - **Soluzione:** Controlla le celle con l'icona 🔴 nella matrice di allocazione. Riduci il valore FTE nelle celle rosse finché l'icona diventa 🟡 o ✅, poi riprova a cliccare **Salva fase**.

💡 **Ricorda:** Il semaforo 🔴 considera la somma FTE della risorsa su tutti i progetti, non solo quello corrente. Una cella con `FTE = 0.5` in questo progetto può comunque scatenare la 🔴 se la risorsa ha già `FTE = 0.6` su un altro progetto nella stessa settimana.

---

**"La sync Keyedin non funziona"**

- **Causa:** L'integrazione con Keyedin è in fase di test (stub attivo). Il servizio potrebbe non essere ancora configurato nell'ambiente in uso.
  - **Soluzione:** Usa l'inserimento manuale nella stessa pagina Avanzamento — è sempre disponibile e produce gli stessi effetti sui KPI. L'inserimento manuale è il metodo principale consigliato fino a quando l'integrazione Keyedin sarà completamente operativa.

---

**"Non riesco a eliminare una risorsa"**

- **Causa:** La risorsa è ancora allocata su almeno una fase di almeno un progetto. Il sistema non permette la cancellazione di risorse con allocazioni attive.
  - **Soluzione:** Prima di eliminare la risorsa, rimuovila da tutte le fasi di tutti i progetti:
    1. Vai in **Pianificazione → Risorse & Budget** per ogni progetto che usa quella risorsa.
    2. Per ogni fase, clicca il pulsante ✕ sulla riga della risorsa.
    3. Clicca **Salva fase**.
    4. Una volta rimossa da tutti i progetti, contatta l'amministratore per l'eliminazione definitiva dal registro.

---

**"Il Gantt sembra incompleto"**

- **Causa:** Non sono stati aggiunti task nelle fasi. Il Gantt mostra solo ciò che è stato inserito — le fasi appaiono come barre vuote se non contengono task.
  - **Soluzione:** Vai in **Gantt → Vista Completa**, espandi le fasi e aggiungi i task cliccando **＋ Aggiungi task** per ogni fase. Aggiungi anche le milestone chiave.

---

**"Non vedo la colonna Forecast EAC nella Dashboard"**

- **Causa:** La tabella **Forecast per Fase (EAC)** appare solo quando è presente almeno uno snapshot di avanzamento. Senza snapshot, il sistema non ha dati sufficienti per calcolare l'EAC per fase.
  - **Soluzione:** Vai in **Avanzamento** e inserisci il primo snapshot con i valori attuali di costo, ore e giorni. Dopo il salvataggio, torna alla Dashboard — la tabella Forecast per Fase apparirà.

---

*Fine della guida — versione giugno 2026*
