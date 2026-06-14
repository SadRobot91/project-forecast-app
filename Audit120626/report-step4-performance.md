# Report Step 4 — Performance Audit (Frontend + Backend)

> Audit `project-forecast-app` — analisi statica + build di produzione reale del frontend.
> Data: 2026-06-12 · Nessuna modifica al codice (la build genera solo `dist/`, gitignored).

---

## PARTE A — Frontend

### A1. Bundle analysis (misurato con `vite build`)

```
dist/index.html                    0.77 kB │ gzip:   0.42 kB
dist/assets/index-DVdU9r7v.css    27.98 kB │ gzip:   5.60 kB
dist/assets/index-DaA_lV6n.js    508.39 kB │ gzip: 135.38 kB   ← chunk unico
(!) Some chunks are larger than 500 kB after minification.
```

| Sev | Rilievo | Dettaglio | Fix |
|---|---|---|---|
| 🟡 | **Chunk JS unico da 508 kB** (135 kB gzip) | Tutta l'app — 8 pagine, Supabase client, router — viaggia in un solo file. Vite stesso emette il warning. Componenti principali stimati: `react-dom` (~130 kB), `@supabase/supabase-js` (~110 kB), `react-router-dom` (~60 kB), codice app (~200 kB). | Due interventi complementari: ① `React.lazy` per pagina (cross-ref Step 3 §5.3); ② `build.rollupOptions.output.manualChunks` per separare `vendor` (react/router) e `supabase` — il vendor chunk resta in cache del browser tra i deploy. |
| 🟢 | CSS 28 kB / 5.6 gzip | Sano: Tailwind con purge via `content` funziona correttamente. | — |
| 🟢 | Nessun asset pesante | Niente immagini/icone raster; SVG inline. Font Inter da Google Fonts: `<link>` render-blocking in `index.html:9` con `display=swap` — accettabile, self-hosting solo in hardening. | — |
| 🟢 | Pagine morte nel grafo | `Allocation/Baseline/Ongoing.tsx` (Step 1 §4.4) **non** finiscono nel bundle (nessun import) — il costo è solo in `tsc`. Verificato: 107 moduli trasformati. | Rimuoverle comunque. |

### A2. Rendering performance

| Sev | Dove | Problema | Fix |
|---|---|---|---|
| 🔴 | `Pianificazione.tsx:329-528` + `FTECell.tsx` | Già dettagliato in Step 3 §3.1, qui la quantificazione: con 5 risorse × 20 settimane, **ogni keystroke** in una cella FTE ri-renderizza ~100 input controllati; `getCell` e `getCrossProjectTotal` fanno `cells.find()` lineare per cella → ~10.000 confronti per battuta, più la riconciliazione DOM di tutta la tabella. Su matrici realistiche (10 risorse × 26 settimane) l'input inizia a laggare sui portatili aziendali. | `React.memo(FTECell)` + indicizzare `cells` in `Map<resourceId:week, cell>` con `useMemo` + callback stabile per riga. |
| 🟡 | `Avanzamento.tsx:64-85, 313-317` | Doppio fetch per cambio fase (Step 3 §3.2): 4 richieste HTTP dove ne bastano 2. | Rimuovere la chiamata manuale `load(val)`. |
| 🟡 | `Pianificazione.tsx:596-599` | `handleAllocationSaved` → `loadAll()` + `loadCrossTotals()`: il salvataggio di **una** fase rifetcha baseline completa + intera matrice allocazioni + registro risorse globale (3 endpoint, di cui uno cross-project). Con N fasi aperte, il PUT di ognuna costa 3 GET pesanti. | Far restituire al PUT la fase aggiornata e aggiornare solo quella; il registro cross-project si può rifetchare in differita. |
| 🟢 | JSX in generale | Key presenti e corrette ovunque (verificato su tutte le liste); inline arrow/object creation pervasivi ma irrilevanti finché non si introduce `memo` — a quel punto vanno stabilizzati nei punti caldi. | — |
| 🟢 | `Gantt.tsx:289-300` | `WeekGrid` renderizza un div per settimana **per riga** (N righe × M settimane div assoluti). Con 5 fasi × 25 settimane = 125 div solo di griglia; in Vista Completa con 30 task → 750+. Funziona, ma è il primo candidato se il Gantt rallenta. | Griglia disegnata una volta con CSS `repeating-linear-gradient` sul contenitore. |

### A3. Code splitting

Nessuno (Step 3 §5.3). Aggravante emersa dalla build: il chunk unico **supera la soglia di warning di Vite**, quindi il problema è già misurabile, non teorico. Login → primo paint utile scarica anche Gantt, Settings e il client Supabase per intero.

### A4. Vite config

`vite.config.ts` è di fatto vuoto (solo plugin react). Opportunità concrete:

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor:   ['react', 'react-dom', 'react-router-dom'],
        supabase: ['@supabase/supabase-js'],
      },
    },
  },
},
```
- `optimizeDeps`: non necessario oggi (dipendenze poche e standard).
- Manca `server.proxy` per `/api` → il dev usa CORS aperto sul backend invece di same-origin proxy (cross-ref Step 5). Un proxy dev eliminerebbe la necessità di CORS in locale.

---

## PARTE B — Backend

### B1. Route handler Express

| Sev | Dove | Problema | Fix |
|---|---|---|---|
| 🔴 | `baseline.ts:172-211, 233-264` | **Transazioni rotte**: `await query('BEGIN')` / `COMMIT` / `ROLLBACK` passano da `pool.query`, che acquisisce **una connessione diversa a ogni chiamata**. Il `BEGIN` apre una transazione su un client che torna subito nel pool (restando *idle-in-transaction*), gli `UPDATE` successivi girano su altri client **fuori transazione**, e il `COMMIT` atterra dove capita. Conseguenze: (a) il PUT baseline non è atomico — un errore a metà lascia metà fasi aggiornate nonostante il "ROLLBACK"; (b) connessioni avvelenate nel pool. Il progetto ha già `withTransaction` (`db/index.ts:14`) usato correttamente in `allocations.ts:171` e `resources.ts:64` — baseline.ts è rimasto al pattern vecchio. | Migrare i due blocchi a `withTransaction`. ~20 righe. |
| 🔴 | `middleware/requireAuth.ts:5-41` | Middleware `async` **senza try/catch**: se `supabase.auth.getUser()` o `query()` lanciano (rete giù, DB giù), Express 4 non cattura gli errori async → unhandled rejection e **richiesta appesa fino al timeout del client**. Tutti i route handler hanno il try/catch; l'unico middleware che gira su ogni richiesta no. | Wrappare il corpo in try/catch → 500. |
| 🟡 | `requireAuth.ts:21-29` | **Costo per-request**: ogni chiamata API fa un round-trip HTTP a Supabase (`auth.getUser`, ~100-300 ms) + una query `User`. Ogni interazione utente paga questa tassa; in serverless si somma al cold start. | Verificare il JWT **localmente** (firma + exp con `jose`/JWKS di Supabase) e cachare il mapping `supabase_uid → user` (TTL breve o per-istanza). Da fare insieme allo Step H di NEXT_STEPS. |
| 🟡 | `projects.ts:14-69` (GET /api/projects) | 6 sub-query correlate per riga progetto + in JS un **loop giorno-per-giorno** sui weekend (`:87-93`) che ignora le festività — diverge da `calculateNetworkDays` usato altrove (la card "gg al termine" può differire di 1-2 gg dalla Dashboard). Inoltre il `LEFT JOIN` su fasi `in_progress` (`:64`) **duplica la riga progetto** se due fasi sono contemporaneamente in corso (il GROUP BY include le colonne di `ph`). | Riscrivere con `LEFT JOIN LATERAL` o CTE aggregate (1 passata); riusare `calculateNetworkDays` con le festività; `LIMIT 1`/`DISTINCT ON` sulla fase corrente. |
| 🟢 | Tutti i router | Pattern try/catch per handler rispettato ovunque; `err.message` però finisce nel body del 500 (leak di dettagli interni → rinviato a Step 5). | — |
| 🟢 | `index.ts:22` | `express.json()` con limite default 100 kb: la matrice allocazioni più grande realistica (~500 celle) resta sotto i 50 kb. Ok. | — |

### B2. Query PostgreSQL

#### 🔴 B2.1 — N+1 massivo nel PUT allocation (`allocations.ts:162-255`)
Dentro la transazione, **per ogni cella** della matrice:
1. `SELECT day_rate FROM "Resource"` (:221) — ripetuto per ogni cella anche della **stessa risorsa**;
2. `calculatePhaseWeekWorkingDays` (:225) → `SELECT planned_start, planned_end FROM "ProjectPhase"` (:46) — ripetuto per ogni cella ma **la fase è sempre la stessa** dell'intera richiesta;
3. `INSERT` singolo (:228).

Più 1-2 query `canAllocate` per coppia (risorsa, settimana) e un advisory lock ciascuna. Salvataggio di una fase con 5 risorse × 20 settimane = 100 celle → **~320 round-trip** al DB in transazione (che trattiene gli advisory lock per tutta la durata, allungando la finestra di contesa con altri PM). Fix a basso rischio: ① fase letta **una volta** prima del loop; ② day_rate con un solo `SELECT … WHERE id = ANY($1)`; ③ `INSERT` multi-riga (o `UNNEST`). Da ~320 a ~10 query.

#### 🟡 B2.2 — Indici mancanti (inferiti dalla struttura delle query)
Indici esistenti: unique `(resource_id, project_id, phase_id, week_start)` su AllocationEntry (mig. 002/004), `idx_ongoing_project_phase_date` (009), indici knowledge graph (012/013). Mancano:

| Tabella | Indice suggerito | Query servita |
|---|---|---|
| `AllocationEntry` | `(project_id)` | `allocations.ts:79-90`, sub-query budget in `projects.ts:18-22`, `dashboard.ts:22-32` — oggi seq scan |
| `AllocationEntry` | `(phase_id)` | `phaseFinancialEngine.ts:54-60` (`phase_id = ANY(...)`), JOIN in `baseline.ts:39` |
| `AllocationEntry` | `(resource_id, week_start)` | `allocationAggregator.ts:73-83` — il unique index esistente ha `week_start` in 4ª posizione dopo project/phase, quindi serve solo il prefisso `resource_id` |
| `ProjectPhase` | `(project_id)` | praticamente ogni route |
| `GanttTask` | `(project_id, is_milestone)` | `dashboard.ts:45-51`, `gantt.ts` |

A scala POC (decine di righe) è invisibile; con 50 progetti × 3 anni di settimane diventa il collo di bottiglia principale, e gli indici FK costano nulla. Una migrazione `014_core_indexes.sql` chiude tutto.

#### 🟢 B2.3 — Parametrizzazione
**Tutte** le query usano placeholder `$n`; l'unica interpolazione (`pmFilter`, `projects.ts:11`) è una costante interna, non input utente. Nessuna SQL injection da query building. ✅

#### 🟢 B2.4 — Pattern batch già corretti altrove
`phaseFinancialEngine.ts:54-76` usa correttamente batch `ANY($1::int[])` + `DISTINCT ON` — il know-how nel team c'è; va solo applicato anche a `allocations.ts` (B2.1).

### B3. CORS

🟡 `index.ts:23` — `app.use(cors())` = `Access-Control-Allow-Origin: *` su tutte le route, in tutti gli ambienti. Non è un problema di *performance* ma va chiuso prima del deploy (dettaglio e fix in Step 5). Qui solo una nota: con il proxy dev di Vite (A4) il CORS in locale diventa superfluo.

### B4. Vincoli serverless Vercel

| Sev | Rilievo | Dettaglio |
|---|---|---|
| 🔴 | **Il backend non è deployabile così com'è** (conferma di Step 1 §4.3) | `index.ts:42` chiama `app.listen()` e non esporta l'app: `@vercel/node` non ha un handler da invocare. Fix: `export default app` + `if (require.main === module) app.listen(...)` per il dev locale. |
| 🟡 | Pool pg vs serverless | `db/index.ts:6` crea il `Pool` a module scope (corretto per il riuso a caldo), ma **senza `max`**: default 10 connessioni *per istanza* lambda. Con N istanze concorrenti → N×10 connessioni dirette: i Postgres gestiti (Supabase incluso) le esauriscono in fretta. Fix: `max: 1-3` in ambiente serverless + connection string verso il pooler (PgBouncer/Supavisor porta 6543), o driver HTTP (es. `@neondatabase/serverless`). |
| 🟡 | Cold start amplificato da requireAuth | Cold start (~300-800 ms per `@vercel/node` + pg) **più** il round-trip Supabase per-request (B1) → prima chiamata utente ~1-1.5 s. La verifica JWT locale (B1) toglie il termine maggiore. |
| 🟢 | Timeout/payload | Nessuna route fa lavoro lungo (no streaming, no upload); il sync Keyedin è stub. Entro i limiti free tier (10 s) anche nei casi peggiori attuali — il PUT allocation con N+1 (B2.1) è l'unico che potrebbe avvicinarsi col crescere della matrice: altro motivo per il fix batch. |
| 🟢 | Migrazioni | Nessun hook di deploy esegue `migrate.ts` — su Vercel serve un passo manuale/CI contro il DB di produzione. Da documentare. |

---

## Riepilogo priorità performance

| Sev | Issue | Area | Effort |
|---|---|---|---|
| 🔴 | Transazioni rotte su pool (`BEGIN` via `pool.query`) | BE / baseline.ts | S |
| 🔴 | N+1 nel PUT allocation: ~320 query per salvataggio fase | BE / allocations.ts | M |
| 🔴 | `requireAuth` async senza try/catch → richieste appese | BE / middleware | S |
| 🔴 | Backend non esportato per Vercel; matrice FTE O(n²) per keystroke | Deploy / FE | S / M |
| 🟡 | Bundle unico 508 kB; nessun code splitting; vendor chunk assente | FE | S |
| 🟡 | Verifica token via round-trip Supabase per ogni richiesta | BE | M |
| 🟡 | GET /projects: sub-query correlate, loop giorni senza festività, possibile riga duplicata | BE | M |
| 🟡 | Indici FK mancanti (5 indici, 1 migrazione) | DB | S |
| 🟡 | Pool senza `max` + niente pooler per serverless; refetch totale dopo ogni save fase | BE / FE | S |
| 🟢 | WeekGrid O(righe×settimane) div; proxy dev assente; migrazioni non automatizzate | FE / BE | S |

**Quick win consigliato** (mezza giornata): `withTransaction` in baseline.ts + try/catch in requireAuth + `export default app` + migrazione indici. Quattro fix S che eliminano i tre rischi più gravi lato backend.

---

*Fine Step 4 — in attesa di conferma per procedere allo Step 5 (Auth & Security Audit).*
