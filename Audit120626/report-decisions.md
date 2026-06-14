# Decisioni rinviate — richiedono input umano

> Issue emerse durante l'applicazione dei fix che non ho applicato perché richiedono
> una scelta di prodotto/architettura. Formato: contesto → opzioni → trade-off.

---

## D1 — Ciclo di vita della sessione (refresh token) — da fix: step 5

**Contesto** (report Step 5 §1): il login passa dal backend che restituisce solo
l'`access_token` Supabase (TTL 1h). Il client Supabase del browser non ha mai una
sessione, quindi il listener `TOKEN_REFRESHED` in `AuthContext.tsx:21-40` non scatterà
mai: dopo 1 ora la sessione muore silenziosamente (401 → redirect login, modifiche
non salvate perse).

**Opzione A — Il backend consegna anche il refresh token.**
`auth.ts` restituisce `refresh_token` insieme all'access token; il frontend chiama
`supabase.auth.setSession({ access_token, refresh_token })` dopo il login. Il listener
esistente inizia a funzionare senza altre modifiche.
- ✅ Cambio minimo (2 file), conserva il flusso attuale "login via backend" e il check
  di provisioning (`User not provisioned`) server-side al login.
- ❌ Il refresh token transita da un endpoint custom; due fonti di verità sulla sessione.

**Opzione B — Login direttamente client-side con Supabase.**
Il frontend chiama `supabase.auth.signInWithPassword`; il backend smette di fare proxy
del login e si limita a validare i token (già fa così in `requireAuth`). Il check di
provisioning si sposta in una GET `/api/me` post-login.
- ✅ Architettura canonica Supabase: refresh automatico, logout reale client-side,
  meno codice custom; la route `/api/auth/login` sparisce.
- ❌ Refactor più ampio (Login.tsx, AuthContext, api/auth.ts, route backend);
  il flusso di provisioning va ripensato; il mock mode (`VITE_USE_MOCK`) va adattato.

**Raccomandazione:** Opzione A subito (sblocca il problema con rischio minimo);
valutare B quando si affronta lo Step H definitivo dell'auth.

---

## D2 — Restrizioni di ruolo su template e registro risorse — da fix: step 5

**Contesto** (report Step 5 §2.4): `requireRole` esiste ma non è applicato.
Oggi qualsiasi PM può: (a) modificare/eliminare i **phase template globali** che
governano i nuovi progetti di tutti; (b) vedere il **day rate** di tutte le risorse e
l'intero registro allocazioni cross-project.

**Opzione A — Lock al ruolo DM.**
`requireRole('dm')` sulle scritture di `/api/phase-templates` (e in caso sul registry).
- ✅ Una riga per endpoint, middleware già pronto.
- ❌ La pagina Impostazioni e il Registro Risorse sono oggi raggiungibili dai PM nella
  UI: serve nascondere/disabilitare lato frontend in base al ruolo, altrimenti i PM
  vedono errori. Il registro per i PM è anche *utile* (vedono la disponibilità prima
  di allocare): toglierlo del tutto degrada il flusso di pianificazione.

**Opzione B — Visibilità differenziata.**
Scritture template → DM; registro visibile ai PM ma **senza day rate** (campo omesso
per ruolo `pm`), allocazioni visibili in percentuale FTE.
- ✅ Bilancia riservatezza retributiva e usabilità del capacity planning.
- ❌ Più lavoro: variante di risposta per ruolo su `/api/resources/registry` + UI.

**Domanda chiave per il business:** il day rate è un dato riservato in questa
organizzazione? Se sì → B; se è un dato di lavoro condiviso tra PM → A solo sui template.

**Raccomandazione:** Opzione A sui template subito; per il registry decidere col
business prima di toccare.

---

## D3 — Refetch totale dopo il salvataggio di una fase — da fix: step 4 (aggiornata in step 3)

**Contesto** (report Step 4 A2): `handleAllocationSaved` (ora `pages/pianificazione/index.tsx`)
rifetcha baseline + intera matrice + registro cross-project (3 GET pesanti) dopo il PUT
di una singola fase.

**Aggiornamento step 3:** il prerequisito è stato sciolto — `PhaseBlock` è ora un
componente isolato (`pages/pianificazione/PhaseBlock.tsx`) e il bug di **data-loss** del
derived-state è stato chiuso con una guardia (`if (dirty) return` nel sync da props: il
refetch non sovrascrive più gli edit non salvati delle altre fasi aperte). Resta aperta
solo la scelta sotto, perché elimina round-trip ma introduce coerenza eventuale.

**Opzione A — Il PUT restituisce la fase ricalcolata e il FE patcha lo stato.**
Il PUT già restituisce le righe inserite con `weekly_cost`/`working_days` calcolati dal
server: il FE può aggiornare solo la fase salvata e i totali derivati, senza i 3 GET.
- ✅ Da 3 GET a 0; UX più reattiva.
- ❌ La colonna **Budget £** del tab Fasi (FasiTab) deriva da `SUM(weekly_cost)` calcolato
  server-side: patchando solo localmente resterebbe stale finché non si ricarica la
  baseline. Serve decidere se la staleness è accettabile o se patchare anche il budget di
  fase dalla risposta del PUT.

**Opzione B — Status quo (refetch).**
- ✅ Semplice, sempre coerente col server; con la guardia `dirty` non c'è più data-loss.
- ❌ 3 round-trip per ogni salvataggio.

**Raccomandazione:** B è ora sicuro (niente data-loss). Fare A solo se i 3 GET diventano
un problema di UX percepito, accettando la staleness del budget di fase o patchandolo
dalla risposta del PUT.

---

## D4 — Verifica JWT locale al posto del round-trip Supabase — da fix: step 4

**Contesto** (report Step 4 B1): `requireAuth` chiama `supabase.auth.getUser(token)`
(HTTP, ~100-300 ms). Applicato in step 4 un **cache TTL 60s** che elimina il costo per
le richieste ripetute; resta il round-trip sul primo hit di ogni token e una latenza di
revoca ≤60s.

**Opzione A — Verifica firma locale (jose + JWKS / SUPABASE_JWT_SECRET).**
- ✅ Zero round-trip sempre; funziona anche se Supabase Auth è momentaneamente giù.
- ❌ Nuova dipendenza; serve recuperare il JWT secret (HS256, progetti legacy) o
  configurare JWKS (RS256/ES256, progetti recenti) dal dashboard Supabase → nuova env
  var; la revoca del token diventa impossibile fino a scadenza (oggi mitigata dal TTL 1h).

**Opzione B — Tenere getUser + cache attuale.**
- ✅ Nessuna chiave da gestire; revoca quasi-immediata (≤60s).
- ❌ Resta la dipendenza runtime da Supabase per il primo hit.

**Raccomandazione:** B va bene per il POC (il costo è già ammortizzato dalla cache);
valutare A solo al passaggio in produzione, insieme a D1.

---

## D5 — Design system: estrazione di Button/Input/Card/SegmentedControl — da fix: step 2

**Contesto** (report Step 2 §6): oltre al modale (estratto come `<Modal>`) e all'alert
(`<Alert>`), il report elenca altri pattern Tailwind ripetuti verbatim: bottone primario
(~10), input testo/numero (~15), card (~25), segmented control/pill group (4). Oggi lo
stile è coerente solo per disciplina copia-incolla.

**Non applicato perché** è la costruzione di un design system: definire l'API dei
componenti (nomi varianti, prop, gestione `className` di override) è una scelta di
direzione, e la migrazione tocca ~50 call-site in ogni pagina in un colpo solo (diff
ampio, rischio di regressioni visive su tutta l'app). In step 2 ho applicato solo le due
estrazioni a leva più alta e meno rischiose: `<Modal>` (risolve anche a11y e animazioni
morte) e `<Alert>` (uniforma il raggio incoerente).

**Opzione A — Introdurre i componenti gradualmente.**
`<Button variant="primary|secondary|danger">`, `<TextInput>`, `<Card>`,
`<SegmentedControl>`, migrando una pagina alla volta.
- ✅ Elimina la fonte principale di rischio visivo; un solo punto per ritoccare lo stile.
- ❌ Lavoro non banale; va deciso lo schema delle varianti e la policy di override.

**Opzione B — `@apply` su classi utility (`.btn`, `.input`, `.card`, `.th`).**
- ✅ Meno invasivo dei componenti (solo classi CSS), nessun cambio di markup strutturale.
- ❌ Perde la type-safety delle varianti; gli `@apply` vanno mantenuti allineati.

**Raccomandazione:** A per Button/Input (alta frequenza, beneficiano delle varianti),
`@apply` per `.th`/fade-gradient (puramente presentazionali). Da fare come task dedicato
"design system" con review visiva, non dentro un fix di altri rilievi.
