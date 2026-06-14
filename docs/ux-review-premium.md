# UX Review Premium — Project Forecast App

**Data:** 2026-06-09
**URL analizzato:** http://localhost:5173 (mock mode `VITE_USE_MOCK=true`)
**Schermate catturate:** 10 desktop (1440×900) + 9 mobile (390×844)
**Reviewed by:** Agent `ux-reviewer` (Senior UX/UI)
**Screenshot dir:** `.claude/ux-screenshots/forecast-20260609-1046/`

---

## Executive Summary

**Score globale: 6.8 / 10**

L'app ha già fondamenta solide e sopra la media per un POC: tema dark coerente, palette accent viola (`#6c63ff`) applicata con criterio, RAG badge semantici efficaci, responsive mobile sorprendentemente curato (tabelle → card stack, sticky first column). La Dashboard è la pagina più premium. Le criticità sono di "ultimo miglio": manca il fattore WOW. Mancano micro-interazioni e hover states, le ombre sono piatte (nessuna glow accent), il white space è sbilanciato (Gantt e Projects hanno enormi vuoti sotto il fold), la scala tipografica è timida (titoli a 30px dove servirebbero 36-48px). I tre interventi a maggior impatto: (1) **hover/transition system** su tutte le card e righe, (2) **glow shadow accent** + bordi con opacità per dare profondità, (3) **menu hamburger mobile rotto** — si apre la X ma nessun pannello di navigazione. Con 1-2 giorni di rifinitura CSS il prodotto passa da "buon POC" a "demo premium vendibile".

---

## 1. Analisi per Schermata

### Login — `/login`
**Score:** 7.5/10
**Screenshot:** `01_login_desktop.png`, `01b_login_error_desktop.png`, `m01_login_mobile.png`

**Punti di forza**
- Layout centrato pulito, logo icon in container con accent soft.
- Gradiente ambientale d'angolo (viola top-left, cyan bottom-right) già presente: ottima base.
- Stati di errore di validazione presenti e ben visibili (`Inserisci l'indirizzo email`) — buona accessibilità.

**Criticità standard**
- L'errore appare in rosso ma manca un bordo rosso sull'input stesso (`border-rag-red`) per legare visivamente messaggio e campo.
- Nessun stato di focus visibile evidente sugli input (focus ring).

**Criticità premium**
- La card login è "piatta": nessuna ombra, nessun bordo luminoso. Sembra un rettangolo incollato sullo sfondo.
- Il gradiente d'angolo è troppo timido (quasi invisibile a destra) — alzare opacità/raggio.
- Il bottone "Accedi" è pieno ma flat: manca glow accent e hover.

---

### Lista Progetti (Portfolio) — `/projects`
**Score:** 6.5/10
**Screenshot:** `02_projects_desktop.png`, `m02_projects_mobile.png`

**Punti di forza**
- Card progetto chiare, RAG badge in alto a destra eccellenti (icona + colore + label).
- Filtro segmented control (Tutti / Attivo / In pausa / Chiuso) ben fatto.
- Progress bar budget colorata semanticamente (verde/rosso) molto leggibile.
- Mobile: card stack perfetto, nessun overflow.

**Criticità standard**
- Card cliccabili ma nessun affordance visivo che lo segnali (no cursor hint, no hover lift).
- Doppia indicazione di stato ridondante: RAG badge in alto ("A Rischio") + pill stato in basso ("Attivo"). Confonde la gerarchia.

**Criticità premium**
- **Enorme vuoto sotto il fold** (oltre 600px di nero) con sole 3 card su una riga. Spreco grave di spazio: le card sono piccole rispetto al canvas.
- Card senza hover state: nessun `hover:scale`, nessun `hover:border-accent`, nessuna ombra che reagisce.
- Header "I Tuoi Progetti" a 30px è sottodimensionato per una landing di portfolio — manca impatto.
- Le 3 card hanno tutte lo stesso peso visivo: nessuna gerarchia tra progetto a rischio (dovrebbe spiccare) e progetto in linea.

---

### Dashboard Progetto — `/projects/1/dashboard`
**Score:** 7.5/10 (la pagina migliore)
**Screenshot:** `03_dashboard_desktop.png`, `m03_dashboard_mobile.png`

**Punti di forza**
- Header con gradiente ambra/marrone legato allo stato "A Rischio": ottimo tocco contestuale.
- KPI row a 6 colonne ben spaziata, numeri grandi e bold, label uppercase secondarie.
- Tabella fasi con mini progress bar inline (% TOTALE) molto efficace.
- Milestone list con dot di stato colorato (verde/giallo/grigio) + "Effettiva" in rosso: leggibile.
- Mobile: tabella fasi convertita in card label/valore — eccellente conversione responsive.

**Criticità standard**
- "PREVISIONE 69.800 £" in viola: ottimo, ma "SCOSTAMENTO 5200 £ sopra budget" non è colorato in rosso pur essendo negativo — incoerenza semantica.
- I 6 KPI hanno la stessa enfasi: il KPI critico (Previsione/Scostamento) dovrebbe risaltare.

**Criticità premium**
- Le KPI card sono flat: nessun bordo accent, nessuna ombra. Perfette candidate per glassmorphism + glow.
- Il colore numero KPI è quasi tutto bianco: solo "Previsione" è viola. Più colore semantico nei numeri darebbe vita.
- Manca uno sparkline/mini-trend in qualche KPI (es. burn rate nel tempo) — sarebbe il vero WOW di una dashboard finanziaria.

---

### Pianificazione (Fasi & Date) — `/projects/1/pianificazione`
**Score:** 7/10
**Screenshot:** `04_pianificazione_desktop.png`, `m04_pianificazione_mobile.png`

**Punti di forza**
- Tab "Fasi & Date / Risorse & Budget" con underline accent attivo: pattern corretto.
- Tabella editabile inline con date picker stilizzati (testo viola).
- Riga TOTALE evidenziata, valori in accent.
- Card riepilogo "Budget Totale" + "Baseline Total Forecast" in fondo con numero grande viola.
- Mobile: tabella scroll-x con prima colonna sticky.

**Criticità standard**
- "Blocca Baseline" è rosso (azione distruttiva/irreversibile) accanto a "Salva" neutro: il rosso può allarmare per un'azione legittima. Valutare ambra.
- I campi contingenza % editabili non si distinguono visivamente dalle celle read-only (GG, ORE) — non è chiaro cosa è editabile.

**Criticità premium**
- Le due card riepilogo in fondo sono ottime ma isolate da troppo gap rispetto alla tabella.
- Header tabella `text-gray` su sfondo scuro: contrasto label colonne migliorabile.
- Nessuna animazione sul ricalcolo del totale (il numero cambia secco) — un count-up animato sarebbe premium.

---

### Pianificazione (Risorse & Budget / Allocation Matrix) — `/projects/1/pianificazione` tab 2
**Score:** 6/10
**Screenshot:** `04b_pianificazione_risorse_desktop.png`

**Punti di forza**
- Matrice FTE densa con celle colorate (dot giallo/verde) per stato allocazione: ottima densità informativa.
- Legenda colori presente.
- Sezioni per fase (Feasibility, Build…) ben separate con header.

**Criticità standard**
- Densità molto alta: rischio affaticamento. Le celle FTE sono piccole e i dot di stato minuscoli.
- Molte sezioni impilate verticalmente: serve scroll lungo senza overview.

**Criticità premium**
- Visivamente la più "spreadsheet" e meno premium dell'app. Le celle sembrano Excel.
- Manca heatmap visiva: invece di dot, lo sfondo cella potrebbe avere opacità accent proporzionale alla FTE (verde→giallo→rosso) per leggere l'allocazione "a colpo d'occhio".
- "Salva fase" ripetuto per ogni sezione: rumore visivo, ripetizione del CTA.

---

### Avanzamento — `/projects/1/avanzamento`
**Score:** 7/10
**Screenshot:** `05_avanzamento_desktop.png`, `m05_avanzamento_mobile.png`

**Punti di forza**
- 4 KPI card ben spaziate (% Completamento in viola, Costo, Costo/ora, Burn rate).
- Progress bar "Utilizzo Budget" full-width con % verde a destra: leggibile.
- Layout 2 colonne (form snapshot + storico) bilanciato.
- Storico snapshot con badge "Manuale / Progetto" e timestamp: chiaro.
- "Sync da Keyedin" come azione secondaria in alto a destra: posizionamento corretto.

**Criticità standard**
- Il form e lo storico hanno la stessa importanza visiva; il form (azione primaria) dovrebbe risaltare di più.
- Badge "Manuale" e "Progetto" molto simili tra loro — poco distinguibili.

**Criticità premium**
- KPI card di nuovo flat (stesso tema della dashboard, coerente ma non premium).
- "Salva Snapshot" è l'unico bottone pieno viola, buono, ma flat (no glow).
- Vuoto sotto il fold moderato.

---

### Gantt — `/projects/1/gantt`
**Score:** 5.5/10 (più penalizzata sul white space)
**Screenshot:** `06_gantt_desktop.png`, `m06_gantt_mobile.png`

**Punti di forza**
- Barre fase con gradiente verde/viola e label inline (date) leggibili.
- Indicatore "Oggi (09/06)" presente, milestone rombi colorati.
- Switch vista (Vista Fasi / Completa / Milestone): buona feature.
- Legenda completa in alto.

**Criticità standard**
- **Oltre 600px di nero vuoto sotto il Gantt** (5 sole righe fase): la pagina sembra rotta/incompleta.
- L'altezza delle righe è generosa ma il grafico occupa <40% dell'altezza viewport.

**Criticità premium**
- Le barre sono piatte: un gradiente più ricco + ombra soft sotto la barra darebbe profondità.
- La griglia temporale (colonne settimanali) ha linee quasi invisibili: weekend/oggi non evidenziati con banda colorata.
- Mobile: solo 2 colonne temporali visibili, il valore del Gantt si perde — valutare vista compatta dedicata.

---

### Registro Risorse — `/resources`
**Score:** 7/10
**Screenshot:** `07_resources_desktop.png`, `m07_resources_mobile.png`

**Punti di forza**
- **Alert "Sovrallocazione rilevata"** in banner rosso con dettaglio risorsa: eccellente, è il tipo di feedback proattivo che fa premium.
- Matrice cross-project con dot di utilizzo (grigio/giallo/verde/rosso) + legenda.
- Cella "130%" in rosso con dot rosso: red flag immediato e leggibile.
- Filtri dropdown + toggle "Mostra progetti chiusi".

**Criticità standard**
- Densità alta come l'allocation matrix; le righe espandibili (▼) non sono ovvie.
- Header colonne settimanali in `text-gray`: contrasto basso.

**Criticità premium**
- Il banner alert è ottimo ma statico: un'icona animata (pulse) attirerebbe di più.
- Stesso problema heatmap: i dot potrebbero essere sostituiti/affiancati da background cella con opacità.

---

### Impostazioni — `/settings`
**Score:** 6.5/10
**Screenshot:** `08_settings_desktop.png`, `m08_settings_mobile.png`

**Punti di forza**
- Tabella fasi template con reorder (frecce su/giù) e delete: funzionale e chiaro.
- Nota esplicativa in fondo ("le modifiche si applicano solo ai nuovi progetti") utile.
- Form "aggiungi fase" inline pulito.

**Criticità standard**
- Le frecce reorder e il cestino sono grigi e piccoli: poco visibili, target tocco mobile ai limiti.
- La pagina è una sola card centrata con largo vuoto laterale e sotto.

**Criticità premium**
- Pagina più "amministrativa" e spoglia: nessuna personalità. Header a 30px su tanto vuoto.
- Icone azione (frecce, cestino) prive di hover state e colore on-hover.

---

## 2. Problemi Critici (P0)

| # | Schermata | Problema | Impatto | Priorità |
|---|-----------|----------|---------|----------|
| 1 | Mobile (tutte) | **Menu hamburger fragile/non visibile**: cliccando, l'icona passa a X (`menuOpen=true`) ma il pannello nav non risulta visibile nello screenshot (`m_hamburger_mobile.png` identica a projects). In `AppNav.tsx` il pannello esiste (`{menuOpen && ...}` a `top-14 absolute z-50`) ma il `useEffect` con `handleClickOutside` su `mousedown` (righe 35-44) può chiuderlo immediatamente / lo stato è incoerente con la X mostrata. Verificare apertura reale e z-index sopra il contenuto. | Alto | P0 |
| 2 | Gantt, Projects | **White space sbilanciato**: >600px di nero vuoto sotto il fold. La pagina appare incompleta/rotta. | Alto | P1 |
| 3 | Tutte | **Nessun hover/transition state** su card, righe tabella, bottoni cliccabili. L'app sembra statica, non reattiva. Manca affordance di interattività. | Alto | P1 |
| 4 | Dashboard | Scostamento negativo "5200 £ sopra budget" non colorato in rosso: incoerenza semantica su dato critico. | Medio | P2 |
| 5 | Projects | Doppia indicazione di stato (RAG badge + pill "Attivo"/"Chiuso") ridondante e confusionaria. | Medio | P2 |
| 6 | Login / form | Errore validazione mostrato come testo ma input privo di bordo rosso: feedback non legato al campo. | Medio | P2 |

---

## 3. Analisi Tema Dark Premium

**Palette (da `tailwind.config.js`): coerente e di buon gusto.**
- Accent `#6c63ff` (viola) usato con criterio: titoli numerici chiave, tab attive, CTA primari, badge PM.
- RAG semantici (verde/giallo/rosso) efficaci e leggibili su scuro.
- Background a 2-3 livelli di scuro (canvas quasi nero → card blu-grigio scuro → header tabella): buona stratificazione.

**Contrasti (WCAG):**
- Testo bianco/numeri su card scure: OK (ratio ampiamente >7:1).
- **Problema ricorrente**: label secondarie e header colonne tabella in `text-gray-500/600` (~`#6b7280`) su sfondo scuro `#1a1d29` danno ratio ~3.2:1 — **sotto WCAG AA 4.5:1** per testo normale. Presente in: header tabelle (Dashboard, Pianificazione, Resources), sottotitoli pagina, label KPI.
- Date picker testo viola su input scuro: verificare ratio, al limite.

**Coerenza visiva tra schermate: alta.** Header, nav, card, badge, progress bar sono consistenti ovunque. Questo è un punto di forza reale: il design system implicito esiste già.

**Cosa manca per il "premium":**
1. **Profondità**: tutte le superfici sono flat. Zero ombre, zero glow. Un prodotto premium (Linear, Vercel) usa ombre soft colorate e bordi a bassa opacità per stratificare.
2. **Reattività**: nessuna micro-interazione. Le superfici premium "respirano" all'hover.
3. **Audacia tipografica**: la scala è conservativa (titoli ~30px). Linear/Craft usano titoli 36-48px con forte contrasto di peso.
4. **Texture/luce**: il gradiente ambientale del login è l'unico tocco "atmosferico" e va esteso (con parsimonia) ad altre hero section.

---

## 4. Proposte di Miglioramento

> I token colore si riferiscono a `frontend/tailwind.config.js` (`accent #6c63ff`, `accent-cyan`, `rag-*`).

### Login
- **Visual Polish**: alla card login aggiungere `shadow-[0_8px_40px_rgba(108,99,255,0.12)]` + `border border-white/5`. Sul bottone Accedi: `shadow-[0_4px_20px_rgba(108,99,255,0.4)] hover:shadow-[0_6px_28px_rgba(108,99,255,0.55)] transition-shadow duration-200`. Alzare l'opacità del gradiente d'angolo.
- **Layout**: card già ben centrata; ridurre lievemente il gap titolo→card.
- **Tipografia**: "Project Forecast" da ~30px a `text-4xl font-bold tracking-tight`. Su errore aggiungere `border-rag-red` all'input.

### Lista Progetti
- **Visual Polish**: card → `transition-all duration-200 ease-out hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_0_0_1px_rgba(108,99,255,0.3),0_12px_40px_rgba(0,0,0,0.5)] cursor-pointer`. La card del progetto a rischio: bordo sinistro `border-l-2 border-rag-red`.
- **Layout & White Space**: usare il vuoto sotto il fold → ingrandire le card o passare a griglia `grid-cols-3 gap-6` con card più alte che includano milestone preview / mini-Gantt. Aggiungere una riga di KPI portfolio aggregati in cima (totale budget, progetti a rischio, FTE allocate).
- **Tipografia**: header "I Tuoi Progetti" → `text-4xl font-bold`. Rimuovere la pill stato in basso (ridondante col RAG badge) o trasformarla in metadato neutro.

### Dashboard
- **Visual Polish**: KPI card → `border border-white/5 hover:border-accent/30 transition-colors`. Numeri semantici: scostamento negativo in `text-rag-red`, previsione resta accent. Aggiungere glow al KPI critico: `ring-1 ring-rag-yellow/30` quando A Rischio.
- **Layout**: header con gradiente già ottimo; mantenere. Aggiungere uno sparkline burn-rate in una KPI card.
- **Tipografia**: numeri KPI da bold a `text-3xl font-bold tabular-nums` per allineamento cifre.

### Pianificazione
- **Visual Polish**: distinguere celle editabili (input contingenza, date) con `bg-accent/5 border border-accent/20` vs celle read-only piatte. "Blocca Baseline" da rosso a `bg-amber-600/90` (azione importante ma non distruttiva), tenere icona lucchetto.
- **Layout**: ridurre gap tra tabella e card riepilogo; raggruppare "Budget Totale" + "Baseline Forecast" in un'unica strip.
- **Tipografia**: count-up animato sul totale al ricalcolo (lib leggera o CSS).

### Allocation Matrix / Resources
- **Visual Polish**: heatmap → sfondo cella con opacità accent proporzionale alla FTE invece (o in aggiunta) del dot: `bg-rag-green/20` (ottimale), `bg-rag-yellow/15` (sotto), `bg-rag-red/25` (over). Lettura a colpo d'occhio.
- **Layout**: collassare le sezioni fase di default con conteggio (accordion) per dare overview prima del dettaglio. Un solo CTA "Salva" sticky invece di "Salva fase" ripetuto.
- **Tipografia**: header colonne settimana da `text-gray-500` a `text-gray-300` (#d1d5db) per WCAG AA.

### Gantt
- **Visual Polish**: barre → gradiente + `shadow-[0_2px_8px_rgba(0,0,0,0.4)]`. Banda "oggi" verticale `bg-accent/10` a tutta altezza. Weekend con leggero `bg-white/[0.02]`.
- **Layout & White Space**: eliminare il vuoto: o estendere la griglia ad altezza viewport con sfondo a righe alternate, o aggiungere sotto il Gantt una sezione "Prossime milestone / task in ritardo".
- **Tipografia**: label date colonne da gray a `text-gray-400` min.

### Settings
- **Visual Polish**: icone azione (frecce, cestino) → `text-gray-500 hover:text-accent transition-colors`, cestino `hover:text-rag-red`. Aumentare hit area a `p-2`.
- **Layout**: card più larga o due colonne (template fasi | preview). Riempire il vuoto laterale.
- **Iconografia**: standardizzare su un set coerente (lucide-react consigliato) per frecce/cestino/lock.

---

## 5. Quick Wins (implementabili in <1 giorno)

Alto impatto, basso sforzo — principalmente Tailwind:

1. **Hover system globale su card** (componente card riusabile):
   `transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-[0_0_0_1px_rgba(108,99,255,0.25),0_8px_30px_rgba(0,0,0,0.4)]`
2. **Glow sui CTA primari**:
   `shadow-[0_4px_20px_rgba(108,99,255,0.35)] hover:shadow-[0_6px_28px_rgba(108,99,255,0.5)] transition-shadow`
3. **Fix contrasto WCAG**: cercare/sostituire `text-gray-500`/`text-gray-600` nelle label tabelle e sottotitoli → `text-gray-300` / `text-gray-400`.
4. **Bordo soft universale sulle card**: aggiungere `border border-white/5` ovunque per stratificare le superfici flat.
5. **Scala titoli più audace**: gli header pagina (`Pianificazione`, `Gantt`, `Registro Risorse`, `Impostazioni`, `I Tuoi Progetti`) da ~30px a `text-4xl font-bold tracking-tight`.
6. **Colore semantico sui numeri negativi**: scostamento/over-budget in `text-rag-red` ovunque compaiono.
7. **Focus ring accessibile su input**: `focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none`.
8. **Righe tabella hover**: `hover:bg-white/[0.03] transition-colors` su righe fasi/risorse.

---

## 6. Roadmap Visiva

Priorità per trasformare l'app in prodotto premium:

**Sprint 1 — Fix bloccanti + depth foundation (1-2 giorni)**
- [P0] Riparare il menu hamburger mobile (nessun pannello nav si apre — vedi `AppNav.tsx`).
- Quick Wins 1-8 (hover system, glow CTA, contrasti WCAG, bordi soft, scala titoli, focus ring).
- Risolvere doppio badge stato in Projects + colore semantico scostamenti.

**Sprint 2 — Riempire i vuoti & gerarchia (2-3 giorni)**
- Projects: KPI portfolio in cima + card più grandi (eliminare vuoto sotto fold).
- Gantt: griglia full-height + banda "oggi" + sezione milestone sotto.
- Dashboard: enfasi sul KPI critico + sparkline burn-rate.

**Sprint 3 — Heatmap & dati "a colpo d'occhio" (2 giorni)**
- Allocation Matrix + Resources: sfondo celle a heatmap opacity invece dei dot.
- Accordion sezioni fase con overview.
- Count-up animato sui totali.

**Sprint 4 — Atmosfera & rifinitura premium (1-2 giorni)**
- Estendere gradienti ambientali (con parsimonia) alle hero section (Dashboard header già ok come modello).
- Pulse animation sugli alert critici (sovrallocazione).
- Standardizzare icon set (lucide-react) e micro-interazioni di transizione tra pagine.

**Risultato atteso:** da **6.8/10** a **~8.5/10** — da "POC funzionale ben fatto" a "demo SaaS premium" pronta per la proposta interna.

---

## Appendice — Screenshot Analizzati

| File | Commento |
|---|---|
| `01_login_desktop.png` | Login centrato, gradiente ambientale, card flat |
| `01b_login_error_desktop.png` | Stati errore validazione presenti, input senza bordo rosso |
| `02_projects_desktop.png` | 3 card RAG, grande vuoto sotto fold |
| `03_dashboard_desktop.png` | Pagina migliore: header gradiente + KPI row + tabella fasi |
| `04_pianificazione_desktop.png` | Tabella editabile inline, card riepilogo in fondo |
| `04b_pianificazione_risorse_desktop.png` | Allocation matrix densa, stile spreadsheet |
| `05_avanzamento_desktop.png` | KPI + progress + form/storico bilanciato |
| `06_gantt_desktop.png` | Gantt funzionale, >600px vuoto sotto |
| `07_resources_desktop.png` | Alert sovrallocazione ottimo, matrice cross-project |
| `08_settings_desktop.png` | Template fasi reorder, pagina spoglia |
| `m01_login_mobile.png` | Login mobile ok |
| `m02_projects_mobile.png` | Card stack mobile perfetto |
| `m03_dashboard_mobile.png` | Tabella → card responsive eccellente |
| `m04_pianificazione_mobile.png` | Tabella scroll-x + sticky col |
| `m05_avanzamento_mobile.png` | KPI stack mobile ok |
| `m06_gantt_mobile.png` | Solo 2 colonne temporali visibili |
| `m07_resources_mobile.png` | Scroll-x + sticky, denso ma usabile |
| `m08_settings_mobile.png` | Settings mobile ok |
| `m_hamburger_mobile.png` | X aperta ma pannello nav non visibile — verificare apertura/z-index (vedi P0 #1) |
