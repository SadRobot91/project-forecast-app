# Project Forecast App — Prompt di Sviluppo

Steps 1–9 completati. Due workstream rimasti.

---

## ✅ Step 1–9 _(COMPLETATI)_

Backend foundation, logica computazionale, resource registry, ongoing + Keyedin stub,
frontend base, baseline + allocation matrix, gantt, ongoing page, pianificazione + fix architetturali (A/B/C/I).

---

## Step H — Auth backend

```
Leggi AGENTS.md e ARCHITECTURE_AS_IS.md (problema ⑤).
Implementa il backend di autenticazione.

Backend:
- POST /api/auth/login: bcrypt.compare su User.password_hash → jwt.sign → { token, user }
- Middleware requireAuth: jwt.verify su Authorization header → req.user = { id, role }
- Monta requireAuth su tutti i router in index.ts
- Aggiunge WHERE pm_id = $1 OR role = 'dm' sui SELECT Project

Frontend:
- Sostituisce VITE_USE_MOCK=true con chiamata reale a POST /api/auth/login
- L'AuthContext con localStorage è già strutturato per ricevere un token JWT reale
- Aggiunge Authorization: Bearer <token> su ogni fetch

Nota: DM views e share link vengono dopo. Questo step sblocca l'uscita dal POC.
```

---

## Step E + F — BE Integration: Keyedin + Phase Financial Engine

```
Leggi AGENTS.md e ARCHITECTURE_AS_IS.md (problemi ④ e ①).
Implementa l'integrazione con i servizi BE e il calcolo finanziario per fase.

Step E — phase_id su OngoingSnapshot:
- Migration 009: ALTER TABLE "OngoingSnapshot" ADD COLUMN phase_id INTEGER REFERENCES "ProjectPhase"(id)
- UI /avanzamento: aggiunge selezione fase al momento dell'inserimento snapshot manuale
- KeyedinApiProvider (oggi stub): aggiunge mapping WBS code → ProjectPhase.id tramite Project.keyedin_code

Step F — Phase Financial Engine (dopo E):
- Nuovo service backend/src/services/phaseFinancialEngine.ts
- Sostituisce il calcolo flat in dashboard.ts:58 con forecast per-fase:
    phase.burn_rate_per_day = phase.budget / phase.working_days
    phase.forecast = is_completed ? actual_cost : actual_cost + burn_rate × days_remaining
    project.revised_forecast = SUM(phase.forecast)
- Variance = revised_forecast − total_budget_at_lock (BAC snapshot già in Baseline)
```
