# Project Forecast App

Questo progetto è un'applicazione web per la pianificazione e il monitoraggio dei budget dei progetti, delle allocazioni delle risorse, dei diagrammi di Gantt e delle milestone. Replica e migliora le funzionalità dell'originario tool in Excel `Project_Forecast_v16.xlsx`.

La struttura del progetto è un **monorepo** gestito con **Nx** e **pnpm workspaces**, suddiviso in:
- **Frontend**: React 18 (Vite, TypeScript, TailwindCSS) in `/frontend`
- **Backend**: Node.js + Express (TypeScript, PostgreSQL) in `/backend`

---

## Prerequisiti

Prima di iniziare, assicurati di avere installato sul tuo computer:
- **Node.js** (versione consigliata indicata in `.node-version`, es. v20+)
- **pnpm** (installato globalmente tramite `npm install -g pnpm`)
- **PostgreSQL** (se decidi di utilizzare un database locale esterno a Docker) o **Docker** (se decidi di utilizzare il database preconfigurato)

---

## 1. Installazione delle Dipendenze

Dalla cartella radice (root) del progetto, esegui il comando seguente per installare le dipendenze di tutte le applicazioni nel monorepo:

```bash
pnpm install
```

---

## 2. Configurazione del Database Locale (Senza Docker)

Se preferisci utilizzare un'istanza locale di PostgreSQL sul tuo computer invece di avviare il database tramite il container Docker, segui questi passaggi:

### A. Crea il database locale
Avvia il tuo server PostgreSQL locale e crea un database vuoto. Ad esempio, utilizzando `psql` o un client grafico come pgAdmin / DBeaver:

```sql
CREATE DATABASE project_forecast;
```

### B. Configura le variabili d'ambiente nel Backend
1. Vai nella cartella `backend/`:
   ```bash
   cd backend
   ```
2. Copia il file `.env.example` in un nuovo file chiamato `.env`:
   ```bash
   cp .env.example .env
   ```
3. Apri il file `backend/.env` ed edita la variabile `DATABASE_URL` per farla puntare alla tua istanza PostgreSQL locale.
   
   La stringa di connessione segue questo formato:
   ```env
   DATABASE_URL=postgresql://<utente>:<password>@localhost:<porta>/project_forecast
   ```
   *Esempio con credenziali di default:*
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/project_forecast
   ```

### C. Configura le variabili d'ambiente nel Frontend
1. Vai nella cartella `frontend/`:
   ```bash
   cd ../frontend
   ```
2. Assicurati che esista il file `.env.local` (puoi copiarlo da `.env.local.example` se necessario):
   ```bash
   cp .env.local.example .env.local
   ```
3. Nel file `frontend/.env.local`, imposta la variabile `VITE_USE_MOCK` su `false` se vuoi connetterti al backend reale invece di utilizzare dati simulati (mock):
   ```env
   VITE_API_URL=http://localhost:3000
   VITE_USE_MOCK=false
   ```

---

## 3. Inizializzazione del Database (Migrazioni e Seed)

Una volta configurato il file `.env` con la stringa di connessione al database (locale o Docker), esegui i seguenti comandi dalla **cartella radice (root)** del progetto:

### Esegui le Migrazioni del DB
Crea le tabelle e lo schema nel database:
```bash
pnpm migrate
```

### Esegui il Seed del DB (Opzionale)
Popola il database con dati di test realistici (progetti, fasi, risorse e allocazioni di prova):
```bash
pnpm seed
```

---

## 4. Avvio dell'Applicazione in Modalità Sviluppo

Dopo aver completato l'installazione e l'inizializzazione del database, avvia contemporaneamente il frontend e il backend in modalità di sviluppo eseguendo il seguente comando dalla **cartella radice (root)** del progetto:

```bash
pnpm dev
```

Questo comando sfrutta **Nx** per far partire:
- Il **Backend** all'indirizzo [http://localhost:3000](http://localhost:3000)
- Il **Frontend** all'indirizzo [http://localhost:5173](http://localhost:5173) (o una porta successiva se occupata)

---

## Script Principali della Root

I seguenti script sono disponibili a livello globale nella cartella root:

| Comando | Descrizione |
|:---|:---|
| `pnpm install` | Installa tutte le dipendenze del monorepo |
| `pnpm dev` | Avvia contemporaneamente frontend e backend in modalità di sviluppo |
| `pnpm build` | Compila frontend e backend per la produzione |
| `pnpm test` | Esegue la suite di test in tutto il monorepo |
| `pnpm migrate` | Applica le migrazioni SQL al database configurato |
| `pnpm seed` | Esegue lo script di seeding del database |
| `pnpm db:up` | Avvia il database PostgreSQL predefinito in Docker (in background) |
| `pnpm db:down` | Ferma e rimuove il container Docker del database |
| `pnpm db:logs` | Mostra i log del database in esecuzione su Docker |

---

## Note sull'Architettura e Autenticazione (POC)

1. **Credenziali Supabase**: L'autenticazione reale del backend poggia su Supabase Auth. Se nel file `backend/.env` non configuri `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, riceverai un warning nei log all'avvio. Per testare il frontend senza configurare Supabase, puoi impostare `VITE_USE_MOCK=true` nel file `frontend/.env.local`, consentendoti di navigare l'interfaccia senza blocchi.
2. **Festività pre-caricate**: Le migrazioni pre-popolano le festività nazionali italiane (IT) per il calcolo dei giorni lavorativi effettivi (`NETWORKDAYS`) tra il 2026 e il 2028.
