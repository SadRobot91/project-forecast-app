# Report Step 6 — Priority Matrix Finale

> Aggregazione dei finding degli Step 1–5. Data: 2026-06-12.
> Ordinamento: Severità DESC → Effort ASC (quick win prima).
> Effort: **S** < ½ giornata · **M** ½–2 giornate · **L** > 2 giornate.
> Dove uno stesso problema è emerso in più step, è stato consolidato in una riga sola
> (es. bundle unico = Step 3 §5.3 + Step 4 A1; severità di `.env.local` rivista da 🔴 a 🟡
> dopo la verifica della history in Step 5 §3).

---

## Backlog prioritizzato

| # | Area | Issue | File | Sev | Effort | Ordine |
|---|------|-------|------|-----|--------|--------|
| 1 | Security | IDOR sistemico: nessuna verifica ownership su 20+ endpoint progetto (incluso lock baseline irreversibile) | `index.ts`, nuovo `middleware/requireProjectAccess.ts` | 🔴 | S | 1 |
| 2 | Security | Scrittura cross-progetto: `phase_id` non verificato (`AND project_id` mancante) | `allocations.ts:192,225`, `baseline.ts:182-198` | 🔴 | S | 2 |
| 3 | Security | `PUT /allocation` senza alcuna validazione input (body malformato → 500, fte/date non validati) | `allocations.ts:162-255` | 🔴 | S | 3 |
| 4 | Backend | Transazioni rotte: `BEGIN/COMMIT` via `pool.query` → PUT baseline non atomico, connessioni idle-in-transaction | `baseline.ts:172-211,233-264` | 🔴 | S | 4 |
| 5 | Backend | `requireAuth` async senza try/catch → richiesta appesa se Supabase/DB lanciano | `requireAuth.ts:5-41` | 🔴 | S | 5 |
| 6 | Deploy | Backend non deployabile su Vercel: `app.listen()` senza `export default app` | `backend/src/index.ts:42` | 🔴 | S | 6 |
| 7 | Deploy | Manca fallback SPA in `vercel.json`: 404 su refresh/deep-link di ogni route client | `vercel.json:14-23` | 🔴 | S | 7 |
| 8 | Frontend | Redirect legacy rotti (verificato live): `../pianificazione` su route flat → si perde il progetto | `App.tsx:60-62` | 🔴 | S | 8 |
| 9 | Performance | N+1 nel PUT allocation: ~320 round-trip DB per salvataggio fase, advisory lock trattenuti | `allocations.ts:216-235` | 🔴 | M | 9 |
| 10 | Performance | Zero memoizzazione sulla matrice FTE: O(celle²) per keystroke, lag su matrici reali | `Pianificazione.tsx:329-528`, `FTECell.tsx` | 🔴 | M | 10 |
| 11 | UX | Matrice allocazioni inutilizzabile su mobile (nessuna strategia sotto `md`) | `Pianificazione.tsx:437-493` | 🔴 | M | 11 |
| 12 | UI | Nessun `<Modal>` condiviso: 6 duplicazioni, zero a11y (no role/focus-trap/Escape), animazioni morte (plugin `tailwindcss-animate` assente) | `ConfirmModal.tsx` +5 file | 🔴 | M | 12 |
| 13 | Repo | `.env.local` tracciato (history pulita, ma valori reali locali a un `git add -A` dal commit) | `frontend/.env.local` | 🟡 | S | 13 |
| 14 | UI | Classi rotte: typo `spointer-events-none` (blob intercetta click sul login), `border-white/8` non generata | `Login.tsx:49,67` | 🟡 | S | 14 |
| 15 | Security | `err.message` del DB esposto al client su ~8 router (manca error handler centralizzato; modello corretto in `ongoing.ts`) | tutti i router tranne ongoing | 🟡 | S | 15 |
| 16 | Security | `requireRole` mai usato: phase-template globali modificabili da ogni PM; day rate visibili a tutti | `index.ts:36`, `phaseTemplates.ts` | 🟡 | S | 16 |
| 17 | Security | Bypass `NODE_ENV=test` in requireAuth come potenziale backdoor di configurazione | `requireAuth.ts:6-9` | 🟡 | S | 17 |
| 18 | DB | 5 indici FK mancanti (`AllocationEntry(project_id)`, `(phase_id)`, `(resource_id,week_start)`, `ProjectPhase(project_id)`, `GanttTask(project_id,is_milestone)`) | nuova migrazione `014` | 🟡 | S | 18 |
| 19 | Backend | Pool pg senza `max` + nessun pooler: esaurimento connessioni con N istanze serverless | `db/index.ts:6-8` | 🟡 | S | 19 |
| 20 | Frontend | Doppio fetch a ogni cambio fase in Avanzamento (4 richieste invece di 2) | `Avanzamento.tsx:64-85,313-317` | 🟡 | S | 20 |
| 21 | Frontend | Bundle unico 508 kB (135 gzip): nessun `React.lazy` né `manualChunks` | `App.tsx:4-11`, `vite.config.ts` | 🟡 | S | 21 |
| 22 | Quality | Script `test` assente in frontend/package.json: i test Vitest non girano in nessuna pipeline | `frontend/package.json` | 🟡 | S | 22 |
| 23 | Quality | 3 pagine morte (~1.100 righe non importate) + naming `Ongoing` duplicato | `Allocation/Baseline/Ongoing.tsx` | 🟡 | S | 23 |
| 24 | UI | Token palette aggirati (orange-400 milestone, yellow-400 on_hold, hex hardcoded, 3 varianti glow) + semaforo FTE duplicato con legende divergenti | `Gantt.tsx`, `Projects.tsx:22`, `SlippageModal.tsx:60`, `FTECell/Resources` | 🟡 | S | 24 |
| 25 | UX | Incoerenze visibili: KPI Budget (BAC) ≠ TOTALE tabella senza spiegazione; empty-state con stato raw inglese; KPI Scostamento ridondante | `Dashboard.tsx:311-316`, `Projects.tsx:208` | 🟡 | S | 25 |
| 26 | TypeScript | `PhaseType` assorbito da `string`; `(data as any).tags`; errori fetch ignorati in 3 pagine | `types/index.ts:22`, `Dashboard.tsx:418` | 🟡 | S | 26 |
| 27 | Docs | CLAUDE.md (SSoT) indietro di vari step: requireAuth, knowledge graph, embeddings, migrazioni 009-013, file inesistenti citati | `CLAUDE.md` | 🟡 | S | 27 |
| 28 | Auth | Sessione muore dopo 1h (refresh token mai consegnato al client); logout che non invalida nulla | `auth.ts:33-57`, `AuthContext.tsx:21-40` | 🟡 | M | 28 |
| 29 | Backend | Verifica token via round-trip HTTP a Supabase a ogni richiesta (~100-300 ms di tassa fissa) | `requireAuth.ts:21` | 🟡 | M | 29 |
| 30 | Backend | `GET /projects`: 6 sub-query correlate per riga, loop giorni senza festività (diverge dalla Dashboard), riga duplicata con 2 fasi in corso | `projects.ts:14-101` | 🟡 | M | 30 |
| 31 | Architettura FE | Nessuna layout route: `ProtectedRoute`+`AppNav` duplicati 8×, nome progetto ri-fetchato per pagina | `App.tsx`, tutte le pagine | 🟡 | M | 31 |
| 32 | Architettura FE | Logica duplicata: fetch lifecycle ×7, mock switch ×34, date ×4, inline-edit ×2 → `useFetch`, `withMock`, `utils/dates`, `EditableText` | `pages/*`, `api/*` | 🟡 | M | 32 |
| 33 | Architettura FE | God-file: `Pianificazione.tsx` (770), `Gantt.tsx` (728); `Avanzamento.tsx` monolitico (KPICard da condividere) | 3 pagine | 🟡 | M | 33 |
| 34 | Architettura FE | Derived-state-from-props in `PhaseBlock` (doppia fonte di verità, sovrascrittura modifiche non salvate) | `Pianificazione.tsx:331-348` | 🟡 | M | 34 |
| 35 | UI | Pattern Tailwind ripetuti → `Button`, `TextInput`, `Card`, `Alert`, `SegmentedControl` (~60 occorrenze) | tutto il FE | 🟡 | M | 35 |
| 36 | UX | Tabelle senza vista mobile (Fasi&Date, Registro Risorse) + Gantt label 228px fisso su mobile | `Pianificazione.tsx:125`, `Resources.tsx`, `Gantt.tsx:18` | 🟡 | M | 36 |
| 37 | Performance | Refetch totale (3 endpoint) dopo il salvataggio di ogni singola fase | `Pianificazione.tsx:596-599` | 🟡 | M | 37 |
| 38 | Repo | Igiene: `package-lock.json` spurio, `.DS_Store` tracciati, NX senza alcuna configurazione (nessun beneficio attuale) | root | 🟢 | S | 38 |
| 39 | UI | Minori: `lang="en"`→`it`, favicon 404, scala H1 incoerente, gutter mobile, soglie BudgetBar divergenti, legende senza wrap, aria-label mancanti, label "auto" sotto contrasto | vari | 🟢 | S | 39 |
| 40 | Security | Minori: helmet/rate-limit/CORS allowlist assenti; valori negativi accettati in ongoing; token in localStorage (documentare); `share_token` dormiente | `index.ts`, `ongoing.ts` | 🟢 | S | 40 |
| 41 | Code | Minori: `TODAY` stale nel Gantt, modali senza portal, reorder template non atomico, `catch(e: any)` ×4, `JSON.parse` non guardato, `useCallback` cargo-cult | vari | 🟢 | S | 41 |
| 42 | Performance | Minori: WeekGrid O(righe×settimane) div, proxy dev Vite assente, migrazioni non automatizzate nel deploy | `Gantt.tsx:289`, `vite.config.ts` | 🟢 | S | 42 |

---

## Top 5 azioni da fare subito

### 1. Pacchetto sicurezza: ownership + validazione (righe #1, #2, #3 — ~1 giornata)
Senza ownership l'app è multi-utente solo di nome: ogni PM autenticato può leggere i dati finanziari di chiunque, riscrivere allocazioni altrui e **bloccare irreversibilmente baseline di altri** (non esiste unlock). Il fix è concentrato e a basso rischio: un middleware `requireProjectAccess` montato su `/api/projects/:id/*` (una query, ~30 righe), due clausole `AND project_id` in allocations/baseline, e uno schema zod sul PUT allocation. È il prerequisito per qualunque demo a più utenti — e il POC esiste proprio per essere mostrato.

### 2. Stabilità backend: transazioni + middleware (righe #4, #5 — ~2 ore)
Due bug che producono guasti *silenziosi*: il PUT baseline non è atomico (metà fasi aggiornate in caso di errore, con connessioni avvelenate nel pool che degradano tutto il backend nel tempo) e un'indisponibilità momentanea di Supabase lascia le richieste appese senza risposta. Entrambi i fix riusano codice già esistente (`withTransaction` è già usato correttamente in altri due router) — è il rapporto costo/beneficio migliore dell'intero backlog.

### 3. Catena di deploy Vercel (righe #6, #7 — ~1 ora + un deploy di verifica)
Il target dichiarato del POC è Vercel, ma oggi il deploy non funzionerebbe in due punti indipendenti: il backend non esporta l'handler (`app.listen` non viene servito in serverless) e il routing statico non ha fallback SPA (404 su qualsiasi refresh). Sono fix da poche righe; senza, ogni discussione su "proposta interna se il POC convince" resta teorica perché il POC non è mostrabile fuori da localhost. Includere nel deploy anche `pool.max` basso + connection pooler (#19).

### 4. Quick win igiene + bug utente (righe #8, #13, #14, #20, #22 — ~mezza giornata)
Cinque fix da minuti l'uno con impatto utente o di processo immediato: i redirect legacy che buttano l'utente sul portfolio (bug verificato live), `git rm --cached frontend/.env.local` prima che un `git add -A` committi le chiavi reali, il typo `spointer-events-none` che intercetta i click sul login, il doppio fetch in Avanzamento, e lo script `test` mancante che oggi tiene i test Vitest fuori da ogni pipeline (il guadagno di qualità è permanente: da qui in poi i test FE girano).

### 5. Matrice allocazioni: performance end-to-end (righe #9, #10 — ~1-2 giornate)
La matrice FTE è il cuore funzionale dell'app (è il motivo per cui esiste: sostituire l'Excel) ed è il punto peggiore su entrambi i lati: ~320 round-trip DB per salvataggio fase con lock trattenuti per tutta la durata (contesa tra PM concorrenti) e re-render O(celle²) a ogni keystroke lato client. Backend: fase e day-rate letti una volta + INSERT batch (da 320 a ~10 query). Frontend: `React.memo(FTECell)` + indice `Map` delle celle. Dopo questo intervento l'esperienza di editing regge matrici reali (10 risorse × 26 settimane) senza lag.

---

## Note di sequenza per il resto del backlog

- **#31 (layout route) prima di #33 (split god-file)**: il refactor delle route sposta codice che gli split toccherebbero di nuovo; nell'ordine inverso si lavora due volte. #31 risolve anche #8 in modo strutturale.
- **#12 (Modal condiviso) prima di #35 (design system)**: è il pattern duplicato con più valore unitario (a11y + animazioni + 6 file) e fa da pilota per Button/Input/Card.
- **#28/#29 (sessione + verifica JWT locale) insieme**: stesso file, stessa area di test; farli separati raddoppia il collaudo auth.
- **#18 (indici)** può entrare in qualsiasi momento come migrazione autonoma; conviene prima di demo con dati realistici.
- **#27 (CLAUDE.md)** da fare *dopo* le ondate di fix, in chiusura, così documenta lo stato finale e non uno intermedio.

---

*Fine audit — 6 step completati. Report: `report-step1-structure.md` · `report-step2-visual.md` ·
`report-step3-components.md` · `report-step4-performance.md` · `report-step5-security.md` ·
`report-step6-priority-matrix.md`.*
