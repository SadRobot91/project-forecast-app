# Next Steps

> Branch corrente: `main`
> Riferimento architetturale: `ARCHITECTURE_AS_IS.md`

Steps A, B, C, I completati e mergiati su main. Due workstream rimasti aperti.

---

## Stato attuale

| Step | Stato | Note |
|------|-------|------|
| A — Lock check PUT /allocation | ✅ done | Stopgap, rimosso da B |
| B — Snapshot BAC su Baseline | ✅ done | Migration 008 |
| C — AllocationAggregator service | ✅ done | Single source of truth Σ FTE |
| I — PATCH /phases/:id working copy | ✅ backend done | Frontend ancora da consumare |
| D — FTE cap enforcement write | ⏳ small | Usa `canAllocate` di C + advisory lock |
| E — phase_id su OngoingSnapshot + Keyedin | ⏳ | Workstream BE integration |
| H — Auth backend | ⏳ | Workstream auth |
| F — Phase Financial Engine | ⏳ | Dopo E |
| G — day_rate cascade/versioning | ⏳ | Indipendente |
| J — Re-baselining con versioning | 🌱 future | Post-auth |

### Per riprendere da fresh session

1. Leggere `ARCHITECTURE_AS_IS.md` (stato as-is, problematiche aperte)
2. Leggere questo documento per la roadmap
3. `git checkout main && git pull`
4. Partire da **Step D** (piccolo) oppure da uno dei due workstream principali

---

## Step D — FTE cap enforcement sulla scrittura (~1h)

Nel `PUT /allocation`, dentro la transazione esistente:

1. `pg_advisory_xact_lock(hashtext(resource_id || ':' || week_start))` — serializza scritture concorrenti sulla stessa coppia
2. `aggregator.canAllocate(resource_id, week_start, requested_fte, { excludeProjectId })` — già implementata in `allocationAggregator.ts`
3. INSERT su `AllocationEntry` solo se `decision.ok`
4. Risposta 409 con `{ excess, breakdown }` se rifiutato

La logica di validazione è già in `canAllocate` — questo step è solo il collegamento al write path.

---

## Step E — BE Integration: phase_id su OngoingSnapshot + Keyedin (~1–2gg)

Migration `009_ongoing_phase_id.sql`:
```sql
ALTER TABLE "OngoingSnapshot"
  ADD COLUMN phase_id INTEGER REFERENCES "ProjectPhase"(id);
-- NULL = aggregato di progetto (retrocompatibilità)
```

Aggiornamenti:
- UI `/avanzamento`: chiedere "in quale fase è la spesa" al momento dello snapshot manuale
- `KeyedinApiProvider` (oggi stub): aggiungere mapping WBS code → `ProjectPhase.id` tramite `Project.keyedin_code`
- Prerequisito per Step F (Phase Financial Engine)

---

## Step F — Phase Financial Engine (~2–3gg, dopo Step E)

Nuovo service `backend/src/services/phaseFinancialEngine.ts`. Sostituisce il calcolo flat in `dashboard.ts:58` con forecast per-fase:

```typescript
phase.burn_rate_per_day = phase.budget / phase.working_days;
phase.forecast = phase.is_completed
  ? phase.actual_cost
  : phase.actual_cost + phase.burn_rate_per_day * phase.days_remaining;
project.revised_forecast = SUM(phase.forecast);
```

---

## Step G — day_rate cascade o versionamento (~1–2gg)

**Fix tattico** (1h): dopo `PUT /resources/:id`, CASCADE `weekly_cost` su tutte le `AllocationEntry` della risorsa:
```sql
UPDATE "AllocationEntry"
SET weekly_cost = $newRate * fte * working_days
WHERE resource_id = $1;
```

**Fix architetturale** (consigliato a regime): tabella `ResourceDayRateHistory` con `effective_from` + link da `AllocationEntry` al rate effettivo alla `week_start`.

---

## Step H — Auth backend (~3–5gg)

Vedi problema ⑤ in `ARCHITECTURE_AS_IS.md`. Workstream parallelo agli altri.

1. **Endpoint auth:**
   ```typescript
   POST /api/auth/login → bcrypt.compare → jwt.sign → { token, user }
   ```

2. **Middleware:**
   ```typescript
   // backend/src/middleware/requireAuth.ts
   const decoded = jwt.verify(req.headers.authorization, JWT_SECRET);
   req.user = { id, role };
   next();
   ```

3. **Applicazione:** montare `requireAuth` su tutti i router in `index.ts`. Aggiungere `WHERE pm_id = $1 OR role = 'dm'` sui `SELECT Project`.

4. **Frontend:** sostituire `VITE_USE_MOCK=true` con login reale. L'`AuthContext` con localStorage è già strutturato per ricevere un token JWT reale.

DM views e share link vengono dopo l'auth.

---

## Step J — Re-baselining (scope change formale, future feature)

Schema proposto:
```sql
ALTER TABLE "Baseline" ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Baseline" ADD COLUMN effective_from DATE;
ALTER TABLE "Baseline" ADD COLUMN reason TEXT;
```

Workflow: PM richiede re-baseline con motivo → sponsor approva (richiede auth) → nuovo record `Baseline v2` → dashboard ha selettore "Variance vs v1 / v2 / current".

Fuori scope POC. Affrontare quando l'auth (Step H) è pronta e c'è un caso reale.
