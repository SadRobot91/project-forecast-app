# Report Step 3 — Component Architecture Audit (Frontend)

> Audit `project-forecast-app` — analisi statica dell'albero componenti React + 1 verifica
> empirica sull'app live. Data: 2026-06-12 · Nessuna modifica al codice.

**Impressione generale.** L'architettura dichiarata (Page → API module → apiClient → AuthContext)
è rispettata ovunque: nessuna pagina chiama `fetch` direttamente, i tipi di dominio sono
centralizzati e ben curati, `AuthContext` è pulito (gestisce anche il refresh token Supabase).
I problemi sono concentrati in tre aree: **file-pagina monolitici**, **assenza totale di
memoizzazione** in presenza di matrici di input, e **duplicazioni di logica** che hanno già
prodotto un bug reale (redirect legacy rotti, verificato live).

---

## 1. Decomposizione dei componenti (soglia segnale: 200 righe)

| Sev | File | Righe | Problema | Refactor suggerito |
|---|---|---|---|---|
| 🟡 | `Pianificazione.tsx` | 770 | God-file: contiene 4 componenti (`FasiTab` :55, `AddResourceModal` :259, `PhaseBlock` :329, pagina :532) per due feature distinte (editor baseline + matrice allocazioni). Qualsiasi modifica a una delle due passa da qui. | Cartella feature `pages/pianificazione/` con un file per componente; la pagina resta un orchestratore <100 righe. |
| 🟡 | `Gantt.tsx` | 728 | 8 componenti in un file: `TaskModal` :83, `WeekGrid` :289, `PhaseBar` :303, `TaskBar` :321, `PhasesView` :346, `FullView` :375, `MilestoneView` :480, pagina :547. Il modal task (200 righe, con validazione) merita un file proprio. | `pages/gantt/` con `TaskModal.tsx`, `views/*.tsx`, `bars.tsx`; costanti `WEEK_PX/ROW_PX/LABEL_W` in un `config.ts`. |
| 🟡 | `Avanzamento.tsx` | 456 | Problema opposto: **zero sub-componenti** — KPI card (4 blocchi quasi identici :253-278), progress bar, form e storico tutti inline in un'unica funzione con 13 `useState`. Le KPI card duplicano il `KPICard` già esistente in `Dashboard.tsx:19`. | Estrarre `KPICard` come componente condiviso (è già scritto, va solo spostato da Dashboard) + `SnapshotForm` e `SnapshotHistory`. |
| 🟢 | `Dashboard.tsx` | 426 | Decomposto correttamente in-file (`KPICard`, `PhaseBudgetTable`, `MilestoneTracker`, `PhaseFinancialsTable`) — serve solo lo split in file separati quando `KPICard` diventa condiviso. | Come sopra. |
| 🟢 | `Avanzamento.tsx:49` | — | Il file `Avanzamento.tsx` esporta `export default function Ongoing()` — stesso nome della pagina morta `Ongoing.tsx`. Confonde grep, devtools e import. | Rinominare in `Avanzamento`. |

---

## 2. Props drilling e gestione dello stato

Il drilling **in profondità** è quasi assente (max 2-3 livelli) — il vero smell è la **larghezza** delle interfacce e la duplicazione di stato:

| Sev | Dove | Problema | Suggerimento |
|---|---|---|---|
| 🟡 | `Pianificazione.tsx:40-53` → `FasiTab` | **12 props** (6 valori di stato + 6 callback), tutte pass-through dallo stato della pagina. Il tab non possiede nulla del proprio stato. | O `FasiTab` possiede lo stato baseline (la pagina passa solo `projectId` + callback `onSaved`), o un `useReducer` + context locale `PianificazioneProvider`. |
| 🟡 | `Pianificazione.tsx:331-348` (`PhaseBlock`) | **Anti-pattern "derived state from props"**: `phase.cells` e `phase.resources` copiati in `useState` e ri-sincronizzati con `useEffect` su cambio props. Doppia fonte di verità: a ogni `onSaved` → `loadAll` la risposta server sovrascrive eventuali modifiche locali non salvate di *altre* fasi aperte. | Stato locale solo per il delta non salvato (pattern draft), oppure key-remount: `<PhaseBlock key={phase.phase_id + ':' + version}>`. |
| 🟡 | `Gantt.tsx:375-381` (`FullView`) | 9 props posizionali; `onUpdateMilestone` attraversa pagina → `FullView`/`MilestoneView` → riga → `DateInput` (3 livelli). | Accettabile oggi; se il Gantt cresce, un `GanttContext` (projectStart, weeks, totalWidth, handlers) elimina 6 props da ogni vista. |
| 🟢 | `Pianificazione.tsx:553` (`crossTotals`) | Mappa cross-project calcolata a livello pagina e passata a ogni `PhaseBlock` → ricostruita con `getCrossProjectTotal` per cella. Drilling corto ma calcolo per-cella O(cells) dentro il render (vedi §3). | Spostare in `useMemo` indicizzato. |

Nota positiva: l'assenza di uno state manager globale (dichiarata in CLAUDE.md) **regge ancora** — l'unico stato davvero condiviso è auth, già in context. Non serve Redux/Zustand; serve disciplina sui reducer locali.

---

## 3. Pattern React mancanti o mal usati

### 🔴 3.1 — Zero memoizzazione nell'intera codebase
`grep useMemo|React.memo` → **0 occorrenze** in `frontend/src`. Nella maggior parte delle pagine è irrilevante, ma nella **matrice allocazioni** no:

- `PhaseBlock` (`Pianificazione.tsx:329`): ogni keystroke in un `FTECell` chiama `updateCell` → `setCells` → re-render dell'intera tabella della fase. Con 5 risorse × 20 settimane = 100 `FTECell`, ognuno dei quali ricalcola `getCell` e `getCrossProjectTotal` con `cells.find(...)` lineare → **O(celle²) per keystroke**, più 100 input DOM riconciliati.
- Fix mirato (non "memo ovunque"): `React.memo(FTECell)` + `onChange` stabile per cella + indicizzare `cells` in una `Map` con `useMemo`. Tre interventi, un solo file.
- Stesso tema in `Resources.tsx:117-123`: `getVisibleTotal` ricalcolato per ogni cella a ogni render del filtro.

(Cross-ref: impatto runtime quantificato nello Step 4.)

### 🟡 3.2 — Doppio fetch su cambio fase in Avanzamento
`Avanzamento.tsx:313-317`: l'`onChange` del selettore fase chiama `setSelectedPhaseId(val)` **e** `load(val)`. Ma `load` è un `useCallback` con dipendenza `selectedPhaseId` (:64-83) agganciato a `useEffect(() => { load(); }, [load])` (:85) → il cambio di stato rigenera `load` e il `useEffect` lo riesegue: **2 richieste API identiche per ogni cambio fase** (4 fetch contando le due chiamate `Promise.all`). In più l'effetto di auto-selezione (:161-165) causa un ulteriore doppio caricamento al mount. Fix: rimuovere la chiamata manuale `load(val)` e lasciare solo l'effetto, o viceversa togliere `selectedPhaseId` dalle deps.

### 🟡 3.3 — `useCallback` usato in modo incoerente
`Pianificazione.tsx` memoizza `updatePhase/updateContingency/updateName` (:604-614) ma non `handleSave/handleLock`; `Gantt.tsx` memoizza solo `load`. Senza `React.memo` sui figli, questi `useCallback` **non producono alcun beneficio** — è cargo cult. Decidere: o si introduce memo sui componenti costosi (3.1) e allora i callback memoizzati servono, o si tolgono.

### 🟢 3.4 — Minori
- `Gantt.tsx:19`: `TODAY` calcolato a livello modulo — la linea "Oggi" resta stale se la tab rimane aperta oltre mezzanotte.
- Modali renderizzati in-place senza `createPortal` — funziona con `fixed`, ma è fragile rispetto a stacking context futuri (es. il fade gradient `relative` delle tabelle).
- `Settings.tsx:71-74`: riordino fasi con `Promise.all` di 2 PATCH indipendenti — se il secondo fallisce gli ordini restano permanentemente scambiati a metà (manca endpoint atomico di reorder, cross-ref Step 5).
- `DateInput.tsx:29`: `requestAnimationFrame(() => ref.current?.blur())` — workaround non commentato (presumibilmente per chiudere il picker nativo); merita un commento sul perché.

---

## 4. Custom hooks — duplicazioni da estrarre

| Sev | Logica duplicata | Occorrenze | Hook/estrazione proposta |
|---|---|---|---|
| 🟡 | **Fetch lifecycle** `useState(data)+useState(loading)+useState(error)` + `useEffect` + `.then/.catch/.finally` | 7 pagine (`Projects.tsx:45-50`, `Dashboard.tsx:205-211`, `Pianificazione.tsx:558-602`, `Gantt.tsx:555-560`, `Avanzamento.tsx:64-85`, `Resources.tsx:89-91`, `Settings.tsx:31-38`) | `useFetch(fn, deps)` → `{ data, loading, error, reload }`. Elimina ~120 righe e uniforma la gestione errori (oggi 3 pagine su 7 **ignorano** l'errore di fetch: Gantt, Resources, Pianificazione mostrano spinner→pagina vuota). |
| 🟡 | **Inline edit con commit/escape** (autoFocus, onBlur commit, Enter/Escape) | `Pianificazione.tsx:59-69,144-167` e `Settings.tsx:40-62,176-196` — quasi identici | Componente `<EditableText value onCommit>` o hook `useInlineEdit`. |
| 🟡 | **Mock switch** `if (USE_MOCK) { await setTimeout; return MOCK_X }` | **34 occorrenze in 7 file api/** | Helper `withMock(mockFn, realFn)` oppure migrazione a MSW — un solo punto di intercettazione, le funzioni api tornano a 1 riga. |
| 🟡 | **Formattazione date** | 4 implementazioni: `Dashboard.tsx:13`, `Pianificazione.tsx:22` (variante `year: '2-digit'`), `Avanzamento.tsx:10-18` (+`fmtDateTime`), `Gantt.tsx:35` (`fmtShort`) | `utils/dates.ts` con `fmtDate/fmtDateShort/fmtDateTime` accanto a `formatCurrency` (che è già stato estratto correttamente — seguire quel precedente). |
| 🟢 | **Flash "✓ Salvato"** `setSaved(true); setTimeout(setSaved(false), 2500)` | `Pianificazione.tsx:389-390,634-635`, `Avanzamento.tsx:121-122` | `useSavedFlash()`. |
| 🟢 | **Semaforo FTE** | `FTECell.tsx:8-13` vs `Resources.tsx:8-13` (già flaggato in Step 2 §2.3) | `utils/fteSemaphore.ts`. |

---

## 5. React Router v6

### 🔴 5.1 — Redirect legacy rotti (bug verificato empiricamente sull'app live)
`App.tsx:60-62`:
```tsx
<Route path="/projects/:id/baseline"   element={<Navigate to="../pianificazione" replace />} />
```
In React Router v6 i path relativi risalgono la **gerarchia delle route**, non i segmenti URL. Queste route sono flat (figlie dirette della radice), quindi `..` risolve a `/` e il target diventa `/pianificazione`, che non esiste → cade nel catch-all `*` → `/projects`. **Test live**: `/projects/1/baseline`, `/projects/1/allocation`, `/projects/1/ongoing` → tutti atterrano su `/projects`, perdendo il progetto. Chi ha un vecchio bookmark non arriva mai alla pagina giusta. Fix: componente `LegacyRedirect` che usa `useParams` + `<Navigate to={`/projects/${id}/pianificazione`}>`, oppure annidare le route sotto `/projects/:id` (vedi 5.2, che lo risolve gratis).

### 🟡 5.2 — Nessuna layout route: `AppNav` e `ProtectedRoute` duplicati 8 volte
- `<ProtectedRoute>` wrappa ogni singola route (`App.tsx:19-78`) — l'idioma v6 è una wrapper route pathless con `<Outlet/>`.
- Ogni pagina monta `<AppNav projectId projectName>` da sé, e **ogni pagina ri-fetcha il nome progetto** solo per passarlo alla nav.
- Refactor combinato:
```tsx
<Route element={<RequireAuth/>}>           // pathless: token check + Outlet
  <Route element={<AppShell/>}>            // AppNav + <main> + Outlet
    <Route path="/projects" element={<Projects/>}/>
    <Route path="/projects/:id">           // ProjectLayout: fetch nome 1 volta
      <Route path="dashboard" element={<Dashboard/>}/>
      <Route path="pianificazione" element={<Pianificazione/>}/>
      ...
      <Route path="baseline" element={<Navigate to="../pianificazione" replace/>}/>  // ora ".." funziona
    </Route>
  </Route>
</Route>
```
Elimina ~40 righe in App.tsx, il fetch ripetuto del nome progetto, e corregge 5.1.

### 🟡 5.3 — Nessun code splitting
Tutte le 8 pagine sono import statici (`App.tsx:4-11`): bundle unico, l'utente che fa login scarica anche Gantt e Settings. `React.lazy` + `Suspense` per pagina è a costo quasi zero (il fallback `PageLoader` esiste già di fatto, vedi Step 2 §6.10). Quantificazione bundle nello Step 4.

### 🟢 5.4 — Data router
Si usa `BrowserRouter` classico, niente loader/action di `createBrowserRouter`. Per un POC va bene; i loader eliminerebbero il pattern fetch-in-useEffect (§4) ma è una migrazione, non un fix. Da valutare solo se si adotta `useFetch` comunque.

---

## 6. TypeScript strictness

| Sev | Dove | Problema | Fix |
|---|---|---|---|
| 🟡 | `types/index.ts:22` | `PhaseType = 'feasibility' \| … \| string` — l'unione con `string` **assorbe i letterali**: il tipo equivale a `string`, l'autocomplete e l'exhaustiveness check sono persi ovunque `PhaseType` è usato. | Se i tipi custom sono ammessi: `type PhaseType = KnownPhaseType \| (string & {})` (trucco branded per tenere l'autocomplete) o semplicemente `string` dichiarato onestamente. |
| 🟡 | `Dashboard.tsx:418` | `(data as any).tags ?? []` — `DashboardData` non ha `tags`, il cast nasconde il buco di contratto col backend: se il backend non manda `tags`, `SimilarProjects` riceve `[]` e scompare silenziosamente (è il `return null` di `SimilarProjects.tsx:16`). | Aggiungere `tags?: string[]` a `DashboardData` e rimuovere il cast. |
| 🟡 | `api/client.ts:31` | `return res.json() as Promise<T>` — nessuna validazione runtime: il tipo è una promessa non mantenuta su qualsiasi drift del backend (che non ha tipi condivisi — cross-ref Step 1 §3). | POC: accettabile. Primo passo economico: validare con zod solo le 2-3 risposte critiche (dashboard, allocation). |
| 🟢 | `Avanzamento.tsx:137,152`, `Settings.tsx:96` | `catch (e: any)` — `SlippageModal.tsx:31` mostra già il pattern corretto (`err instanceof Error`). | `catch (e: unknown)` + narrowing; oppure helper `errMessage(e)`. |
| 🟢 | `types/index.ts:88` | `MilestoneItem.status` ridefinisce inline `'not_started' \| 'in_progress' \| 'completed'` invece di riusare `TaskStatus`/`PhaseStatus` (identici, a loro volta duplicati tra loro a :24 e :253). | Un solo `type ProgressStatus`. |
| 🟢 | `AuthContext.tsx:18` | `JSON.parse(stored) as AuthUser` da localStorage senza guardia: un valore corrotto produce `user` malformato a runtime. | try/catch + fallback null. |

Nota positiva: nessun `any` nei componenti condivisi né nei moduli api; `strict: true` rispettato; le 7 occorrenze trovate sono tutte nei punti elencati sopra (2 delle quali nella pagina morta `Ongoing.tsx`).

---

## 7. Riepilogo severità

| Sev | Issue | File principali |
|---|---|---|
| 🔴 | Redirect legacy rotti — perdono il progetto, verificato live | `App.tsx:60-62` |
| 🔴 | Zero memoizzazione sulla matrice allocazioni (O(celle²) per keystroke) | `Pianificazione.tsx:329-528`, `FTECell.tsx` |
| 🟡 | God-file ×2 (770 e 728 righe) e pagina monolitica senza sub-componenti | `Pianificazione.tsx`, `Gantt.tsx`, `Avanzamento.tsx` |
| 🟡 | Derived-state-from-props in `PhaseBlock` (doppia fonte di verità) | `Pianificazione.tsx:331-348` |
| 🟡 | Doppio fetch su cambio fase | `Avanzamento.tsx:64-85,313-317` |
| 🟡 | Nessuna layout route: AppNav+ProtectedRoute duplicati 8×, nome progetto ri-fetchato per pagina | `App.tsx`, tutte le pagine |
| 🟡 | Nessun code splitting | `App.tsx:4-11` |
| 🟡 | 4 famiglie di logica duplicata (fetch lifecycle, inline edit, mock switch ×34, date ×4) | vedi §4 |
| 🟡 | `PhaseType` assorbito da `string`; `as any` su tags; fetch error ignorato in 3 pagine | `types/index.ts:22`, `Dashboard.tsx:418` |
| 🟢 | 8 rilievi minori (TODAY stale, no portal, reorder non atomico, catch any, JSON.parse non guardato, naming `Ongoing`, useCallback cargo-cult, FasiTab 12 props) | vari |

**Ordine di attacco consigliato** (dettaglio nello Step 6): prima il fix dei redirect (5 righe, bug utente reale), poi layout route (che semplifica tutto il resto), poi memoizzazione mirata della matrice, infine gli split dei god-file — che convengono *dopo* la layout route per non spostare codice due volte.

---

*Fine Step 3 — in attesa di conferma per procedere allo Step 4 (Performance Audit FE+BE).*
