# Macro-Area 01 — Accesso & Multi-tenancy

## 1. Nome Modulo

**Accesso & Multi-tenancy** — autenticazione utente e isolamento dei dati per proprietario (Project Manager) nell'applicazione di project forecasting.

## 2. Obiettivo di Business

Il modulo garantisce che l'applicazione, pensata per sostituire un file Excel condiviso, possa essere usata da **più Project Manager contemporaneamente mantenendo separati i dati di ciascuno**. Risolve due problemi che l'Excel non poteva affrontare:

- **Identità e accesso controllato**: solo utenti censiti (provisioned) possono entrare; nessun accesso anonimo ai dati di progetto.
- **Riservatezza tra PM**: ogni PM vede e modifica solo i propri progetti, mentre una figura di supervisione (Delivery Manager) ha visibilità completa per governance e reporting trasversale.

L'autenticazione è delegata a **Supabase Auth** (identity provider esterno); l'applicazione mantiene una propria anagrafica utenti (`"User"`) collegata a Supabase tramite `supabase_uid`, dove risiedono ruolo e dati di dominio (`backend/src/routes/auth.ts:22-25`, `backend/src/middleware/requireAuth.ts:61-64`).

## 3. Attori

| Attore | Ruolo (`role`) | Capacità |
|---|---|---|
| **Project Manager** | `pm` | Accede **solo ai progetti di cui è owner** (`Project.pm_id = userId`). Ogni tentativo su progetti altrui riceve `404` (`backend/src/middleware/requireProjectAccess.ts:20-22`). |
| **Delivery Manager** | `dm` | **Bypassa il controllo di ownership**: accede a tutti i progetti di tutti i PM (`requireProjectAccess.ts:20`). Ruolo di supervisione/governance. |
| **Utente Supabase non provisioned** | — | Autenticato su Supabase ma **assente dalla tabella `"User"`**: bloccato con `403 User not provisioned` sia al login sia sulle route protette (`auth.ts:27-28`, `requireAuth.ts:65-66`). |
| **Utente anonimo** | — | Nessun token → `401`; sul frontend viene redirezionato a `/login` (`requireAuth.ts:41-42`, `RequireAuth.tsx:7`, `client.ts:19-23`). |

Il tipo del ruolo è vincolato a `'pm' | 'dm'` a livello di tipizzazione (`backend/src/types/express.d.ts:6`).

## 4. Funzionalità Operative

1. **Login** — `POST /api/auth/login` con `email` + `password`; valida su Supabase (`signInWithPassword`), verifica il provisioning in `"User"` e restituisce `{ token, user: { id, role, email, name } }` (`auth.ts:8-45`).
2. **Logout** — `POST /api/auth/logout`; se presente Bearer token invoca `supabase.auth.admin.signOut(token)` per revocare la sessione lato server (`auth.ts:49-63`). Il frontend rimuove comunque token e user da `localStorage` (`api/auth.ts:17-20`, `AuthContext.tsx:49-57`).
3. **Autenticazione richiesta** su ogni route dati — middleware `requireAuth` che valida il Bearer token, risolve l'utente di dominio e popola `req.auth` (`requireAuth.ts:31-81`).
4. **Autorizzazione a livello di oggetto** sul progetto — middleware `requireProjectAccess` che verifica l'ownership `pm_id` (`requireProjectAccess.ts:9-29`).
5. **Verifica di ruolo** riusabile — factory `requireRole(...roles)` che risponde `403 Insufficient permissions` se il ruolo non è tra quelli ammessi (`requireAuth.ts:83-90`). *Nota: definita ma non montata su alcuna route in `index.ts`.*
6. **Persistenza sessione lato client** — token e user salvati in `localStorage`, ripristinati all'avvio (`AuthContext.tsx:15-19`).
7. **Sincronizzazione stato auth con Supabase (client)** — gestione eventi `SIGNED_OUT` (pulizia) e `TOKEN_REFRESHED` (aggiornamento token in storage) (`AuthContext.tsx:21-40`).
8. **Guardia di rotta frontend** — `RequireAuth` (layout pathless) redirige a `/login` se manca il token (`RequireAuth.tsx:5-9`).
9. **Gestione sessione scaduta (client)** — su `401` l'`apiClient` pulisce lo storage e forza il redirect a `/login` (`client.ts:19-24`).

## 5. Flussi di Lavoro

### 5.1 Login → accesso alle route protette
1. L'utente compila email/password in `Login.tsx`; validazione client dei campi obbligatori (`Login.tsx:25-33`).
2. `login()` chiama `POST /api/auth/login` (`api/auth.ts:6-15`).
3. Il backend autentica su Supabase e verifica il provisioning in `"User"`; ritorna `token` + `user` (`auth.ts:13-41`).
4. `setAuth()` salva token+user in `localStorage` e stato React; redirect a `/projects` (`Login.tsx:37-39`, `AuthContext.tsx:42-47`).
5. Ad ogni chiamata successiva, `apiClient` allega `Authorization: Bearer <token>` (`client.ts:9-15`).

### 5.2 Accesso a una risorsa di progetto
1. Richiesta a `/api/projects/:id/*` → `requireAuth` valida il token (cache o Supabase) e popola `req.auth` (`index.ts:37`, `requireAuth.ts:31-76`).
2. `requireProjectAccess` legge `pm_id` del progetto: se il progetto non esiste → `404`; se il chiamante non è `dm` e non è owner → `404` (`requireProjectAccess.ts:15-22`).
3. Passati i guard, l'esecuzione prosegue verso i router figli (dashboard, baseline, gantt, allocation, ongoing, knowledge, intelligence) senza ulteriori controlli di accesso (`index.ts:40-48`).

### 5.3 Sessione scaduta / token invalido
1. Backend risponde `401 Invalid token` / `Missing token` (`requireAuth.ts:41-58`).
2. `apiClient` intercetta il `401`, pulisce lo storage e reindirizza a `/login` (`client.ts:19-24`).

## 6. Regole di Business

- **RB-01 — Provisioning obbligatorio**: l'autenticazione Supabase non basta; l'utente deve esistere in `"User"` per ottenere ruolo/identità di dominio. Assenza → `403 User not provisioned` (`auth.ts:27-28`, `requireAuth.ts:65-66`).
- **RB-02 — Ownership per PM (multi-tenancy)**: un `pm` accede solo ai progetti con `pm_id = userId` (`requireProjectAccess.ts:20`).
- **RB-03 — Bypass del DM**: il ruolo `dm` accede a tutti i progetti (`requireProjectAccess.ts:20`).
- **RB-04 — Policy 404-non-403**: per progetti inesistenti **e** per progetti altrui si risponde sempre `404 Project not found`, per non confermare l'esistenza di risorse altrui (enumeration protection) (`requireProjectAccess.ts:7,17,21`).
- **RB-05 — Cache token con TTL**: `requireAuth` cachea la coppia token→auth per **60s** (max 500 entry, eviction FIFO del più vecchio) per evitare il round-trip a Supabase e la query `"User"` ad ogni richiesta. Trade-off dichiarato: un token revocato resta valido per al più 60s (`requireAuth.ts:5-29`).
- **RB-06 — Idempotenza di requireAuth**: se `req.auth` è già valorizzato, il middleware passa oltre senza rivalutare — consente il doppio mount sul prefisso `/api/projects/:id` e sui router figli senza doppia validazione (`requireAuth.ts:32`, `index.ts:37,39`).
- **RB-07 — Guard unico sul prefisso**: `requireAuth` + `requireProjectAccess` sono montati una sola volta su `/api/projects/:id` e coprono tutte le route figlie (`index.ts:34-48`).
- **RB-08 — Bypass in ambiente di test**: con `NODE_ENV === 'test'` e `JEST_WORKER_ID` definito, `requireAuth` inietta un'identità fittizia `dm` (`userId:1`) saltando Supabase — abilita i test di integrazione supertest senza auth reale (`requireAuth.ts:34-37`).
- **RB-09 — Degradazione senza credenziali Supabase**: se `SUPABASE_URL`/`SERVICE_ROLE_KEY` mancano, il client è `null` e le route auth rispondono `503`; `requireAuth` risponde `503 Auth service unavailable` (`supabase.ts:9-14`, `auth.ts:9,50`, `requireAuth.ts:52-53`).
- **RB-10 — Non-esposizione dettagli interni**: errori inattesi loggati con `console.error` e risposta generica `500 Internal server error` (`requireAuth.ts:77-80`, `requireProjectAccess.ts:25-28`, `auth.ts:42-45`).
- **RB-11 — Validazione id numerico**: `requireProjectAccess` esegue il controllo ownership solo se `:id` è numerico (`/^\d+$/`); id non numerico passa oltre senza check (`requireProjectAccess.ts:13`).

## 7. Verifica CLAUDE.md

Riferimento: sezione *Auth* e *Architecture / guard* di `CLAUDE.md`.

**Corretto:**
- `requireAuth` (token + cache TTL 60s) e `requireProjectAccess` (ownership `pm_id`, bypass `dm`) attivi su tutte le route dati — confermato (`requireAuth.ts`, `requireProjectAccess.ts`, `index.ts:37`).
- Guard montato **una sola volta** sul prefisso `/api/projects/:id`; `requireAuth` idempotente — confermato (`index.ts:37`, `requireAuth.ts:32`).
- Policy `404` per risorse di altri PM (mai `403`) — confermato (`requireProjectAccess.ts:21`).
- Supabase usato **solo per autenticazione**, non per query dati — confermato (`supabase.ts`, uso solo in auth/requireAuth).

**Impreciso / da integrare:**
- CLAUDE.md descrive `dm` come unico bypass ma **non menziona la policy `403 User not provisioned`** (utente Supabase valido ma non in `"User"`), che è una regola di accesso rilevante (`auth.ts:27-28`, `requireAuth.ts:65-66`).
- Non documentato il **bypass di test** che inietta identità `dm` (`requireAuth.ts:34-37`), pur essendo citato genericamente il "gating test".
- Non documentata la **degradazione `503`** in assenza di credenziali Supabase né la presenza (inutilizzata) di `requireRole` (`requireAuth.ts:83-90`).

## Open Point

- **OP-01 — `requireRole` non utilizzato**: la factory `requireRole` è definita ma non montata su alcuna route (`index.ts`). Le decisioni aperte D2 di CLAUDE.md (ruoli su template/registry) restano non implementate: `/api/phase-templates` e `/api/resources` hanno solo `requireAuth`, senza distinzione pm/dm (`index.ts:42,49`).
- **OP-02 — Logout con service-role key**: `supabase.auth.admin.signOut(token)` richiede privilegi admin; verificare che revochi effettivamente la sessione dell'utente e non sollevi errori silenziosi (`auth.ts:55-56`). Inoltre il logout server non invalida la cache TTL di `requireAuth` → token revocato ancora accettato fino a 60s (interazione con RB-05).
- **OP-03 — Verifica JWT locale (D4)**: ogni cache-miss comporta round-trip HTTP a Supabase (`getUser`); nessuna verifica locale della firma JWT. Impatto su latenza serverless da valutare.
- **OP-04 — Id non numerico salta il check ownership**: route con `:id` non numerico (se esistessero) bypasserebbero `requireProjectAccess` (`requireProjectAccess.ts:13`). Attualmente non sfruttabile poiché gli id progetto sono numerici, ma è un assunto implicito.
- **OP-05 — Persistenza token in `localStorage`**: esposizione a XSS; nessun refresh token gestito lato app oltre all'evento `TOKEN_REFRESHED` di Supabase (`AuthContext.tsx:32-36`). Collegato a D1 (sessione/refresh token).
