-- Migration 002: Resource Registry and Allocation

CREATE TABLE IF NOT EXISTS "Resource" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    day_rate DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AllocationEntry" (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER REFERENCES "Resource"(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES "Project"(id) ON DELETE CASCADE,
    phase_id INTEGER REFERENCES "ProjectPhase"(id) ON DELETE CASCADE,
    month DATE NOT NULL, -- Stored as the first day of the month (e.g. 2026-05-01)
    fte DECIMAL(3, 2) CHECK (fte >= 0.0 AND fte <= 1.0) NOT NULL,
    working_days INTEGER NOT NULL,
    monthly_cost DECIMAL(15, 2) NOT NULL
);

-- Constraint to prevent duplicate allocation entries for the same resource, phase, and month
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_allocation') THEN
        ALTER TABLE "AllocationEntry" ADD CONSTRAINT unique_allocation UNIQUE (resource_id, project_id, phase_id, month);
    END IF;
END $$;
