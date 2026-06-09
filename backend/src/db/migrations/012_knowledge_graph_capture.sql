BEGIN;

-- Estende Project con descrizione libera e tag strutturati per il Knowledge Graph
ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_project_tags
  ON "Project" USING GIN (tags);

-- Momento 1 (Scoping): decisioni prese durante la pianificazione
CREATE TABLE IF NOT EXISTS "Decision" (
  id                   SERIAL PRIMARY KEY,
  project_id           INTEGER NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  phase_id             INTEGER REFERENCES "ProjectPhase"(id) ON DELETE SET NULL,
  author_id            INTEGER REFERENCES "User"(id) ON DELETE SET NULL,
  title                TEXT NOT NULL,
  rationale            TEXT,
  expected_consequence TEXT,
  decided_at           TIMESTAMPTZ DEFAULT now(),
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- Rischi collegati a decisioni (catena causale decisione→rischio)
CREATE TABLE IF NOT EXISTS "Risk" (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  decision_id   INTEGER REFERENCES "Decision"(id) ON DELETE SET NULL,
  category      TEXT CHECK (category IN ('Budget', 'Timeline', 'Resource', 'Scope')),
  description   TEXT NOT NULL,
  identified_at TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Momento 2 (Delivery): eventi di slittamento registrati durante l'esecuzione
CREATE TABLE IF NOT EXISTS "SlippageEvent" (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  phase_id    INTEGER REFERENCES "ProjectPhase"(id) ON DELETE SET NULL,
  expected    BOOLEAN NOT NULL,
  cause       TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Momento 3 (Chiusura): risposte retrospettiva al termine del progetto
CREATE TABLE IF NOT EXISTS "Retrospective" (
  id         SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  phase_id   INTEGER REFERENCES "ProjectPhase"(id) ON DELETE SET NULL,
  question   TEXT,
  answer     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_project    ON "Decision"      (project_id);
CREATE INDEX IF NOT EXISTS idx_risk_project        ON "Risk"          (project_id);
CREATE INDEX IF NOT EXISTS idx_slippage_project    ON "SlippageEvent" (project_id);
CREATE INDEX IF NOT EXISTS idx_retrospective_project ON "Retrospective" (project_id);

COMMIT;
