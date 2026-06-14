# Report Step 2 — Visual & Layout Audit (Frontend)

> Audit `project-forecast-app` — analisi statica del codice + screenshot reali catturati
> su `http://localhost:5173` (login `test@test.it`) con Playwright, viewport **1366×850** e **390×844**.
> Data: 2026-06-12 · Nessuna modifica al codice.

**Impressione generale:** il tema dark è curato e sorprendentemente coerente per un POC.
Palette centralizzata in `tailwind.config.js`, scrollbar custom, `color-scheme: dark` per i
date-picker nativi, sticky column + fade gradient sulle tabelle larghe. I problemi reali sono:
**duplicazione massiccia di pattern Tailwind** (nessun componente Button/Input/Card/Modal),
**responsive incompleto** fuori dalla Dashboard, e una manciata di **classi rotte o morte**.

---

## 1. Layout consistency

| Sev | Dove | Problema | Fix suggerito |
|---|---|---|---|
| 🟢 | `Gantt.tsx:629` vs tutte le altre pagine | Container `max-w-[1600px]` mentre il resto usa `max-w-7xl` (1280px); Settings e Dashboard "stato A" usano `max-w-3xl`. Scelta probabilmente deliberata per il Gantt, ma non documentata. | Definire 2 larghezze standard (`page` e `page-wide`) come convenzione. |
| 🟢 | `AppNav.tsx:62` (`px-4 sm:px-6`) vs `Projects.tsx:111` e tutti i `<main>` (`px-6`) | Su mobile il gutter della nav (16px) non è allineato a quello del contenuto (24px) — visibile negli screenshot mobile. | Uniformare a `px-4 sm:px-6` anche nei `<main>`. |
| 🟢 | `Dashboard.tsx:283` (`space-y-8`), `Pianificazione.tsx:681` (`space-y-6`), `Gantt.tsx:629` (`space-y-5`) | Ritmo verticale tra sezioni diverso in ogni pagina. | Standardizzare a `space-y-6`. |
| 🟡 | `Pianificazione.tsx:88-108` | Header azioni `flex items-start justify-between` senza `flex-wrap`: su mobile il testo descrittivo si comprime a colonna stretta accanto ai bottoni "Salva"/"Blocca Baseline" (visibile nello screenshot mobile, layout sbilanciato). | Aggiungere `flex-wrap gap-3` come già fatto in `Gantt.tsx:632`. |
| 🟡 | `Avanzamento.tsx:227-243` | Stesso pattern: header titolo + bottone "Sync da Keyedin" senza `flex-wrap`. | Come sopra. |

---

## 2. Coerenza tema dark

### 🟡 2.1 — Classi fuori palette (token duplicati o hardcoded)
La palette custom esiste ma viene aggirata in più punti:

| Dove | Classe | Problema |
|---|---|---|
| `Login.tsx:122` | `shadow-[0_4px_20px_rgba(108,99,255,0.4)]` + hover arbitrario | Duplica il token `shadow-glow-accent` già definito in `tailwind.config.js:28` con valori leggermente diversi. |
| `Login.tsx:67` | `shadow-[0_8px_40px_rgba(108,99,255,0.12)]` | Idem — terza variante dello stesso glow. |
| `SlippageModal.tsx:60` | `accent-[#6c63ff]` | Hex hardcoded; in `Gantt.tsx:190` lo stesso caso usa correttamente `accent-accent`. |
| `Projects.tsx:22` | `border-yellow-400/40 text-yellow-400` per stato `on_hold` | Usa il giallo di Tailwind invece del token `rag-yellow` usato ovunque altrove. |
| `Gantt.tsx:192,326,423,501,521,657` | `text-orange-400` per le milestone | Colore semantico "milestone" non esiste in palette; inoltre in `Dashboard.tsx:142` la stessa milestone "◆" è renderizzata in `text-text-primary` — iconografia incoerente tra Dashboard e Gantt. Fix: aggiungere `milestone: '#fb923c'` alla palette e usarlo in entrambi. |

### 🟡 2.2 — Classi Tailwind rotte o morte (silenziosamente senza effetto)
1. **`Login.tsx:49`** — typo **`spointer-events-none`** sul primo blob decorativo: la classe non esiste, quindi il div `w-96 h-96` in alto a sinistra **intercetta i click** nell'angolo superiore della pagina di login. Fix: `pointer-events-none` (il secondo blob a riga 50 è corretto).
2. **`Login.tsx:67`** — `border-white/8`: `/8` non è uno step di opacità valido in Tailwind 3 (scala a step di 5), la classe non viene generata e il bordo della card cade sul colore di default. Fix: `border-white/10` o `border-border`.
3. **`ConfirmModal.tsx:21`, `Projects.tsx:219`, `RetrospectiveModal.tsx:60`, `SlippageModal.tsx:41`** — `animate-in fade-in zoom-in-95`: sono classi del plugin **`tailwindcss-animate`, che non è installato** (`tailwind.config.js:34` → `plugins: []`). Le animazioni di ingresso dei modali **non esistono** — i modali appaiono di colpo. Fix: installare il plugin o rimuovere le classi morte. Nota: `AddResourceModal` (`Pianificazione.tsx:276`) e `TaskModal` (`Gantt.tsx:155`) non hanno nemmeno le classi → incoerenza doppia.

### 🟡 2.3 — Semafori a emoji duplicati e divergenti
La logica del semaforo FTE è implementata **due volte**: `FTECell.tsx:8-13` (`getSemaphore`) e `Resources.tsx:8-13` (`fteSemaphore`), con la stessa semantica ma codice diverso — rischio di divergenza al primo ritocco. Anche la **legenda** è duplicata con wording diverso: `Pianificazione.tsx:733-735` ("🟡 Sottoutilizzo <0.8 FTE") vs `Resources.tsx:201-204` ("🟡 1–79% sottoutilizzo"). Inoltre gli emoji (⚪🟡✅🔴) rendono in modo diverso tra OS e non sono leggibili da screen reader. Fix: estrarre `utils/fteSemaphore.ts` + componente `FTEBadge` con pallini colorati CSS e `aria-label`.

### 🟢 2.4 — Contrasti
Complessivamente buoni (verificati sugli screenshot): `text-dim #8896aa` su `base #0f0f1a` ≈ 6:1, ok anche a `text-xs`. Unico punto debole: **`Avanzamento.tsx:362,381`** — etichetta "auto" in `text-accent/60 text-[10px]`: accent al 60% di opacità a 10px scende sotto 3:1. Fix: `text-accent` pieno o `text-text-muted`.

### 🟢 2.5 — `index.html:2`
`lang="en"` ma l'intera UI è in italiano → screen reader pronunciano l'italiano con fonetica inglese. Fix: `lang="it"`. Manca inoltre un `<link rel="icon">`: il 404 in console rilevato durante la sessione Playwright è quasi certamente la favicon.

---

## 3. Tipografia

| Sev | Dove | Problema | Fix |
|---|---|---|---|
| 🟢 | `Projects.tsx:114`, `Login.tsx:60` (`text-3xl`) vs `Dashboard.tsx:288`, `Pianificazione.tsx:684`, `Gantt.tsx:634`, `Avanzamento.tsx:229`, `Resources.tsx:136`, `Settings.tsx:143` (`text-2xl`) | Scala H1 incoerente: Portfolio e Login usano 30px, tutte le pagine interne 24px. | Decidere una scala: `text-3xl` per le pagine top-level, `text-2xl` per le pagine di progetto — e documentarla. |
| 🟢 | `Pianificazione.tsx:236` (`text-xl`) vs `:240` (`text-2xl`) | Le due summary card affiancate ("Budget Totale" / "Baseline Total Forecast") usano due taglie diverse per lo stesso tipo di KPI. Negli screenshot l'asimmetria si nota. | Allineare; se l'enfasi sul forecast è voluta, basta già il colore accent + glow. |
| 🟢 | `frontend/index.html:9` | Inter caricato da Google Fonts solo nei pesi 400–700 ✅, ma il `<link>` è render-blocking e senza `font-display` di fallback gestito (lo `swap` c'è nella query, ok). Nessuna azione urgente. | Eventuale self-hosting in fase di hardening. |
| 🟢 | Tutto il progetto | La gerarchia si regge quasi solo su `text-xs`/`text-sm` + colore (`text-primary`/`muted`/`dim`): funziona, ma è fragile — non esiste una scala documentata. | Definire 4 livelli tipografici riusabili (`@apply` o componenti `Heading`/`Label`). |

---

## 4. Gerarchia visiva

**Promossa nel complesso** (verificato su screenshot): KPI card distinguibili, RAG banner con gradiente efficace, CTA primarie (accent pieno + testo bianco) ben separate dalle secondarie (outline). Rilievi:

| Sev | Dove | Problema | Fix |
|---|---|---|---|
| 🟡 | `Dashboard.tsx:311-316` | **Ridondanza KPI**: "Previsione" mostra come sottotitolo "Scostamento: X" e la card accanto è interamente dedicata a "Scostamento" con lo stesso valore — 2 delle 6 card dicono la stessa cosa (visibile nello screenshot desktop). | Sostituire il sub della card Previsione con altro (es. % EAC vs BAC). |
| 🟡 | Screenshot desktop Dashboard | La card KPI "Budget" mostra **64.600 £** mentre il TOTALE della tabella "Budget per Fase" mostra **66.600 £** nella stessa schermata, senza alcuna spiegazione (BAC bloccato vs somma live). Per l'utente è un'incoerenza visiva. | Etichettare la card come "Budget (BAC bloccato)" o aggiungere tooltip. (Cross-ref: la causa dati va in Step 4/5.) |
| 🟡 | `Projects.tsx:208` | Empty state filtri: `{filter === 'on_hold' ? 'In pausa' : filter}` stampa lo **stato raw inglese** dentro la frase italiana → "Nessun progetto con stato \"active\"". | Usare `STATUS_LABEL[filter]`. |
| 🟡 | Tutti i 6 modali (`ConfirmModal.tsx:16`, `Pianificazione.tsx:274`, `Gantt.tsx:153`, `Projects.tsx:217`, `RetrospectiveModal.tsx:57`, `SlippageModal.tsx:38`) | Nessun `role="dialog"`, `aria-modal`, focus-trap o chiusura con `Escape`. Tastiera: il focus resta sulla pagina sottostante. | Risolvibile con un unico componente `Modal` condiviso (vedi §6). |
| 🟢 | `Pianificazione.tsx:314`, `Gantt.tsx:281` | Bottoni di chiusura "✕" senza `aria-label`. | `aria-label="Chiudi"` (in `SimilarProjects.tsx:50` è fatto correttamente). |
| 🟢 | `BudgetBar.tsx:8-9` vs `Avanzamento.tsx:286,292` | Soglie colore diverse per lo stesso concetto: BudgetBar vira al giallo a >105% e al rosso a >115% (coerente con RAG), la barra di Avanzamento a >70% e >90%. Due messaggi semantici diversi per "utilizzo budget". | Unificare su soglie RAG, riusando `BudgetBar`. |

---

## 5. Responsive

**Verificato empiricamente a 390×844.** La strategia esiste (AppNav con drawer hamburger ben fatto, Dashboard con vista card mobile dedicata `Dashboard.tsx:33-67`, KPI grid `grid-cols-2 sm:grid-cols-3 xl:grid-cols-6`) ma copre solo metà dell'app:

| Sev | Dove | Problema | Fix |
|---|---|---|---|
| 🔴 | `Pianificazione.tsx:437-493` (matrice allocazioni) | Su mobile la matrice FTE è **di fatto inutilizzabile**: celle `min-w-[72px]` × N settimane + colonna sticky, in 390px si vedono ~2 settimane e l'input numerico è minuscolo (screenshot `mobile-03b`). Nessuna alternativa mobile. | Minimo: messaggio "ruota il dispositivo / usa desktop"; meglio: vista a elenco per risorsa. |
| 🟡 | `Pianificazione.tsx:125` (`min-w-[960px]`) | Tabella Fasi & Date tagliata a metà colonna "Fine" su mobile (screenshot `mobile-03`); lo scroll orizzontale c'è ma senza vista card come quella che la Dashboard già possiede per la stessa tabella. | Replicare il pattern mobile-card di `Dashboard.tsx:33-67`. |
| 🟡 | `Gantt.tsx:18` (`LABEL_W = 228`) | Su 390px la colonna label fissa consuma il 58% dello schermo: restano ~2 settimane di timeline visibili (screenshot `mobile-04`). | Ridurre `LABEL_W` sotto `md:` (es. 140px) o renderla collassabile. |
| 🟡 | `Resources.tsx:208-234` | Registro Risorse: stessa situazione della matrice — tabella settimanale con sola colonna sticky, nessuna strategia mobile. | Come sopra. |
| 🟢 | `Pianificazione.tsx:728-737` | La legenda semafori (`flex gap-4`) non ha `flex-wrap`: su mobile i 3 item si comprimono. | `flex-wrap`. |
| 🟢 | Breakpoint usage generale | Si usano solo `sm`/`md`/`lg`/`xl` in modo sparso; nessun uso di `md:` per tablet sulle tabelle (792–1024px ha lo stesso problema del mobile sulle matrici larghe). | Audit dedicato a 768px dopo i fix mobile. |

---

## 6. Pattern Tailwind ripetuti → candidati a componente condiviso o `@apply`

Questa è la **principale fonte di rischio visivo** del progetto: lo stile è coerente oggi solo per disciplina copia-incolla. Conteggi per occorrenze verificate via grep:

| # | Pattern | Occorrenze | Dove (esempi) | Estrazione consigliata |
|---|---|---|---|---|
| 1 | **Modal scaffold** `fixed inset-0 z-50 … bg-black/60 backdrop-blur-sm … bg-surface border border-border rounded-2xl shadow-card p-6 max-w-md mx-4` | 6 | `ConfirmModal.tsx:16-21`, `Pianificazione.tsx:274-276`, `Gantt.tsx:153-155`, `Projects.tsx:217-219`, `RetrospectiveModal.tsx:57-60`, `SlippageModal.tsx:38-41` | 🔴 `<Modal>` condiviso — risolve in un colpo solo anche accessibilità (§4) e animazioni morte (§2.2) |
| 2 | **Input testo/numero** `w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent` | ~15 | `Gantt.tsx:168,180,206,246`, `Avanzamento.tsx:318-389`, `Projects.tsx:229,242`, `Settings.tsx:248,256`, `Pianificazione.tsx:303-307` | 🟡 `<TextInput>` / `@apply .input` |
| 3 | **Bottone primario** `bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg … disabled:opacity-50` | ~10 | `Login.tsx:122`, `ConfirmModal.tsx:39`, `Avanzamento.tsx:397`, `Settings.tsx:263`, `Gantt.tsx:274`, `Projects.tsx:280` | 🟡 `<Button variant="primary\|secondary\|danger">` |
| 4 | **Bottone secondario modale** `text-text-muted bg-base border border-border hover:border-text-dim` | 5 | `ConfirmModal.tsx:29`, `Projects.tsx:273`, `RetrospectiveModal.tsx:87`, `SlippageModal.tsx:88` | idem |
| 5 | **Card** `bg-surface border border-border rounded-2xl p-* shadow-card` | ~25 | praticamente ogni pagina | 🟡 `<Card>` o `@apply .card` |
| 6 | **Segmented control** (pill group attivo `bg-accent/20 text-accent border border-accent/30`) | 4 | `Projects.tsx:125-139`, `Gantt.tsx:637-649`, `AppNav.tsx:46-51`, `Pianificazione.tsx:279-284` — classi identiche verbatim | 🟡 `<SegmentedControl>` |
| 7 | **Alert errore** `bg-rag-red/10 border border-rag-red/30 text-rag-red text-sm` con raggio incoerente (`rounded-lg` in Login/Projects, `rounded-xl` in Pianificazione/Avanzamento) | 6 | `Login.tsx:70`, `Projects.tsx:143`, `Pianificazione.tsx:111`, `Avanzamento.tsx:246`, `Settings.tsx:148` | 🟡 `<Alert tone="error">` — fixa anche l'incoerenza di raggio |
| 8 | **Header `<th>`** `text-left text-text-muted font-medium px-4 py-3 text-xs uppercase tracking-wider whitespace-nowrap` | 7 file | `Dashboard.tsx:75-79`, `Pianificazione.tsx:128-134,442-449`, `Resources.tsx:213-218`, `Settings.tsx:165-168` | 🟢 `@apply .th` |
| 9 | **Fade gradient bordo destro tabelle** `pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent` | 5 | `Dashboard.tsx:119`, `Pianificazione.tsx:227,492`, `Resources.tsx:233` | 🟢 incluso in un wrapper `<ScrollTable>`; nota: il fade è visibile anche quando non c'è overflow |
| 10 | **Loading full-screen** `min-h-screen … animate-pulse "Caricamento…"` | 6 | tutte le pagine | 🟢 `<PageLoader>`; nessuno skeleton → flash di layout al load |

---

## 7. Riepilogo severità

| Sev | # | Sintesi |
|---|---|---|
| 🔴 | 1 | Matrice allocazioni inutilizzabile su mobile (nessuna strategia sotto `md`) |
| 🔴 | 1 | Mancanza di `<Modal>` condiviso: 6 implementazioni duplicate, tutte senza accessibilità e con animazioni morte |
| 🟡 | 10 | Classi rotte (`spointer-events-none`, `border-white/8`), plugin animate mancante, token aggirati (orange-400, yellow-400, hex hardcoded), semaforo FTE duplicato, KPI ridondanti/incoerenti (64.600 vs 66.600), empty-state con stato raw inglese, modali senza a11y, tabelle senza vista mobile, header senza flex-wrap, label "auto" sotto contrasto |
| 🟢 | 12 | Scala H1 incoerente, gutter mobile disallineato, spacing verticale variabile, soglie BudgetBar divergenti, `lang="en"`, favicon 404, legende senza wrap, fade sempre visibile, niente skeleton, aria-label mancanti, scala KPI card |

**Le 3 azioni a maggior leva** (dettaglio effort nello Step 6):
1. Creare `<Modal>` condiviso → elimina 6 duplicazioni, sistema a11y e animazioni in un colpo.
2. Fix puntuali delle classi rotte (`Login.tsx:49,67` + decisione sul plugin animate) → 15 minuti, bug reali.
3. Strategia mobile per le 3 tabelle larghe (riusare il pattern card già esistente in `Dashboard.tsx:33-67`).

---

*Metodologia: lettura integrale di 7 pagine attive + 10 componenti + config Tailwind; 16 screenshot
Playwright (8 desktop, 8 mobile) catturati dall'app live e analizzati visivamente. Le 3 pagine morte
(`Allocation.tsx`, `Baseline.tsx`, `Ongoing.tsx`) sono state escluse (vedi Step 1 §4.4).*

*Fine Step 2 — in attesa di conferma per procedere allo Step 3 (Component Architecture Audit).*
