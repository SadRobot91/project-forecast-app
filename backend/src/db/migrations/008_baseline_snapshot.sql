-- Migration 008: BAC snapshot on Baseline
-- Step B: materialize the Budget at Completion at lock time so the working
-- copy (ProjectPhase, AllocationEntry) can evolve freely without altering
-- the locked baseline. Variance is computed against these snapshot columns.

BEGIN;

ALTER TABLE "Baseline"
  ADD COLUMN IF NOT EXISTS total_budget_at_lock       DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS total_forecast_at_lock     DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS total_working_days_at_lock INTEGER,
  ADD COLUMN IF NOT EXISTS phase_snapshot_at_lock     JSONB;

COMMENT ON COLUMN "Baseline".total_budget_at_lock IS
  'BAC: SUM(weekly_cost) per project at lock time. Null = pre-snapshot lock.';
COMMENT ON COLUMN "Baseline".total_forecast_at_lock IS
  'BAC + contingency per phase summed at lock time.';
COMMENT ON COLUMN "Baseline".total_working_days_at_lock IS
  'SUM(working_days) across phases at lock time.';
COMMENT ON COLUMN "Baseline".phase_snapshot_at_lock IS
  'JSONB array, one entry per phase: { phase_id, phase_type, display_name, order, planned_start, planned_end, working_days, planned_hours, budget, contingency_pct, status }';

-- Backfill snapshot for baselines locked BEFORE this migration.
-- We synthesize the snapshot from current state — not perfectly historical,
-- but the only data we have. Better than leaving NULL and breaking variance.
WITH locked_projects AS (
  SELECT project_id FROM "Baseline" WHERE locked_at IS NOT NULL AND total_budget_at_lock IS NULL
),
phase_data AS (
  SELECT
    pp.project_id,
    pp.id            AS phase_id,
    pp.phase_type,
    pp.display_name,
    pp."order"       AS order_,
    pp.planned_start,
    pp.planned_end,
    COALESCE(pp.working_days, 0)  AS working_days,
    COALESCE(pp.planned_hours, 0) AS planned_hours,
    COALESCE(pp.contingency_pct, 0)::numeric AS contingency_pct,
    pp.status,
    COALESCE((
      SELECT SUM(ae.weekly_cost)
      FROM "AllocationEntry" ae
      WHERE ae.phase_id = pp.id
    ), 0)::numeric AS budget
  FROM "ProjectPhase" pp
  WHERE pp.project_id IN (SELECT project_id FROM locked_projects)
),
aggregates AS (
  SELECT
    project_id,
    SUM(budget)::numeric              AS total_budget,
    SUM(budget * (1 + contingency_pct / 100))::numeric AS total_forecast,
    SUM(working_days)::integer        AS total_working_days,
    jsonb_agg(
      jsonb_build_object(
        'phase_id',        phase_id,
        'phase_type',      phase_type,
        'display_name',    display_name,
        'order',           order_,
        'planned_start',   planned_start,
        'planned_end',     planned_end,
        'working_days',    working_days,
        'planned_hours',   planned_hours,
        'budget',          budget,
        'contingency_pct', contingency_pct,
        'status',          status
      ) ORDER BY order_
    ) AS phase_snapshot
  FROM phase_data
  GROUP BY project_id
)
UPDATE "Baseline" b
   SET total_budget_at_lock       = a.total_budget,
       total_forecast_at_lock     = a.total_forecast,
       total_working_days_at_lock = a.total_working_days,
       phase_snapshot_at_lock     = a.phase_snapshot
  FROM aggregates a
 WHERE b.project_id = a.project_id
   AND b.locked_at IS NOT NULL
   AND b.total_budget_at_lock IS NULL;

COMMIT;
