# Project Forecast App — Prompt di Sviluppo per Antigravity

Usare in sequenza. Ogni prompt è autosufficiente — Antigravity rilegge AGENTS.md a ogni sessione.

## ✅ Step 1 — Backend foundation _(COMPLETATO)_

## ✅ Step 2 — Logica computazionale _(COMPLETATO)_

---

## ⏭️ Step 3 — Resource Registry _(PROSSIMO)_

```
Leggi l'AGENTS.md. Crea il Resource Registry.

Backend:
- Migrations per le tabelle Resource e AllocationEntry (campi computed: working_days, monthly_cost)
- CRUD endpoints per /api/resources
- Endpoint bulk upsert PUT /api/projects/:id/allocation per fase
- Endpoint GET /api/projects/:id/allocation/warnings che usa la FTE validation già implementata

Vincolo chiave: una risorsa esiste una volta sola nel registro centrale e può essere allocata su più progetti e fasi con FTE diversi per mese.
```

---

## Step 4 — Ongoing + Keyedin stub

```
Leggi l'AGENTS.md. Implementa il modulo Ongoing.

- Crea la tabella OngoingSnapshot con migrations
- Implementa l'interfaccia astratta OngoingDataProvider con due provider concreti:
    - ManualFallbackProvider (sempre attivo)
    - KeyedinApiProvider (stub vuoto, attivabile in futuro)
- Endpoints: GET e POST /api/projects/:id/ongoing, GET /api/projects/:id/ongoing/history, POST /api/projects/:id/ongoing/sync
- Implementa la formula Revised Forecast:
    if hours_spent == 0:
      forecast = cost_spent + daily_burn_rate × days_remaining
    else:
      forecast = avg(
        cost_spent + daily_burn_rate × days_remaining,
        cost_spent + avg_cost_per_hour × hours_remaining
      )
- Implementa il calcolo RAG status:
    ✅ IN LINEA    → forecast ≤ baseline × 1.05
    ⚠️ A RISCHIO   → forecast tra ×1.05 e ×1.15
    🔴 FUORI BUDGET → forecast > ×1.15
```

---

## Step 5 — Frontend base

```
Leggi l'AGENTS.md. Crea il frontend React.

Vincoli:
- Nessuna libreria UI esterna (no Material UI, no Ant Design, no Chakra) — solo Tailwind CSS
- Un file per componente, componenti piccoli e separati
- Backend base URL configurabile via variabile d'ambiente VITE_API_URL
- Aggiungi un file src/mocks/mockData.ts con dati fittizi realistici (1 progetto, 3 risorse, 5 fasi). Usa questi dati solo quando VITE_USE_MOCK=true nel file .env.local — in produzione usa sempre le API reali. Nessun mock hardcoded nei componenti.

Pagine da implementare:
- /login: form email + password, JWT salvato in localStorage, redirect a /projects dopo login
- /projects: portfolio view con lista progetti, badge RAG colorato (verde/giallo/rosso), % budget, fase corrente — PM vede solo i propri, DM vede tutti
- /projects/:id/dashboard:
    - Banner RAG
    - KPI cards: Speso / Budget / Previsione / Costo/gg / Scostamento / Giorni
    - Barra % budget consumato
    - Tabella Budget per Fase: Fase | Periodo | GG | Ore | Burn Rate/gg | Budget £ | % su totale
    - Milestone tracker ultime 5 con data pianificata vs effettiva
    - Info ultimo sync Ongoing

Fermati qui. Non implementare routing verso altre pagine ancora. Aspetta la mia conferma prima di procedere al prossimo step.
```

---

## Step 6 — Baseline + Allocation matrix

```
Leggi l'AGENTS.md. Implementa le pagine /projects/:id/baseline, /projects/:id/allocation e /resources.

BASELINE:
- Tabella con le 5 fasi in ordine fisso: Feasibility → Planning & Design → Build → Deployment → Closure
- Input data inizio/fine per ciascuna fase (evidenziati in blu)
- Colonne calcolate in tempo reale: GG lavorativi (NETWORKDAYS), Ore (GG×8), Budget (da AllocationEntry)
- Input contingenza % applicata solo alla fase Feasibility
- Riga totali e BASELINE TOTAL FORECAST in fondo
- Lock button irreversibile con modal di conferma esplicita — una volta bloccata la baseline è read-only

ALLOCATION:
- Matrice per fase → risorsa → mese
- FTE input per cella (0.0–1.0)
- Semaforo per cella: 🔴 se FTE cross-project > 1.0 (warning bloccante), 🟡 se FTE < 0.8 (sottoutilizzo), ✅ se 0.8–1.0
- Totali per fase: FTE medio, Burn Rate/gg, Monthly Cost, Phase Budget
- Possibilità di aggiungere/rimuovere risorse dal registro centrale

RESOURCE REGISTRY (/resources):
- Il registro NON è una tabella separata — è una view aggregata di tutte le AllocationEntry nel DB
- Quando un PM salva un'AllocationEntry (es. Giuseppe 0.5 FTE su Pippo/maggio), il registro si aggiorna automaticamente senza nessun step manuale aggiuntivo
- Struttura: tabella risorse × mesi, con per ogni risorsa il breakdown FTE per progetto e riga TOTALE aggregata
- Esempio:
    Giuseppe        | mag-26        | giu-26
      Progetto Pippo  | 0.5 FTE       | 0.5 FTE
      Progetto Pluto  | 0.5 FTE       | —
      TOTALE          | 1.0 FTE ✅    | 0.5 FTE 🟡
- Filtri:
    - Per risorsa (es. mostra solo Giuseppe)
    - Per progetto (es. mostra solo le risorse di Pippo)
    - Per intervallo temporale (date picker da/a)
    - Per fase (es. mostra solo allocazioni durante il Build)
- Semaforo aggregato per riga TOTALE: ⚪ 0% | 🟡 1–79% | ✅ 80–100% | 🔴 >100%
- Alert visibile se una risorsa supera 1.0 FTE in qualsiasi mese
```

---

## Step 7 — Gantt

```
Leggi l'AGENTS.md. Implementa la pagina /projects/:id/gantt con 3 viste selezionabili:

1. Vista Fasi (default) — 5 righe aggregate, una per fase, barre proporzionali alle date
2. Vista Completa — fasi espandibili/collassabili con task interni, scrollabile
3. Vista Milestone — solo righe milestone con data pianificata vs effettiva

Regole di rendering:
- Colonne settimanali a partire da baseline start_date
- Colori barre: verde=completed, blu=in_progress, grigio=not_started, arancione=milestone ◆
- Linea verticale "oggi"
- Campo "Data Effettiva" editabile solo sulle righe milestone
- Click su fase: espande/collassa i task interni

Status auto dei task:
- completed → end_date < oggi oppure actual_date impostata
- in_progress → start_date ≤ oggi ≤ end_date
- not_started → start_date > oggi
```

---

## Step 8 — Share link

```
Leggi l'AGENTS.md. Implementa il sistema share link per accesso stakeholder esterno.

Backend:
- POST /api/projects/:id/share/generate → crea UUID token con data scadenza
- DELETE /api/projects/:id/share → revoca token
- GET /api/projects/:id/share/accesses → storico accessi con ip_hash e user_agent
- GET /api/share/:token/dashboard → read-only, senza valori monetari £
- GET /api/share/:token/gantt → read-only, solo vista Fasi

Frontend:
- Pagina /projects/:id/settings: genera link, mostra data scadenza, pulsante revoca, storico accessi
- Pagina pubblica /share/:token: Dashboard senza costi + Gantt vista Fasi
- Nessun login richiesto per /share/:token
```

---

## Step 9 — DM Views

```
Leggi l'AGENTS.md. Implementa le viste Delivery Manager (ruolo dm).

/dm/portfolio — Swimlane:
- Progetti in riga, mesi in colonna, celle colorate per RAG
- KPI aggregati in testa: budget totale portfolio, % progetti a rischio, % fuori budget

/dm/resources — Resource Registry:
- Tabella risorse × mesi
- Per ogni risorsa: breakdown % FTE per progetto + riga TOTALE con semaforo
  ⚪ 0% non allocato | 🟡 1–79% sottoutilizzo | ✅ 80–100% ottimale | 🔴 >100% sovrallocazione
- Alert panel in evidenza con tutte le sovrallocazioni attive
- Filtri: per mese, per progetto, per risorsa
- Export CSV

/dm/gantt — Gantt aggregato:
- Tutti i progetti in vista Fasi (no task detail)
- Evidenzia overlap di risorse critiche tra progetti diversi
```

---

## Step 10 — Seeding dati reali

```
Leggi l'AGENTS.md. Crea uno script di seeding che popola il database con i dati del progetto corrente.

Risorse da inserire nel registro centrale:
- Giuseppe (day rate da definire)
- Vishal (day rate da definire)
- Vivekananda (day rate da definire)

Progetto di esempio:
- Nome: [nome progetto corrente]
- 5 fasi popolate con date realistiche a partire da oggi
- AllocationEntry per i mesi correnti con FTE reali
- Almeno 3 GanttTask per fase e 1 milestone per fase

Lo script deve essere eseguibile con: npm run seed
Deve essere idempotente — rieseguibile senza creare duplicati.
```

---

## Note operative

- **Node non disponibile nell'ambiente Antigravity** — dopo ogni scaffolding, esegui `npm install` localmente prima del prossimo step.
- **Ogni prompt è autosufficiente** — Antigravity rilegge AGENTS.md a ogni sessione, il contesto è sempre presente.
- **Non saltare step** — ogni fase dipende da quella precedente, specialmente la logica computazionale (Step 2) che è usata ovunque.
- **Se Antigravity va troppo avanti** — aggiungi al prompt: "Non implementare nulla oltre a quanto richiesto in questo step."
