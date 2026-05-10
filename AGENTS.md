# Project Forecast App — Design Document

## Overview

Web application che replica e supera le funzionalità del tool `Project_Forecast_v16.xlsx`. Gestisce budget, allocazione risorse, milestone e pianificazione Gantt per più progetti e più PM — con pull automatico da Keyedin per i dati di avanzamento.

**Target primario:** Project Manager che gestisce 1–5 progetti simultanei.  
**Target secondario:** Delivery Manager con visibilità aggregata su tutti i progetti e tutte le risorse.  
**Stakeholder esterni:** accesso read-only via link condiviso senza account.

**Fase attuale:** POC in locale (no deploy, no Docker).  
**Obiettivo:** proposta interna all'azienda se il POC convince.

---

## Tech Stack

- **Frontend:** React 18+ (Vite, TypeScript)
- **Backend:** Node.js + Express (REST API, TypeScript)
- **Database:** PostgreSQL
- **Auth:** JWT — email/password per utenti interni (PM e DM)
- **External Integration:** Keyedin API (opzionale — fallback manuale sempre disponibile)
- **Deployment POC:** locale (`npm install` + `npm start`), nessun Docker

---

## Ruoli Utente

| Ruolo | Descrizione |
|---|---|
| **Project Manager (PM)** | Crea e gestisce i propri progetti. Vede risorse e day rate. Non vede i progetti altrui. |
| **Delivery Manager (DM)** | Ruolo separato. Accesso read-only a tutti i progetti di tutti i PM. Portfolio view, resource registry, allocazione aggregata cross-project. Non modifica nulla. |
| **Stakeholder (link)** | Nessun account. Accede via link condiviso con token. Vede Dashboard e Gantt senza dati sensibili. |

> I day rate delle risorse sono visibili a tutti i PM autenticati — non sono dati sensibili internamente.

---

## Fasi di Progetto

Ogni progetto è articolato in **5 fasi sequenziali**, nell'ordine:

1. **Feasibility**
2. **Planning & Design**
3. **Build**
4. **Deployment**
5. **Closure**

Le fasi si susseguono sempre in quest'ordine. Possono esistere **gap** tra la fine di una fase e l'inizio della successiva (es. attesa approvazione budget). Le fasi non si sovrappongono. Ogni fase ha le proprie date, working days, risorse allocate con FTE specifico per fase, budget derivato e milestone.

---

## Data Model

### User
```
id, name, email, password_hash, role (pm | dm), created_at
```

### Project
```
id, name, pm_id (FK User), currency (default GBP),
status (active | closed | archived),
share_token (UUID), share_token_expires_at,
country_code (default IT),
created_at, updated_at
```

### ProjectPhase
```
id, project_id,
phase_type (feasibility | planning_design | build | deployment | closure),
order (1–5, immutabile),
planned_start, planned_end,
actual_start, actual_end,
working_days (computed: NETWORKDAYS escludendo festivi),
planned_hours (computed: working_days × 8),
budget (computed: SUM AllocationEntry.monthly_cost per questa fase),
status (auto: not_started | in_progress | completed)
```

### Baseline
```
project_id,
locked_at (timestamp — una volta impostato, read-only),
total_working_days (computed),
total_planned_hours (computed),
total_budget (computed: SUM budget di tutte le fasi),
contingency_pct (applicato solo a Feasibility, default 0),
total_forecast (computed: total_budget + contingency su Feasibility)
```

### Resource — registro centrale condiviso tra tutti i progetti
```
id, name, role, day_rate (decimal), created_at
```
> Una risorsa esiste una volta sola. Può essere allocata su più progetti e su più fasi con FTE diversi.

### AllocationEntry
```
id, resource_id, project_id, phase_id,
month (date — primo giorno del mese),
fte (0.0–1.0),
working_days (computed: giorni lavorativi del mese che cadono nella fase),
monthly_cost (computed: day_rate × fte × working_days)
```

**Vincolo FTE cross-project:** somma FTE di una risorsa su tutti i progetti in un mese non può superare 1.0. Il backend valida e restituisce warning con dettaglio (progetto, mese, sforamento).

### OngoingSnapshot
```
id, project_id, reporting_date,
hours_spent_to_date, cost_spent_to_date,
working_days_used, working_days_remaining (computed),
source (manual | keyedin_api),
created_at
```

### GanttTask
```
id, project_id, phase_id,
name, owner, start_date, end_date,
working_days (computed),
is_milestone (boolean),
actual_date (nullable — solo milestone: data effettiva completamento),
status (auto: not_started | in_progress | completed)
```

### PublicHoliday
```
id, country_code (default IT), date, name, year
```
Pre-seeded: festività italiane 2026–2028.

### ShareLinkAccess
```
id, project_id, accessed_at, user_agent, ip_hash
```

---

## Logica Computazionale (backend)

### NETWORKDAYS
Conta giorni lavorativi tra due date escludendo weekend e `PublicHoliday` per il paese del progetto.

### Budget di fase
```
SUM(AllocationEntry.monthly_cost) WHERE phase_id = phase.id
```
Ogni `AllocationEntry` è legato alla fase oltre che al mese — il calcolo è diretto e non ambiguo anche quando una risorsa lavora su fasi diverse nello stesso periodo.

### Revised Forecast
```
if hours_spent == 0:
  forecast = cost_spent + daily_burn_rate × days_remaining
else:
  forecast = avg(
    cost_spent + daily_burn_rate × days_remaining,
    cost_spent + avg_cost_per_hour × hours_remaining
  )
```

### RAG Status
| Stato | Condizione |
|---|---|
| ✅ IN LINEA | forecast ≤ baseline × 1.05 |
| ⚠️ A RISCHIO | forecast tra ×1.05 e ×1.15 |
| 🔴 FUORI BUDGET | forecast > ×1.15 |

### FTE Validation (cross-project, per mese)
| Range | Semaforo | Significato |
|---|---|---|
| 0% | ⚪ | Non allocato |
| 1–79% | 🟡 | Sottoutilizzo |
| 80–100% | ✅ | Utilizzo ottimale |
| >100% | 🔴 | Sovrallocazione — warning bloccante |

### Gantt Task Status (auto)
- `completed` → end_date < today oppure actual_date impostata
- `in_progress` → start_date ≤ today ≤ end_date
- `not_started` → start_date > today

---

## Pagine & Routes

### `/projects`
Portfolio view — PM vede i propri, DM vede tutti. RAG badge, % budget, giorni al termine, fase corrente.

### `/projects/:id/dashboard`
- Banner RAG + KPI cards (Speso / Budget / Previsione / Costo/gg / Scostamento / Giorni)
- Barra % budget consumato
- **Tabella Budget per Fase:** Fase | Periodo | GG | Ore | Burn Rate/gg | Budget £ | % su totale
- Milestone tracker (ultime 5, data pianificata vs effettiva)
- Info ultimo sync Ongoing

### `/projects/:id/baseline`
Setup baseline con le 5 fasi in tabella:

```
Fase              | Inizio      | Fine        | GG  | Ore  | Budget (£)
Feasibility       | [input BLU] | [input BLU] | 12  | 96   | £4,080
Planning & Design | [input BLU] | [input BLU] | 21  | 168  | £8,500
Build             | [input BLU] | [input BLU] | 85  | 680  | £42,500
Deployment        | [input BLU] | [input BLU] | 15  | 120  | £6,800
Closure           | [input BLU] | [input BLU] | 8   | 64   | £2,720
─────────────────────────────────────────────────────────────────────
TOTALE            |             |             | 141 | 1128 | £64,600
Contingenza % (Feasibility only): [input]
BASELINE TOTAL FORECAST: £67,030
```

Lock button — irreversibile, richiede conferma esplicita.

### `/projects/:id/allocation`
Matrice allocazione **per fase → risorsa → mese**:

```
▼ FEASIBILITY  [01/05 → 15/05/26]
    Giuseppe   | mag: 0.5 FTE £1,700 | ...
    Vishal     | mag: 0.2 FTE £680   | ...
    Phase total: Burn Rate £340/gg | Budget £2,380

▼ PLANNING & DESIGN  [16/05 → 30/06/26]
    Giuseppe   | mag: 0.2 | giu: 0.2 | ...
    Vivek      | mag: 0.8 | giu: 0.8 | ...
```

- FTE input per cella (0.0–1.0)
- 🔴 warning se FTE risorsa > 1.0 nel mese (cross-project)
- 🟡 info se FTE < 0.8 (sottoutilizzo)
- Totali per fase: FTE medio, Burn Rate, Monthly Cost, Phase Budget
- Aggiungi/rimuovi risorse dal registro centrale

### `/projects/:id/ongoing`
- Bottone "Sincronizza da Keyedin" con stato ultimo sync
- Form manuale: ore spese, costo speso, giorni usati
- Metriche derivate (read-only): % completamento, costo/ora, burn rate storico

### `/projects/:id/gantt`
Gantt con **fasi collassabili** e **3 viste**:

**Vista Fasi** (default) — 5 righe, barre aggregate per fase. Immediato.  
**Vista Completa** — fasi espanse con task interni. Scrollabile.  
**Vista Milestone** — solo righe `◆` con data pianificata vs effettiva.

```
▼ FEASIBILITY          [══════]
    Task A             [████]
    ◆ Feasibility OK   ◆  15/05 | effettiva: 17/05
▼ PLANNING & DESIGN    [      ══════════]
    Task B                  [████]
    Task C                      [████]
    ◆ Design Sign-off          ◆  30/06
▼ BUILD                [              ══════════════════]
  ...
```

- Colonne settimanali da baseline start_date
- Verde=completed, Blu=in_progress, Grigio=not_started, Arancione=milestone
- Linea verticale "oggi"
- "Data Effettiva" editabile solo sulle righe milestone
- Ogni fase collassa/espande con click

### `/projects/:id/settings`
Config Keyedin, gestione share link (genera, scadenza, revoca, storico accessi).

### `/share/:token`
View stakeholder read-only: Dashboard (no costi £) + Gantt vista Fasi.

---

## Delivery Manager Views

### `/dm/portfolio`
Swimlane: progetti in riga, mesi in colonna, colorata per RAG. KPI aggregati: budget totale, % a rischio, % fuori budget.

### `/dm/resources` — Resource Registry
Il cuore della vista DM. Tabella risorse × mesi con semaforo allocazione:

```
                  mag-26    giu-26    lug-26    ago-26
Giuseppe
  RXI             20%       20%       —         —
  PChallenges     80%       80%       —         —
  TOTALE          100% ✅   100% ✅   0% ⚪     0% ⚪

Vishal
  RXI             50%       50%       50%       —
  PChallenges     20%       20%       20%       —
  TOTALE          70% 🟡    70% 🟡    70% 🟡    0% ⚪

Vivek
  PChallenges     80%       100%      100%      80%
  TOTALE          80% ✅    100% ✅   100% ✅   80% ✅
```

- Filtri: per mese, per progetto, per risorsa
- Alert panel: tutte le sovrallocazioni attive in evidenza
- Export CSV

### `/dm/gantt`
Gantt aggregato tutti i progetti — solo vista Fasi (no task detail). Evidenzia overlap di risorse critiche tra progetti.

---

## Keyedin Integration

Interfaccia astratta con due provider:
```
OngoingDataProvider (interface)
  ├── KeyedinApiProvider     ← reale, attivabile quando API disponibile
  └── ManualFallbackProvider ← sempre disponibile
```
Il POC funziona completamente senza API Keyedin. Aggiungere Keyedin è un task incrementale successivo.

---

## API Endpoints

```
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id

GET    /api/projects/:id/phases
PUT    /api/projects/:id/phases/:pid

GET    /api/projects/:id/baseline
PUT    /api/projects/:id/baseline
POST   /api/projects/:id/baseline/lock

GET    /api/resources
POST   /api/resources
PUT    /api/resources/:rid
DELETE /api/resources/:rid

GET    /api/projects/:id/allocation
PUT    /api/projects/:id/allocation          # bulk upsert per fase
GET    /api/projects/:id/allocation/warnings # FTE violations

GET    /api/projects/:id/ongoing
GET    /api/projects/:id/ongoing/history
POST   /api/projects/:id/ongoing
POST   /api/projects/:id/ongoing/sync

GET    /api/projects/:id/tasks
POST   /api/projects/:id/tasks
PUT    /api/projects/:id/tasks/:tid
DELETE /api/projects/:id/tasks/:tid

GET    /api/projects/:id/dashboard

POST   /api/projects/:id/share/generate
DELETE /api/projects/:id/share
GET    /api/projects/:id/share/accesses

GET    /api/share/:token/dashboard
GET    /api/share/:token/gantt

GET    /api/dm/portfolio
GET    /api/dm/resources
GET    /api/dm/resources/warnings
GET    /api/dm/gantt

GET    /api/holidays?country=IT&year=2026
POST   /api/holidays
PUT    /api/holidays/:id
```

---

## Ordine di Sviluppo Consigliato

1. **Backend foundation** — DB schema con le 5 fasi, migrations, auth JWT, CRUD base
2. **Logica computazionale** — NETWORKDAYS, budget di fase, RAG, FTE validation cross-project
3. **Resource Registry** — CRUD risorse centrale, AllocationEntry per fase
4. **Ongoing + Keyedin stub** — snapshot manuale + provider astratto
5. **Frontend React** — routing, auth, portfolio view, dashboard KPI
6. **Allocation matrix per fase** — UI più complessa
7. **Gantt collassabile** — 3 viste, milestone con data effettiva
8. **Share link** — token, view stakeholder, tracking accessi
9. **DM views** — portfolio swimlane, resource registry con semafori FTE
10. **Seeding dati** — importare progetto corrente dall'Excel come primo record

---

## Out of Scope per il POC

- Docker / deploy remoto
- Export PDF o Excel
- Notifiche email
- Grafico trend forecast nel tempo
- Multi-currency (GBP assunto)
- Festività UK (solo IT per ora)
- Password protection sul share link
