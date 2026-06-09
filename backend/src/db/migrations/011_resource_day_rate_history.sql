-- Migration 011: ResourceDayRateHistory — track rate changes over time
-- Needed before Knowledge Graph accumulates historical project data, so costs
-- at a given week_start can be traced to the rate that was actually in effect.

BEGIN;

CREATE TABLE IF NOT EXISTS "ResourceDayRateHistory" (
  resource_id    INTEGER NOT NULL REFERENCES "Resource"(id) ON DELETE CASCADE,
  day_rate       NUMERIC(15, 2) NOT NULL,
  effective_from DATE NOT NULL,
  PRIMARY KEY (resource_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_rate_history_resource_date
  ON "ResourceDayRateHistory" (resource_id, effective_from DESC);

-- Seed current rates as the initial history entry for all existing resources.
-- effective_from = today means "this rate has been in effect from today onward".
INSERT INTO "ResourceDayRateHistory" (resource_id, day_rate, effective_from)
SELECT id, day_rate, CURRENT_DATE
FROM "Resource"
ON CONFLICT (resource_id, effective_from) DO NOTHING;

COMMIT;
