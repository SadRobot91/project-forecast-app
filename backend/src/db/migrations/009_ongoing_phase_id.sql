BEGIN;
ALTER TABLE "OngoingSnapshot"
  ADD COLUMN IF NOT EXISTS phase_id INTEGER
    REFERENCES "ProjectPhase"(id) ON DELETE SET NULL;
COMMENT ON COLUMN "OngoingSnapshot".phase_id IS
  'Phase this snapshot refers to. NULL = project-level aggregate (legacy/default).';
CREATE INDEX IF NOT EXISTS idx_ongoing_project_phase_date
  ON "OngoingSnapshot" (project_id, phase_id, reporting_date DESC);
COMMIT;
