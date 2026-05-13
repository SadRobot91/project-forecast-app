-- Migration 007: configurable phase names + PhaseTemplate for new-project defaults

BEGIN;

-- Add display_name to ProjectPhase; backfill from phase_type
ALTER TABLE "ProjectPhase" ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);

UPDATE "ProjectPhase" SET display_name = CASE phase_type
  WHEN 'feasibility'     THEN 'Feasibility'
  WHEN 'planning_design' THEN 'Planning & Design'
  WHEN 'build'           THEN 'Build'
  WHEN 'deployment'      THEN 'Deployment'
  WHEN 'closure'         THEN 'Closure'
  ELSE phase_type
END
WHERE display_name IS NULL;

ALTER TABLE "ProjectPhase" ALTER COLUMN display_name SET NOT NULL;
ALTER TABLE "ProjectPhase" ALTER COLUMN display_name SET DEFAULT 'Phase';

-- PhaseTemplate: system-wide defaults used when creating new projects
CREATE TABLE IF NOT EXISTS "PhaseTemplate" (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE,   -- internal key (immutable)
  display_name  VARCHAR(255) NOT NULL,
  "order"       INTEGER      NOT NULL,
  default_contingency_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  active        BOOLEAN      NOT NULL DEFAULT true
);

INSERT INTO "PhaseTemplate" (name, display_name, "order", default_contingency_pct) VALUES
  ('feasibility',     'Feasibility',       1, 10),
  ('planning_design', 'Planning & Design', 2,  0),
  ('build',           'Build',             3,  0),
  ('deployment',      'Deployment',        4,  0),
  ('closure',         'Closure',           5,  0)
ON CONFLICT (name) DO NOTHING;

COMMIT;
