-- Migration 014: indici FK mancanti sulle tabelle core (audit Step 4, B2.2).
-- A scala POC i seq scan sono invisibili; questi indici coprono le query più
-- frequenti (budget per progetto/fase, aggregati FTE, milestone) a costo nullo.

BEGIN;

-- allocations GET, sub-query budget in projects/dashboard/ongoing
CREATE INDEX IF NOT EXISTS idx_allocation_project
  ON "AllocationEntry" (project_id);

-- phaseFinancialEngine (phase_id = ANY), JOIN budget per fase in baseline/dashboard
CREATE INDEX IF NOT EXISTS idx_allocation_phase
  ON "AllocationEntry" (phase_id);

-- allocationAggregator: SUM(fte) per (resource, week) — l'indice unique
-- esistente ha week_start in 4ª posizione e serve solo il prefisso resource_id
CREATE INDEX IF NOT EXISTS idx_allocation_resource_week
  ON "AllocationEntry" (resource_id, week_start);

-- praticamente ogni route legge le fasi per progetto
CREATE INDEX IF NOT EXISTS idx_projectphase_project
  ON "ProjectPhase" (project_id);

-- dashboard (milestone per progetto) e gantt
CREATE INDEX IF NOT EXISTS idx_gantttask_project_milestone
  ON "GanttTask" (project_id, is_milestone);

COMMIT;
