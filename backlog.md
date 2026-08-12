# Backlog — Project Forecast App

> Single source of truth per il lavoro **in sospeso**. Consolidato il 2026-07-22 verificando
> ogni voce contro il codice reale (non contro i doc). Sostituisce: `Audit120626/*`,
> `NEXT_STEPS_COMPLETO.md`, `next_steps_plan.md` (tutti gli item completati sono stati rimossi;
> il dettaglio storico resta nella git history).
>
> Legenda severità: 🔴 alta · 🟡 media · 🟢 bassa. Effort: **S** <½gg · **M** ½–2gg · **L** >2gg.

---

## A. Sicurezza — aperti verificati

| # | Issue | File | Sev | Effort |
|---|-------|------|-----|--------|
| A1 | `requireRole` esiste (`requireAuth.ts:83`) ma **zero call-site**: phase-template globali scrivibili da ogni PM; day rate e registro allocazioni cross-project visibili a tutti | `index.ts:42,49`, `phaseTemplates.ts`, `resources.ts` | 🟡 | S |
| A2 | Nessun `helmet` né `express-rate-limit` (assenti da `index.ts` e da `package.json`) | `backend/src/index.ts`, `backend/package.json` | 🟡 | S |
| A3 | `ongoing`: valori negativi accettati senza validazione; token in `localStorage` (da documentare); `share_token` dormiente | `ongoing.ts`, `AuthContext.tsx` | 🟢 | S |

> **Nota A1 (ex D2):** decisione di prodotto pendente. Opzione A = lock `requireRole('dm')` solo
> sulle scritture template (1 riga/endpoint, ma serve nascondere UI ai PM). Opzione B = registro
> visibile ai PM **senza** day rate (variante di risposta per ruolo). Domanda al business: il day
> rate è dato riservato? Sì → B; condiviso tra PM → A solo sui template.

---

## B. Decisioni prodotto/architettura — richiedono input umano

| # | Tema | Contesto | Raccomandazione |
|---|------|----------|-----------------|
| D1 | Ciclo di vita sessione (refresh token) | Il backend consegna solo `access_token` (TTL 1h); il listener `TOKEN_REFRESHED` non scatta mai → sessione muore a 1h, modifiche perse | **Opz. A subito**: backend restituisce anche `refresh_token`, FE chiama `setSession()`. Opz. B (login client-side Supabase) al passaggio produzione |
| D3 | Refetch totale dopo salvataggio fase | `pages/pianificazione/index.tsx` rifetcha baseline+matrice+registro (3 GET) dopo PUT singola fase; data-loss già chiuso con guardia `dirty` | **B (status quo) è sicuro.** Fare A (PUT ritorna fase ricalcolata, patch locale) solo se i 3 GET diventano problema UX, accettando staleness budget di fase |
| D4 | Verifica JWT locale vs round-trip Supabase | `requireAuth` chiama `getUser()` (HTTP); cache TTL 60s già applicata; resta round-trip sul primo hit + revoca ≤60s | **B ok per POC** (costo ammortizzato). Valutare A (firma locale jose+JWKS) solo in produzione, insieme a D1 |
| D5 | Design system | `Button`/`TextInput`/`Card`/`SegmentedControl` **assenti** in `src/components/` (verificato: tutti e 4 mancano); ~50 pattern Tailwind ripetuti verbatim. Modal+Alert già estratti | Task dedicato con review visiva. Opz. A componenti con varianti (Button/Input); `@apply` per `.th`/gradienti |

---

## C. Igiene repo (#38)

- `.DS_Store` **tracciati** in git (root, `backend/`, `frontend/`) → `git rm --cached` + `.gitignore`
- `nx.json` quasi-vuoto (solo `installation.version` + `analytics`, nessun target/plugin): NX non porta beneficio attuale → configurare o rimuovere

---

## D. Minori codice (#41)

- `catch (e: any)` ×3 (`Settings.tsx`, `avanzamento/index.tsx` ×2) → tipizzare `unknown`
- `JSON.parse` non guardato su `localStorage 'user'` — `AuthContext.tsx:18` (crash se storage corrotto)
- `TODAY` const module-level valutata una volta all'import — `gantt/config.ts:6` (stale in sessioni lunghe)
- Modali senza portal; reorder template non atomico; `useCallback` cargo-cult

---

## E. Minori performance (#42)

- Nessun dev proxy `/api` in `vite.config.ts` (`server.proxy` assente)
- `pnpm run migrate` non wired in `vercel.json` né in build/deploy script
- `WeekGrid` O(righe×settimane) div nel Gantt

---

## F. Debito di scala (residuo bug 2.3)

- **Materialized view `mv_phase_financials` non realizzata.** `computeProjectFinancials` è stato de-N+1 con batch query (`ANY` + `DISTINCT ON`), ma non c'è materialized view. Sufficiente per singolo progetto; da valutare **prima del Portfolio Dashboard** (N progetti × M fasi ricalcolati a ogni GET).

---

## G. Feature future (mai iniziate)

> Ordinate per orizzonte. Dettaglio strategico/competitivo preservato in `next_steps_new.md`.

**Prossimo (1–3 mesi):**
- **3.4 — Scorecard Accuratezza Stime**: pianificato-vs-reale per phase_type/PM/tag su progetti chiusi (aggrega `phase_snapshot_at_lock` vs ultimo `OngoingSnapshot`). Nuova rotta read-only + pagina Insights. Fondamenta ~55%
- **3.5 — Scenario / what-if planning**: overlay `scenario_id` nullable (nuova migrazione), bozze allocazioni non confermate che riusano `phaseFinancialEngine`/`allocationAggregator`. Effort M–L
- **QW4 — Banner Portfolio "A Rischio"** su `pages/Projects.tsx` (RAG già calcolato) + filtri rapidi
- **QW5 — Export Excel/CSV** dashboard + matrice allocazioni (chiude la storia "sostituiamo Project_Forecast_v16.xlsx"). Solo frontend
- **J — Re-baselining con versioning**
- Timesheet nativi leggeri; attivazione `share_token` (portale cliente)

**Dopo (3–6 mesi):**
- **3.6 — Tassonomia skill** (`Resource.role` oggi stringa libera) + matching skill-based
- Modello tariffe di vendita / margini / redditività (oggi solo costi via `day_rate`)
- Pianificatore assunzioni (demand-vs-capacity → segnale hiring)
- Portfolio Dashboard (Cap.9) — dopo F (materialized view)
- Keyedin: parser PDF/Excel reale (oggi stub); integrazioni Slack/calendario; mobile; ferie/permessi

**Compliance (prerequisito clienti EU):**
- **GDPR**: DPA firmato + zero data retention (Anthropic la offre) + valutare data residency EU. Da affrontare **prima** del primo beta con clienti; anche argomento di vendita ("il modello apprende in-tenant")
