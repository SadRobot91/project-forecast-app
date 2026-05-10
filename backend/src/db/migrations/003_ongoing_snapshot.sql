-- Migration 003: Ongoing Snapshot

CREATE TABLE "OngoingSnapshot" (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES "Project"(id) ON DELETE CASCADE,
    reporting_date DATE NOT NULL,
    hours_spent_to_date DECIMAL(10, 2) NOT NULL DEFAULT 0,
    cost_spent_to_date DECIMAL(15, 2) NOT NULL DEFAULT 0,
    working_days_used INTEGER NOT NULL DEFAULT 0,
    working_days_remaining INTEGER NOT NULL DEFAULT 0,
    source VARCHAR(50) CHECK (source IN ('manual', 'keyedin_api')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
