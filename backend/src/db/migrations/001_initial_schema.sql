-- Initial Database Schema for Project Forecast App

CREATE TABLE IF NOT EXISTS "User" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) CHECK (role IN ('pm', 'dm')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Project" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    pm_id INTEGER REFERENCES "User"(id),
    currency VARCHAR(3) DEFAULT 'GBP',
    status VARCHAR(50) CHECK (status IN ('active', 'closed', 'archived')) NOT NULL DEFAULT 'active',
    share_token UUID DEFAULT gen_random_uuid(),
    share_token_expires_at TIMESTAMP WITH TIME ZONE,
    country_code VARCHAR(2) DEFAULT 'IT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ProjectPhase" (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES "Project"(id) ON DELETE CASCADE,
    phase_type VARCHAR(50) CHECK (phase_type IN ('feasibility', 'planning_design', 'build', 'deployment', 'closure')) NOT NULL,
    "order" INTEGER CHECK ("order" >= 1 AND "order" <= 5) NOT NULL,
    planned_start DATE,
    planned_end DATE,
    actual_start DATE,
    actual_end DATE,
    working_days INTEGER,
    planned_hours INTEGER,
    budget DECIMAL(15, 2),
    status VARCHAR(50) CHECK (status IN ('not_started', 'in_progress', 'completed')) NOT NULL DEFAULT 'not_started'
);
