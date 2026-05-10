-- Migration 005: Add missing tables and fix constraints

BEGIN;

-- Baseline table (referenced by baseline.ts route)
CREATE TABLE IF NOT EXISTS "Baseline" (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES "Project"(id) ON DELETE CASCADE UNIQUE,
    contingency_pct DECIMAL(5, 2) NOT NULL DEFAULT 0,
    locked_at TIMESTAMP WITH TIME ZONE
);

-- PublicHoliday table (used in baseline route for NETWORKDAYS)
CREATE TABLE IF NOT EXISTS "PublicHoliday" (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(2) NOT NULL DEFAULT 'IT',
    date DATE NOT NULL,
    name VARCHAR(255),
    UNIQUE (country_code, date)
);

-- Seed Italian public holidays 2025-2027
INSERT INTO "PublicHoliday" (country_code, date, name) VALUES
  ('IT','2025-01-01','Capodanno'),('IT','2025-01-06','Epifania'),
  ('IT','2025-04-21','Pasquetta'),('IT','2025-04-25','Liberazione'),
  ('IT','2025-05-01','Festa del Lavoro'),('IT','2025-06-02','Repubblica'),
  ('IT','2025-08-15','Ferragosto'),('IT','2025-11-01','Ognissanti'),
  ('IT','2025-12-08','Immacolata'),('IT','2025-12-25','Natale'),
  ('IT','2025-12-26','Santo Stefano'),
  ('IT','2026-01-01','Capodanno'),('IT','2026-01-06','Epifania'),
  ('IT','2026-04-06','Pasquetta'),('IT','2026-04-25','Liberazione'),
  ('IT','2026-05-01','Festa del Lavoro'),('IT','2026-06-02','Repubblica'),
  ('IT','2026-08-15','Ferragosto'),('IT','2026-11-01','Ognissanti'),
  ('IT','2026-12-08','Immacolata'),('IT','2026-12-25','Natale'),
  ('IT','2026-12-26','Santo Stefano'),
  ('IT','2027-01-01','Capodanno'),('IT','2027-01-06','Epifania'),
  ('IT','2027-03-29','Pasquetta'),('IT','2027-04-25','Liberazione'),
  ('IT','2027-05-01','Festa del Lavoro'),('IT','2027-06-02','Repubblica'),
  ('IT','2027-08-15','Ferragosto'),('IT','2027-11-01','Ognissanti'),
  ('IT','2027-12-08','Immacolata'),('IT','2027-12-25','Natale'),
  ('IT','2027-12-26','Santo Stefano')
ON CONFLICT DO NOTHING;

-- GanttTask table
CREATE TABLE IF NOT EXISTS "GanttTask" (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES "Project"(id) ON DELETE CASCADE,
    phase_id INTEGER REFERENCES "ProjectPhase"(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    owner VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    working_days INTEGER NOT NULL DEFAULT 0,
    is_milestone BOOLEAN NOT NULL DEFAULT FALSE,
    actual_date DATE,
    status VARCHAR(50) CHECK (status IN ('not_started', 'in_progress', 'completed')) NOT NULL DEFAULT 'not_started',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add 'on_hold' to Project status constraint
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_status_check";
ALTER TABLE "Project" ADD CONSTRAINT "Project_status_check"
  CHECK (status IN ('active', 'on_hold', 'closed', 'archived'));

COMMIT;
