-- Migration 004: change AllocationEntry from monthly to weekly granularity
-- Rename columns: month → week_start, monthly_cost → weekly_cost
-- week_start stores the Monday (DATE) that begins each ISO week

BEGIN;

-- Drop existing data — granularity change requires a clean slate
TRUNCATE TABLE "AllocationEntry";

-- Rename columns
ALTER TABLE "AllocationEntry"
  RENAME COLUMN month TO week_start;

ALTER TABLE "AllocationEntry"
  RENAME COLUMN monthly_cost TO weekly_cost;

-- Add comment for clarity
COMMENT ON COLUMN "AllocationEntry".week_start IS 'Monday of the ISO week (YYYY-MM-DD)';
COMMENT ON COLUMN "AllocationEntry".weekly_cost IS 'Cost for this resource in this week: day_rate × fte × working_days';

COMMIT;
