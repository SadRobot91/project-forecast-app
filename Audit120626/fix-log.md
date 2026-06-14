# Fix Log

> Changelog dei fix applicati in Fase 2. Formato: `[stepN] filepath:line — descrizione`.

[step5] backend/src/middleware/requireProjectAccess.ts:1 — NUOVO: middleware object-level authorization per /api/projects/:id/* (PM solo sui propri progetti, DM su tutti; 404 per non confermare l'esistenza; pass-through su :id non numerici come /similar)
[step5] backend/src/index.ts:28 — guard requireAuth+requireProjectAccess montato una volta sul prefisso /api/projects/:id; rimossi i requireAuth ridondanti dai mount figli (coperti dal guard)
[step5] backend/src/middleware/requireAuth.ts:13 — try/catch sull'intero corpo async: errori Supabase/DB ora rispondono 500 invece di lasciare la richiesta appesa (cross-ref step4 B1)
[step5] backend/src/middleware/requireAuth.ts:8 — bypass test gated su NODE_ENV='test' AND JEST_WORKER_ID: chiusa la potenziale backdoor da NODE_ENV errato in produzione
[step5] backend/src/middleware/requireAuth.ts:6 — idempotenza (req.auth presente → next): elimina i 2-3 round-trip Supabase duplicati per richiesta causati dai mount Express sovrapposti
[step5] backend/src/routes/allocations.ts:165-189 — validazione completa del body PUT /allocation: phase_id intero, allocations array, resource_id intero, week_start data ISO valida, fte numerico 0..1 (prima: nessuna validazione, body malformato → 500)
[step5] backend/src/routes/allocations.ts:192-200 — verifica ownership fase→progetto prima della transazione: impedisce INSERT di AllocationEntry cross-progetto (corruzione budget di fase altrui)
[step5] backend/src/routes/baseline.ts:176-199 — AND project_id sulle due UPDATE "ProjectPhase" + 404 con ROLLBACK se la fase non appartiene al progetto (prima: phase_id arbitrario modificava fasi di qualsiasi progetto)
[step5] backend/src/routes/phases.ts:110-113 — AND project_id anche sull'UPDATE finale (coerenza con il check di ownership già presente in lettura)
[step5] backend/src/routes/auth.ts:48-71 — logout reale: revoca i refresh token via supabase.auth.admin.signOut(jwt utente); prima chiamava signOut() sul client service-role (no-op). Nota: l'access token resta valido fino a scadenza (JWT stateless)
[step5] backend/src/routes/{auth,projects,dashboard,baseline,allocations,gantt,phases,resources,knowledge}.ts — 27 occorrenze di `err.message` nel body dei 500 sostituite con 'Internal server error' generico; aggiunto console.error dove mancava (knowledge.ts, auth.ts)
[step5] frontend/.env.local — `git rm --cached`: untracked dall'indice (resta su disco, da ora vale .gitignore:21; history verificata pulita, solo placeholder)
[step5] backend/src/routes/routes.test.ts:172,197,1215 — mock sequence aggiornate per la nuova query di ownership fase nel PUT allocation (3 test)
[step5] backend/src/routes/routes.test.ts:1007,1029 — mock UPDATE ProjectPhase con rowCount=1 per il nuovo check di appartenenza nel PUT baseline (2 test)
[step5] backend/src/routes/routes.test.ts:216-329 — NUOVI: 10 test di regressione security (5 su validazione/ownership PUT allocation, 5 sul middleware requireProjectAccess)
[step4] backend/src/routes/baseline.ts:172-227 — PUT migrato a withTransaction: prima BEGIN/COMMIT via pool.query finivano su connessioni diverse (nessuna atomicità, connessioni idle-in-transaction)
[step4] backend/src/routes/baseline.ts:240-256 — lock: rimosso BEGIN/COMMIT esplicito attorno al singolo INSERT ON CONFLICT (atomico di suo); rimosso il ROLLBACK orfano nel catch
[step4] backend/src/services/allocationAggregator.ts:86-127 — NUOVO getWeeklyTotalsBatch: SUM FTE per N coppie (resource, week) in una query via UNNEST (resta nel servizio SSoT)
[step4] backend/src/routes/allocations.ts:40-63 — calculatePhaseWeekWorkingDays trasformata in funzione pura phaseWeekWorkingDays: la fase è letta una volta per richiesta invece che dal DB per ogni cella
[step4] backend/src/routes/allocations.ts:236-275 — PUT allocation de-N+1: check cap FTE in batch (canAllocate solo nel ramo errore per il breakdown), day_rate con un solo SELECT ANY, INSERT multi-riga; da ~320 a ~7 query per salvataggio di una fase da 100 celle
[step4] backend/src/middleware/requireAuth.ts:6-33 — cache token→auth con TTL 60s (max 500 entry): elimina il round-trip HTTP a Supabase (~100-300ms) e la query User per ogni richiesta; trade-off documentato: revoca effettiva entro 60s
[step4] backend/src/index.ts:24-31 — CORS da wildcard ad allowlist via CORS_ORIGIN (default http://localhost:5173)
[step4] backend/src/index.ts:55-63 — export default app + listen solo se require.main === module: il backend è ora servibile da @vercel/node (cross-ref step1 §4.3)
[step4] backend/src/db/index.ts:6-12 — Pool con max configurabile via PG_POOL_MAX (note serverless/pooler nel commento e in .env.example)
[step4] backend/src/routes/projects.ts:63-71 — LEFT JOIN LATERAL ... LIMIT 1 per la fase corrente: eliminata la riga progetto duplicata con 2+ fasi in_progress (e il GROUP BY)
[step4] backend/src/routes/projects.ts:77-100 — giorni rimanenti con calculateNetworkDays + festività IT (caricate una volta, lazy): prima un loop giorno-per-giorno contava solo i weekend e divergeva dalla Dashboard
[step4] backend/src/db/migrations/014_core_indexes.sql — NUOVA migrazione: 5 indici FK core (AllocationEntry project/phase/resource+week, ProjectPhase project, GanttTask project+milestone); applicata al DB locale direttamente (runner bloccato da 013 pre-esistente, vedi note)
[step4] backend/.env.example — aggiunte PG_POOL_MAX e CORS_ORIGIN documentate
[step4] frontend/src/App.tsx:1-30 — code splitting: tutte le 8 pagine in React.lazy + Suspense con PageLoader; bundle da 1 chunk di 508 kB a entry 6.7 kB + vendor 164 kB (cacheabile) + supabase 207 kB + chunk pagina 4-25 kB
[step4] frontend/vite.config.ts:7-19 — manualChunks vendor (react/react-dom/router) e supabase
[step4] frontend/src/pages/Pianificazione.tsx:320-338 — NUOVO AllocCell memoizzato (props primitive + callback stabile): un keystroke re-renderizza solo la cella editata invece dell'intera matrice
[step4] frontend/src/pages/Pianificazione.tsx:385-430 — cellMap/savedFteMap con useMemo (lookup O(1), prima .find() lineare per cella) + updateCell in useCallback
[step4] frontend/src/pages/Avanzamento.tsx:313-320 — rimosso load(val) manuale nel cambio fase: il solo setState innesca l'effetto (prima 2 fetch identici per cambio)
[step4] backend/src/routes/routes.test.ts — aggiornate le sequenze mock di PUT allocation (3 test, nuovo flusso batch), PUT baseline (2 test, no BEGIN/COMMIT) e lock (1 test); aggiunto mock getWeeklyTotalsBatch
[step1] vercel.json:14-31 — fallback SPA: /assets e file statici serviti da frontend/, qualsiasi altra path → frontend/index.html (prima: 404 su refresh/deep-link di ogni route client)
[step1] frontend/src/pages/{Allocation,Baseline,Ongoing}.tsx — ELIMINATE: 3 pagine morte (~1.100 righe), non importate da nessun file (verificato); sostituite da Pianificazione/Avanzamento
[step1] frontend/package.json:9-10 — aggiunti script "test": "vitest run" e "test:watch": i test FE ora girano da pipeline (12/12 verdi alla prima esecuzione)
[step1] CLAUDE.md — riallineato integralmente al codice: middleware auth/ownership, knowledge graph, embeddings/intelligence provider, phaseFinancialEngine, migrazioni 001-014 (prossima 015), pagine/componenti correnti, convenzione 500 generico + withTransaction obbligatorio, env PG_POOL_MAX/CORS_ORIGIN, roadmap aggiornata con rimandi a priority matrix e report-decisions; rimossi i riferimenti a file inesistenti (NEXT_STEPS.md, PROMPT.md) e la nota sul test intenzionalmente failing (oggi 252/252 verdi)
[step1] (cross-ref) frontend/.env.local untracked → già applicato in [step5]; export default app per Vercel → già applicato in [step4]
[step3] frontend/src/App.tsx — layout route annidate: <RequireAuth> pathless (token check 1 volta) → <ProjectLayout> (AppNav montata 1 volta per /projects/:id) → tab figlie; redirect legacy ora figli di /projects/:id, quindi ".." preserva l'id (prima /projects/1/baseline|allocation|ongoing cadevano sul catch-all → /projects, perdendo il progetto — bug verificato live nel report)
[step3] frontend/src/components/RequireAuth.tsx — NUOVO: sostituisce ProtectedRoute (wrapper per-route ×8) con una sola layout route pathless + <Outlet/>
[step3] frontend/src/components/ProjectLayout.tsx — NUOVO: AppNav unica per le tab di progetto; il nome progetto è pubblicato dalle pagine via context (useSetProjectName) invece di ri-fetcharlo in ogni pagina solo per la nav
[step3] frontend/src/components/ProtectedRoute.tsx — ELIMINATO: assorbito da RequireAuth (layout route v6)
[step3] frontend/src/pages/Pianificazione.tsx (770 righe) → cartella pages/pianificazione/: index.tsx (orchestratore), FasiTab.tsx (memo), PhaseBlock.tsx, AddResourceModal.tsx — god-file diviso per i due domini (baseline editor + matrice allocazioni)
[step3] frontend/src/pages/Gantt.tsx (728 righe) → cartella pages/gantt/: index.tsx, TaskModal.tsx, bars.tsx (WeekGrid/PhaseBar/TaskBar), config.ts (WEEK_PX/ROW_PX/LABEL_W/helpers), views/{PhasesView,FullView,MilestoneView}.tsx
[step3] frontend/src/pages/Avanzamento.tsx (456 righe) → cartella pages/avanzamento/: index.tsx, SnapshotForm.tsx, SnapshotHistory.tsx; le 4 KPI card inline ora usano KPICard condiviso; export rinominato da Ongoing() ad Avanzamento() (prima collideva col nome della pagina morta)
[step3] frontend/src/components/KPICard.tsx — NUOVO: estratto da Dashboard.tsx e condiviso con Avanzamento (prima duplicato)
[step3] frontend/src/pages/pianificazione/PhaseBlock.tsx:53-60 — guardia anti data-loss: il sync da props salta se la fase ha edit non salvati (dirty), così il loadAll dopo il salvataggio di un'altra fase non sovrascrive le modifiche aperte (cross-ref D3)
[step3] frontend/src/pages/pianificazione/PhaseBlock.tsx — memoizzazione matrice isolata nel componente: AllocCell memoizzata + cellMap/savedFteMap useMemo (lookup O(1)) + updateCell useCallback (un keystroke re-renderizza la sola cella, non O(celle²))
[step3] frontend/src/pages/avanzamento/index.tsx:64-85 — doppio fetch su cambio fase eliminato: il select aggiorna solo selectedPhaseId, l'effetto fa l'unico reload (prima onChange chiamava anche load(val) → 2 fetch identici)
[step3] frontend/src/hooks/useFetch.ts — NUOVO: useFetch(fn, deps) → { data, loading, error, reload }; adottato in Dashboard, Gantt, Resources — uniforma il lifecycle e NON inghiotte più gli errori (prima Gantt/Resources: spinner → pagina vuota su errore); Pianificazione/Avanzamento (Promise.all) hanno ora catch con messaggio + retry
[step3] frontend/src/api/mock.ts — NUOVO: withMock(mockFn, realFn) — singolo punto di intercettazione mock; le 34 occorrenze di `if (USE_MOCK) { setTimeout… }` nei 7 moduli api/ collassate in una chiamata per funzione
[step3] frontend/src/api/{projects,auth,baseline,gantt,ongoing,phaseTemplates,allocation}.ts — migrati a withMock
[step3] frontend/src/utils/dates.ts — NUOVO: fmtDate/fmtDateShort/fmtDayMonth/fmtDateTime — sostituite le 4 implementazioni duplicate (Dashboard, Pianificazione, Avanzamento, Gantt)
[step3] frontend/src/pages/Resources.tsx — getVisibleTotal indicizzato in una Map via useMemo (prima filter+reduce per cella a ogni render); useFetch con stato d'errore + retry
[step3] frontend/src/types/index.ts:22 — PhaseType = KnownPhaseType | (string & {}): le fasi custom non assorbono più i letterali noti, autocomplete/exhaustiveness ripristinati
[step3] frontend/src/types/index.ts — DashboardData.tags?: string[] aggiunto; rimosso il cast `(data as any).tags` in Dashboard.tsx
[step3] backend/src/routes/dashboard.ts:18,103 — la GET dashboard ora restituisce `tags` (SELECT name, tags + tags: rows[0].tags ?? []): SimilarProjects riceve i tag reali invece di [] silenzioso (chiuso il buco di contratto che il cast `as any` nascondeva)
[step3] (deferred) D3 aggiornata in report-decisions.md: prerequisito PhaseBlock sciolto + data-loss chiuso; resta da decidere solo l'eliminazione dei 3 GET post-save (staleness budget di fase)
[step3] (skip) inline-edit (FasiTab vs Settings) non estratto: forme diverse (Record multi-riga a 1 campo vs riga singola a 2 campi), hook condiviso sarebbe astrazione forzata; 🟢 minori (TODAY stale, no portal, reorder non atomico, catch any, JSON.parse non guardato) saltati come da protocollo
[step2] frontend/src/components/Modal.tsx — NUOVO: scaffold modale condiviso con role="dialog" + aria-modal + aria-labelledby, chiusura con Escape, focus trap su Tab, focus iniziale dentro al modale (lo toglie dalla pagina sotto), animazione d'ingresso e ✕ con aria-label; risolve in un colpo le 6 implementazioni duplicate prive di a11y (report Step 2 §4/§6 #1)
[step2] frontend/src/components/{ConfirmModal,RetrospectiveModal,SlippageModal}.tsx + pages/pianificazione/AddResourceModal.tsx + pages/gantt/TaskModal.tsx + pages/Projects.tsx (scoping) — i 6 modali migrati a <Modal>: rimossi gli scaffold fixed/backdrop duplicati e i ✕ senza aria-label
[step2] frontend/tailwind.config.js — keyframes+animation `fade-in`/`modal-in` native (niente plugin tailwindcss-animate da installare): le animazioni d'ingresso dei modali, prima morte (classi `animate-in fade-in zoom-in-95` del plugin assente), ora funzionano
[step2] frontend/src/components/Alert.tsx — NUOVO: banner di stato condiviso (tone error/warning/info, role="alert", raggio uniforme rounded-xl); adottato in Login e RetrospectiveModal — fixa l'incoerenza rounded-lg vs rounded-xl (report Step 2 §6 #7)
[step2] frontend/src/utils/fteSemaphore.ts — NUOVO: logica semaforo FTE unica (fteLevel/fteMeta) con icona + aria-label + classi; FTECell e Resources ora la riusano (prima 2 implementazioni divergenti, report §2.3); aggiunto aria-label/role="img" sugli emoji per gli screen reader
[step2] frontend/tailwind.config.js — aggiunto colore palette `milestone: #fb923c` + token shadow `glow-accent-strong`
[step2] frontend/src/pages/gantt/{bars,TaskModal,index,views/FullView,views/MilestoneView}.tsx + pages/Dashboard.tsx — le milestone ◆ da `text-orange-400` (fuori palette) a `text-milestone`; coerenza Gantt↔Dashboard (prima la Dashboard usava text-primary, report §2.1)
[step2] frontend/src/pages/Login.tsx:49 — classe rotta `spointer-events-none` → `pointer-events-none`: il blob decorativo in alto a sinistra non intercetta più i click
[step2] frontend/src/pages/Login.tsx:67,122 — `border-white/8` (step opacità inesistente in TW3) → `border-white/10`; glow hardcoded `shadow-[0_...]` → token `shadow-glow-accent`/`shadow-glow-accent-strong`; error alert → <Alert>
[step2] frontend/src/components/SlippageModal.tsx — `accent-[#6c63ff]` (hex hardcoded) → `accent-accent`
[step2] frontend/src/pages/Projects.tsx:22 — stato on_hold da `yellow-400` (Tailwind) a `rag-yellow` (token di palette, coerente col resto)
[step2] frontend/src/pages/Projects.tsx — empty-state filtri: stato raw inglese ("active") → STATUS_LABEL italiano; gestito anche il caso filter='all'
[step2] frontend/src/pages/Dashboard.tsx — rimossa la ridondanza KPI: card "Previsione (EAC)" ora mostra "% del BAC" invece di duplicare lo Scostamento della card accanto; card "Budget" → "Budget (BAC)" con sub "budget di riferimento" per spiegare la differenza col totale live della tabella
[step2] frontend/src/pages/pianificazione/FasiTab.tsx + pages/avanzamento/index.tsx — header azioni con `flex-wrap gap-3`: su mobile testo e bottoni non si comprimono più (report §1)
[step2] frontend/src/pages/avanzamento/SnapshotForm.tsx — etichetta "auto" da `text-accent/60 text-[10px]` (sotto 3:1) a `text-text-muted` (report §2.4)
[step2] frontend/index.html — `lang="en"` → `lang="it"` (screen reader); aggiunto `<link rel="icon">` → public/favicon.svg (NUOVO, logo bar-chart) — risolve il 404 favicon in console (report §2.5)
[step2] frontend/src/hooks/useMediaQuery.ts — NUOVO: hook reattivo a media query; usato in Gantt per ridurre LABEL_W (228→140) sotto md, dove la colonna label fissa mangiava ~58% dello schermo (report §5); labelW passato a PhasesView/FullView/MilestoneView
[step2] frontend/src/pages/{pianificazione/PhaseBlock,pianificazione/FasiTab,Resources}.tsx — avvisi mobile (md:hidden) sulle 3 tabelle larghe: la matrice FTE (🔴 inutilizzabile sotto md) ha un banner giallo "ruota/scorri", Fasi e Registro un hint di scroll orizzontale (report §5)
[step2] frontend/src/pages/pianificazione/index.tsx — legenda semafori FTE con `flex-wrap` (prima si comprimeva su mobile)
[step2] (deferred) D5 in report-decisions.md: estrazione design system (Button/Input/Card/SegmentedControl, ~50 call-site) — applicate solo Modal+Alert (leva alta, basso rischio), il resto è un task dedicato con review visiva
[step2] (skip) 🟢 minori (max-w-page non standardizzato, gutter px-4 sm:px-6 sui <main>, space-y verticale variabile, scala H1 3xl/2xl, soglie BudgetBar Avanzamento, skeleton, fade sempre visibile) saltati come da protocollo
