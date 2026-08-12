# Report Step 5 — Auth & Security Audit

> Audit `project-forecast-app` — analisi statica di middleware, route, env e history git.
> Data: 2026-06-12 · Nessuna modifica al codice.

**Sintesi esecutiva.** L'**autenticazione** è in stato migliore di quanto dichiarato da CLAUDE.md:
`requireAuth` esiste, è montato su tutte le route dati e valida i token contro Supabase.
L'**autorizzazione** invece è quasi assente: il filtro `pm_id` copre **solo la lista progetti** —
ogni altra route accetta qualsiasi `:id` di progetto da qualsiasi utente autenticato (IDOR/BOLA
sistemico). È il gap n°1 da chiudere prima di qualunque esposizione fuori da localhost.

---

## 1. Integrazione Supabase Auth — stato reale vs TODO

| Aspetto | Stato dichiarato (CLAUDE.md / Step H) | Stato reale |
|---|---|---|
| Route `/api/auth` | ✅ attiva | ✅ confermato (`auth.ts`: login/logout via `signInWithPassword`) |
| `requireAuth` middleware | ❌ "ancora da fare" | ✅ **già implementato e montato** su tutte le 10 route dati (`index.ts:27-36`); valida il Bearer token con `supabase.auth.getUser` + lookup `User.supabase_uid` |
| Filtro `pm_id` | ❌ da fare | ⚠️ **parziale**: presente solo in `GET /api/projects` (`projects.ts:10-12`) — vedi §2 |
| `requireRole` | non menzionato | ⚠️ implementato (`requireAuth.ts:43-50`) ma **mai usato** da nessuna route |

### Rilievi sul flusso di sessione

| Sev | Dove | Problema |
|---|---|---|
| 🟡 | `auth.ts:33-41` + `AuthContext.tsx:21-40` | **Il refresh token non arriva mai al client**: il login passa dal backend, che restituisce solo `access_token` (TTL 1h). Il listener `TOKEN_REFRESHED` nel frontend non scatterà mai perché il client Supabase del browser **non ha una sessione** (nessun `setSession`). Risultato: dopo 1 ora la sessione muore silenziosamente → 401 → redirect al login, con perdita di eventuali modifiche non salvate. Fix: restituire anche `refresh_token` e fare `supabase.auth.setSession()` nel frontend, oppure usare direttamente `signInWithPassword` dal client. |
| 🟡 | `auth.ts:48-57` | **Logout fittizio**: `supabase.auth.signOut()` è chiamato sul client **server-side con service-role key**, che non ha la sessione dell'utente — non invalida nulla. Il token resta valido fino a scadenza. Per un logout reale: `supabase.auth.admin.signOut(jwt)` o gestirlo client-side. |
| 🟡 | `requireAuth.ts:6-9` | Bypass test: `NODE_ENV === 'test'` → utente DM hardcoded. Legittimo per Jest, ma è una **backdoor se `NODE_ENV` non è settato correttamente in produzione**. Mitigazione: gate aggiuntivo (`&& process.env.JEST_WORKER_ID`). |
| 🟢 | `AuthContext.tsx:15-19`, `client.ts:9` | Token in `localStorage`: esposto a esfiltrazione via XSS. Trade-off standard per POC; documentarlo. Nessun input utente è renderizzato come HTML (React escapa di default), quindi la superficie XSS attuale è bassa. |
| 🟢 | `requireAuth` senza try/catch | Già flaggato in Step 4 B1 (richieste appese su errore di rete) — qui rilevante anche come availability issue. |

---

## 2. Route non protette e autorizzazione mancante

### 2.1 Autenticazione (chi sei) — copertura completa ✅

Route **senza** `requireAuth`, entrambe intenzionali:
- `GET /api/health` — innocua ✅
- `POST /api/auth/login`, `POST /api/auth/logout` — per design ✅ (ma vedi 2.3 sul rate limiting)

### 2.2 🔴 Autorizzazione (cosa puoi toccare) — assente su tutto tranne la lista

**Nessuna route con `:id` verifica che il progetto appartenga al PM autenticato.** Qualsiasi PM con un token valido può, semplicemente cambiando l'ID nell'URL:

| Operazione | Route | Gravità del danno |
|---|---|---|
| Leggere dashboard/budget/forecast di progetti altrui | `GET /:id/dashboard`, `/:id/baseline`, `/:id/allocation`, `/:id/gantt`, `/:id/ongoing`, `/:id/decisions`, `/:id/risks`, `/:id/retrospectives` | Disclosure (dati finanziari, day rate) |
| Modificare date/contingenza fasi altrui | `PUT /:id/baseline` | Scrittura |
| **Bloccare la baseline di un progetto altrui** | `POST /:id/baseline/lock` | Scrittura **irreversibile** (nessun endpoint di unlock) |
| Riscrivere le allocazioni altrui | `PUT /:id/allocation` | Scrittura distruttiva (DELETE+INSERT) |
| Creare/modificare/cancellare task Gantt altrui | `POST/PUT/DELETE /:id/gantt/tasks` | Scrittura |
| Inserire/cancellare snapshot actuals altrui | `POST/DELETE /:id/ongoing` | Falsifica i KPI |
| Cambiare stato (chiudere/archiviare) progetti altrui | `PATCH /api/projects/:id/status` | Scrittura — la UI lo presenta come azione DM, ma `requireRole` non è applicato |
| Modificare descrizione/tag altrui | `PATCH /api/projects/:id` (knowledge.ts) | Scrittura |

Fix raccomandato: **un middleware unico** `requireProjectAccess` montato dopo `requireAuth` su `/api/projects/:id/*` che fa `SELECT pm_id FROM "Project" WHERE id=$1` e confronta con `req.auth.userId` (bypass per `role==='dm'`), rispondendo **404** (non 403) per non confermare l'esistenza dell'ID. Un punto solo, copre tutte le tabelle figlie perché ogni route già filtra per `project_id`.

### 2.3 🔴 Ownership incrociata fase→progetto mancante in due scritture

A differenza di `ongoing.ts:86-92` e `gantt.ts:87-91` (che verificano `phase_id` ∈ progetto ✅):
- `allocations.ts` PUT (:192, :225-233): `phase_id` dal body **mai verificato** contro `:id` → si possono inserire `AllocationEntry` con `project_id=A, phase_id=di-B`, corrompendo i budget di fase del progetto B (le SUM di dashboard/baseline aggregano per `phase_id`).
- `baseline.ts` PUT (:182-198): `UPDATE "ProjectPhase" … WHERE id = $7` **senza `AND project_id = $1`** → si possono riscrivere date e contingency di fasi di **qualsiasi** progetto passando phase_id arbitrari.

Fix: aggiungere `AND project_id = $n` alle WHERE / una verifica preliminare batch.

### 2.4 🟡 Risorse e template: dati globali senza segregazione
- `GET /api/resources` + `/api/resources/registry`: ogni PM vede **day rate** (dato retributivo sensibile) e l'allocazione settimanale di tutte le risorse su tutti i progetti. Probabilmente voluto (capacity planning cross-project) — da confermare col business e in caso limitare il registry al ruolo DM via `requireRole('dm')` già pronto.
- `PUT/POST/DELETE /api/phase-templates`: qualsiasi PM modifica i template globali che governano i nuovi progetti di tutti. Candidato naturale a `requireRole('dm')`.
- `POST /api/auth/login`: nessun rate limiting applicativo (Supabase ne applica uno proprio lato auth — mitigazione parziale accettabile per POC).

### 2.5 🟢 Dormiente
`Project.share_token` (UUID, mig. 001) esiste a schema ma nessuna route lo usa: nessuna esposizione oggi, ma se in futuro si aggiunge la condivisione pubblica va progettata con scadenza (`share_token_expires_at` già presente) e scope read-only.

---

## 3. Variabili d'ambiente e segreti

| Sev | Rilievo | Dettaglio |
|---|---|---|
| 🟡 | **`frontend/.env.local` tracciato in git nonostante `.gitignore:21`** | Il file fu committato *prima* della regola di ignore (commit `c0a2932`), e `.gitignore` non ha effetto sui file già tracciati. Verifica history completa: **nessun segreto reale è mai stato committato** (solo placeholder `your_supabase_url`). Però il working tree lo mostra **modificato** — presumibilmente con i valori reali — e un `git add -A` li committerebbe. Fix immediato: `git rm --cached frontend/.env.local` + commit. Nota: l'anon key Supabase è comunque progettata per essere pubblica (finisce nel bundle JS), quindi il rischio reale è la *disciplina*, non questo specifico segreto. |
| 🟢 | `vercel.json` | Nessun segreto, nessun blocco `env` ✓. Le env di produzione andranno configurate nel dashboard Vercel. |
| 🟢 | `backend/.env` | Correttamente gitignorato e mai tracciato; `backend/.env.example` ha le chiavi vuote ✓. `SUPABASE_SERVICE_ROLE_KEY` vive solo server-side ✓ (mai referenziata nel frontend, verificato: i file FE usano solo `VITE_SUPABASE_ANON_KEY`). |
| 🟢 | Prefissi `VITE_` | Usati correttamente: solo URL, anon key e flag mock — niente che non possa essere pubblico. `ANTHROPIC_API_KEY`/`EMBEDDING_API_KEY` solo backend ✓. |

---

## 4. Validazione input

Nessuna libreria (zod/joi): tutta validazione manuale, **di qualità molto disomogenea** tra route:

| Route | Validazione | Giudizio |
|---|---|---|
| `knowledge.ts` | required, trim, enum `category` whitelist | ✅ il migliore |
| `ongoing.ts` POST | tipi numerici, `phase_id` numerico **+ ownership fase→progetto** | ✅ buono (manca solo il check ≥0: costi/ore **negativi accettati**) |
| `gantt.ts` POST/PUT | required, vincoli date vs fase, ownership ✓ | ✅ buono (`status` non whitelistato → CHECK constraint DB → 500 con messaggio grezzo) |
| `projects.ts` PATCH status | whitelist stati | ✅ |
| `baseline.ts` PUT | `phase_id` numerico, `contingency_pct` 0-100 | ⚠️ date non validate nel formato (stringa invalida → `working_days=0` **silenzioso**); `display_name` senza limite di lunghezza (>255 → errore DB → 500) |
| `allocations.ts` PUT | **niente** | 🔴 `allocations` non verificato come array (body malformato → `TypeError` → 500); `fte` non validato (si salva solo grazie al CHECK del DB, che però risponde con errore grezzo); `week_start` non validato come data/lunedì; `phase_id` senza ownership (§2.3) |

Raccomandazione: zod sui 3 endpoint di scrittura principali (`allocation`, `baseline`, `ongoing`) — è dove transitano i dati finanziari; il resto può restare manuale.

---

## 5. Error handling — leak verso il client

| Sev | Pattern | Dove |
|---|---|---|
| 🟡 | **`res.status(500).json({ error: err.message })`** espone messaggi interni al client: errori pg con nomi di tabelle/colonne/constraint (es. violazione `unique_allocation`, CHECK su `fte`), dettagli driver, ecc. Nessuno stack trace nel body (✓), ma i messaggi sono comunque fingerprinting del DB. | `projects.ts`, `dashboard.ts`, `baseline.ts`, `allocations.ts` (ramo non-FTE_CAP), `gantt.ts`, `phases.ts`, `knowledge.ts`, `auth.ts:43` |
| 🟢 | Pattern corretto già presente nel progetto: messaggio generico al client + `console.error(err)` nei log. | `ongoing.ts` (tutte le route) — da adottare ovunque, idealmente con un **error-handler middleware Express centralizzato** (oggi assente) che distingua errori business (409 FTE_CAP già ben fatto in `allocations.ts:243-251`) da errori interni |
| 🟢 | `auth.ts:19` ritorna `error.message` di Supabase sul login fallito: Supabase usa messaggi generici ("Invalid login credentials"), quindi niente user enumeration oggi — ma il pass-through è fragile rispetto a messaggi futuri. | `auth.ts:19` |
| 🟢 | CORS wildcard (`index.ts:23`): con Bearer token (no cookie) il CSRF classico non si applica, ma `*` permette a qualsiasi origin di consumare l'API. In produzione: allowlist (`origin: [vercel-domain, localhost:5173]`). | `index.ts:23` |
| 🟢 | Manca `helmet` (security headers) e qualsiasi rate limiting applicativo. Per un POC interno è tollerabile; entrambi sono 1 riga ciascuno al momento del deploy. | `index.ts` |

---

## 6. Riepilogo severità

| Sev | Issue | Fix effort |
|---|---|---|
| 🔴 | IDOR sistemico: nessuna verifica ownership progetto su 20+ endpoint (lettura e scrittura, incluso lock irreversibile) | S/M — un middleware `requireProjectAccess` |
| 🔴 | `phase_id` non verificato in `allocations.ts` PUT e `baseline.ts` PUT → scrittura cross-progetto | S — `AND project_id` nelle WHERE |
| 🔴 | PUT allocation senza alcuna validazione input | S — zod schema |
| 🟡 | Sessione muore dopo 1h senza refresh; logout che non invalida nulla | M |
| 🟡 | `.env.local` tracciato (history pulita, ma commit accidentale a un `git add -A` di distanza) | S — `git rm --cached` |
| 🟡 | `err.message` del DB esposto al client su quasi tutte le route | S — error handler centralizzato |
| 🟡 | Day rate e registry globali visibili a ogni PM; phase-templates modificabili da chiunque (`requireRole` esiste ma è inutilizzato) | S — decisione business + 1 riga |
| 🟡 | Bypass `NODE_ENV=test` come potenziale backdoor di configurazione | S |
| 🟢 | Token in localStorage; no helmet/rate-limit/CORS allowlist; valori negativi accettati in ongoing; `share_token` dormiente | S |

**Priorità assoluta pre-deploy:** middleware di ownership (§2.2) + i due fix `AND project_id` (§2.3). Senza questi, l'app è multi-utente solo di nome: ogni PM autenticato è di fatto amministratore dei dati di tutti.

---

*Fine Step 5 — in attesa di conferma per procedere allo Step 6 (Final Priority Matrix).*
