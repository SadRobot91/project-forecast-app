# Data Model Documentation

PostgreSQL schema for Project Forecast App. This document provides a comprehensive reference to the database structure, relationships, and design rationale.

---

## Table of Contents

1. [Core Tables](#core-tables)
2. [Relationships Diagram](#relationships-diagram)
3. [Schema Details](#schema-details)
4. [Key Calculations](#key-calculations)
5. [Migration History](#migration-history)
6. [Indexing Strategy](#indexing-strategy)

---

## Core Tables

### 1. User (Authentication & Authorization)

Stores Project Manager (PM) and Delivery Manager (DM) user accounts. Integrates with Supabase Auth.

```sql
CREATE TABLE "User" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) CHECK (role IN ('pm', 'dm')) NOT NULL,
    supabase_uid UUID UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Internal user ID |
| `name` | VARCHAR(255) | NOT NULL | User display name |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Email address (unique across system) |
| `password_hash` | VARCHAR(255) | NOT NULL | Hashed password (legacy; auth via Supabase) |
| `role` | VARCHAR(50) | CHECK ('pm', 'dm') | Role: Project Manager or Delivery Manager |
| `supabase_uid` | UUID | UNIQUE | Supabase Auth user ID (Step H integration) |
| `created_at` | TIMESTAMP | DEFAULT NOW | Account creation timestamp |

**Design Rationale:**
- `password_hash` is kept for backward compatibility but Supabase Auth is the primary authentication layer
- `supabase_uid` enables seamless mapping between Supabase identity and internal user records
- `role` controls API access; filtering by `pm_id` on projects ensures users see only their data

---

### 2. Project (Project Header)

Represents a single project with budget and metadata.

```sql
CREATE TABLE "Project" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    pm_id INTEGER REFERENCES "User"(id),
    currency VARCHAR(3) DEFAULT 'GBP',
    status VARCHAR(50) CHECK (status IN ('active', 'on_hold', 'closed', 'archived')) 
        NOT NULL DEFAULT 'active',
    keyedin_code VARCHAR(100),
    share_token UUID DEFAULT gen_random_uuid(),
    share_token_expires_at TIMESTAMP WITH TIME ZONE,
    country_code VARCHAR(2) DEFAULT 'IT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | Project identifier |
| `name` | VARCHAR(255) | Project name (e.g., "Customer Portal Migration") |
| `pm_id` | INTEGER FK | Owner PM (references `User.id`) |
| `currency` | VARCHAR(3) | ISO 4217 code; default GBP |
| `status` | VARCHAR(50) | Workflow: active → on_hold/closed/archived |
| `keyedin_code` | VARCHAR(100) | External project code for Keyedin sync |
| `share_token` | UUID | Public token for read-only sharing |
| `share_token_expires_at` | TIMESTAMP | Share token TTL (optional) |
| `country_code` | VARCHAR(2) | Country for holiday calendar (Italy: 'IT') |
| `created_at` | TIMESTAMP | When project was created |
| `updated_at` | TIMESTAMP | Last modification time |

**Design Rationale:**
- `pm_id` ties project to owner for access control (Step H: backend middleware filters by this)
- `keyedin_code` enables sync with external Keyedin system
- `share_token` allows read-only access without authentication
- `country_code` links to `PublicHoliday` for NETWORKDAYS calculations

---

### 3. ProjectPhase (5-Phase Sequential Structure)

Each project has exactly 5 phases in a fixed order. Phases are mutable: dates, costs, and status evolve.

```sql
CREATE TABLE "ProjectPhase" (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES "Project"(id) ON DELETE CASCADE,
    phase_type VARCHAR(50) CHECK (phase_type IN (
        'feasibility', 'planning_design', 'build', 'deployment', 'closure'
    )) NOT NULL,
    "order" INTEGER CHECK ("order" >= 1 AND "order" <= 5) NOT NULL,
    display_name VARCHAR(255) NOT NULL DEFAULT 'Phase',
    planned_start DATE,
    planned_end DATE,
    actual_start DATE,
    actual_end DATE,
    working_days INTEGER,
    planned_hours INTEGER,
    budget DECIMAL(15, 2),
    contingency_pct DECIMAL(5, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) CHECK (status IN ('not_started', 'in_progress', 'completed'))
        NOT NULL DEFAULT 'not_started'
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | Phase identifier |
| `project_id` | INTEGER FK | Parent project (ON DELETE CASCADE) |
| `phase_type` | VARCHAR(50) | Immutable type (feasibility, planning_design, build, deployment, closure) |
| `order` | INTEGER | 1-5 sequence within project (unique per project) |
| `display_name` | VARCHAR(255) | User-customizable phase name (e.g., "Design Sprint", "MVP Build") |
| `planned_start` | DATE | Planned phase start (ISO 8601) |
| `planned_end` | DATE | Planned phase end (ISO 8601) |
| `actual_start` | DATE | When phase actually started |
| `actual_end` | DATE | When phase actually ended |
| `working_days` | INTEGER | NETWORKDAYS between planned_start/end |
| `planned_hours` | INTEGER | Estimated effort (informational) |
| `budget` | DECIMAL(15,2) | Computed SUM(weekly_cost) from AllocationEntry |
| `contingency_pct` | DECIMAL(5,2) | Contingency buffer % (e.g., 10% for feasibility) |
| `status` | VARCHAR(50) | Current phase status (not_started / in_progress / completed) |

**Design Rationale:**
- `phase_type` is immutable (stored DB key); `display_name` is mutable (user-facing label)
- `order` enforces sequential structure and enables UI ordering
- `budget` is **not stored** but computed on-the-fly: `SUM(ae.weekly_cost) WHERE ae.phase_id = id`
- `contingency_pct` per phase allows flexible risk buffers
- Cascade delete when project is deleted; phases depend entirely on parent project

---

### 4. Resource (Central Registry)

Centralized list of team members/roles with day rates. Resources are shared across all projects.

```sql
CREATE TABLE "Resource" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    day_rate DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | Resource identifier |
| `name` | VARCHAR(255) | Person name (e.g., "Alice Chen") |
| `role` | VARCHAR(255) | Job title (e.g., "Senior Backend Engineer") |
| `day_rate` | DECIMAL(15,2) | Daily cost (GBP or project currency) |
| `created_at` | TIMESTAMP | When added to registry |

**Design Rationale:**
- Global registry; one resource can be allocated to multiple projects concurrently
- `day_rate` is static reference; historical rates are captured in `AllocationEntry.weekly_cost` at insert time
- Step G will add `day_rate` cascade updates to existing allocations (future enhancement)

---

### 5. AllocationEntry (Weekly Resource Assignments)

Maps resource × phase × week with FTE and materialized cost. This is the **source of truth for budget**.

```sql
CREATE TABLE "AllocationEntry" (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER REFERENCES "Resource"(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES "Project"(id) ON DELETE CASCADE,
    phase_id INTEGER REFERENCES "ProjectPhase"(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    fte DECIMAL(3, 2) CHECK (fte >= 0.0 AND fte <= 1.0) NOT NULL,
    working_days INTEGER NOT NULL,
    weekly_cost DECIMAL(15, 2) NOT NULL,
    UNIQUE (resource_id, project_id, phase_id, week_start)
);
```

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Allocation entry ID |
| `resource_id` | INTEGER FK | ON DELETE CASCADE | Which resource |
| `project_id` | INTEGER FK | ON DELETE CASCADE | Which project |
| `phase_id` | INTEGER FK | ON DELETE CASCADE | Which phase within project |
| `week_start` | DATE | NOT NULL | Monday of ISO week (YYYY-MM-DD) |
| `fte` | DECIMAL(3,2) | 0.0-1.0, NOT NULL | Full-time equivalent (0.5 = 50% of week) |
| `working_days` | INTEGER | NOT NULL | Business days in that week |
| `weekly_cost` | DECIMAL(15,2) | NOT NULL | Materialized: `day_rate × fte × working_days` |
| Constraint | UNIQUE | - | One allocation per (resource, project, phase, week) |

**Design Rationale:**
- **Weekly granularity** enables precise forecasting and load balancing
- **Materialized `weekly_cost`** at insert time ensures:
  - Fast SUM queries for phase/project budgets
  - Historical accuracy (if day_rate changes, cost is locked)
  - Simplifies variance calculations
- **FTE cap 1.0** per resource per week enforced by `AllocationAggregator.canAllocate()` on backend
- **Unique constraint** prevents double-booking within a project-phase-week combo
- Foreign keys use ON DELETE CASCADE to clean up when resource/project/phase is deleted

---

### 6. Baseline (Budget Lock & Snapshot)

Captures BAC (Budget at Completion) and variance metrics at a lock point in time.

```sql
CREATE TABLE "Baseline" (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES "Project"(id) ON DELETE CASCADE UNIQUE,
    contingency_pct DECIMAL(5, 2) NOT NULL DEFAULT 0,
    locked_at TIMESTAMP WITH TIME ZONE,
    total_budget_at_lock DECIMAL(15, 2),
    total_forecast_at_lock DECIMAL(15, 2),
    total_working_days_at_lock INTEGER,
    phase_snapshot_at_lock JSONB
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | Baseline record ID |
| `project_id` | INTEGER FK | Parent project (UNIQUE per project) |
| `contingency_pct` | DECIMAL(5,2) | Project-level contingency % |
| `locked_at` | TIMESTAMP | When baseline was locked (or NULL if unlocked) |
| `total_budget_at_lock` | DECIMAL(15,2) | BAC: SUM(weekly_cost) at lock time |
| `total_forecast_at_lock` | DECIMAL(15,2) | Forecast with contingency at lock |
| `total_working_days_at_lock` | INTEGER | SUM(working_days) across phases at lock |
| `phase_snapshot_at_lock` | JSONB | Immutable snapshot of phase data |

**phase_snapshot_at_lock Structure (JSONB Array):**
```json
[
  {
    "phase_id": 1,
    "phase_type": "feasibility",
    "display_name": "Feasibility",
    "order": 1,
    "planned_start": "2026-06-01",
    "planned_end": "2026-06-15",
    "working_days": 10,
    "planned_hours": 80,
    "budget": 5000.00,
    "contingency_pct": 10.0,
    "status": "not_started"
  },
  { /* ...more phases... */ }
]
```

**Design Rationale:**
- One baseline per project (UNIQUE constraint)
- `locked_at` timestamp marks when BAC was captured
- `total_budget_at_lock` is the **immutable BAC** reference for variance
- `phase_snapshot_at_lock` is a JSONB array documenting the phase structure and costs at lock time
- When project evolves (allocations change), working budget changes but BAC remains fixed
- Variance = (current_forecast - total_budget_at_lock) / total_budget_at_lock × 100%

---

### 7. OngoingSnapshot (Actuals Tracking)

Records project progress: actual hours spent, costs incurred, and working days used. Source can be manual or Keyedin API.

```sql
CREATE TABLE "OngoingSnapshot" (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES "Project"(id) ON DELETE CASCADE,
    phase_id INTEGER REFERENCES "ProjectPhase"(id) ON DELETE SET NULL,
    reporting_date DATE NOT NULL,
    hours_spent_to_date DECIMAL(10, 2) NOT NULL DEFAULT 0,
    cost_spent_to_date DECIMAL(15, 2) NOT NULL DEFAULT 0,
    working_days_used INTEGER NOT NULL DEFAULT 0,
    working_days_remaining INTEGER NOT NULL DEFAULT 0,
    source VARCHAR(50) CHECK (source IN ('manual', 'keyedin_api')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ongoing_project_phase_date (project_id, phase_id, reporting_date DESC)
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | Snapshot record ID |
| `project_id` | INTEGER FK | Parent project |
| `phase_id` | INTEGER FK | Phase this snapshot refers to (nullable; NULL = project-level) |
| `reporting_date` | DATE | Date of the progress report |
| `hours_spent_to_date` | DECIMAL(10,2) | Cumulative hours spent up to reporting_date |
| `cost_spent_to_date` | DECIMAL(15,2) | Cumulative cost spent up to reporting_date |
| `working_days_used` | INTEGER | Working days consumed |
| `working_days_remaining` | INTEGER | Estimated days left to project completion |
| `source` | VARCHAR(50) | 'manual' (user entry) or 'keyedin_api' (auto-sync) |
| `created_at` | TIMESTAMP | When this snapshot was recorded |

**Design Rationale:**
- Multiple snapshots per project (time-series of progress)
- `phase_id` is optional (NULL = project-level aggregate; Step E adds phase-level tracking)
- `source` indicates whether data is manually entered or synced from Keyedin
- Index on (project_id, phase_id, reporting_date DESC) enables fast retrieval of latest snapshot per phase
- Used to compute earned value and forecast completion

---

### 8. GanttTask (Tasks & Milestones)

Tasks and milestones within a phase for Gantt chart visualization and delivery tracking.

```sql
CREATE TABLE "GanttTask" (
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
    status VARCHAR(50) CHECK (status IN ('not_started', 'in_progress', 'completed'))
        NOT NULL DEFAULT 'not_started',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | Task ID |
| `project_id` | INTEGER FK | Parent project |
| `phase_id` | INTEGER FK | Phase within project |
| `name` | VARCHAR(255) | Task name (e.g., "Data Migration", "Go-Live") |
| `owner` | VARCHAR(255) | Person responsible |
| `start_date` | DATE | Planned start date |
| `end_date` | DATE | Planned end date |
| `working_days` | INTEGER | NETWORKDAYS(start_date, end_date) |
| `is_milestone` | BOOLEAN | TRUE for milestones (zero-duration events) |
| `actual_date` | DATE | When actually occurred/completed |
| `status` | VARCHAR(50) | not_started / in_progress / completed |
| `created_at` | TIMESTAMP | Record creation time |

**Design Rationale:**
- Tasks are optionally linked to phases (used for Gantt view and deliverable tracking)
- Milestones are marked with `is_milestone = TRUE`
- `actual_date` captures when milestone actually occurred
- No complex dependency graph (v1 is simple Gantt; dependencies can be added in v2)

---

### 9. PublicHoliday (Holiday Calendar)

Pre-seeded holiday calendar per country for NETWORKDAYS calculations.

```sql
CREATE TABLE "PublicHoliday" (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(2) NOT NULL DEFAULT 'IT',
    date DATE NOT NULL,
    name VARCHAR(255),
    UNIQUE (country_code, date)
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | Holiday record ID |
| `country_code` | VARCHAR(2) | ISO 3166-1 code (e.g., 'IT' for Italy) |
| `date` | DATE | Holiday date |
| `name` | VARCHAR(255) | Holiday name (e.g., 'Natale', 'Christmas') |

**Pre-seeded Data (Italy 2025-2027):**
- Capodanno (01-01)
- Epifania (01-06)
- Pasquetta (Easter Monday, variable)
- Festa della Liberazione (04-25)
- Festa del Lavoro (05-01)
- Festa della Repubblica (06-02)
- Ferragosto (08-15)
- Ognissanti (11-01)
- Immacolata Concezione (12-08)
- Natale (12-25)
- Santo Stefano (12-26)

**Design Rationale:**
- Lookup table for `NETWORKDAYS()` calculations in `computations.ts`
- Immutable reference data
- Extensible to other countries via `country_code`

---

### 10. PhaseTemplate (New-Project Defaults)

System-wide template for phase defaults when creating new projects.

```sql
CREATE TABLE "PhaseTemplate" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    "order" INTEGER NOT NULL,
    default_contingency_pct DECIMAL(5, 2) NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | Template record ID |
| `name` | VARCHAR(100) | Internal key (immutable; e.g., 'feasibility') |
| `display_name` | VARCHAR(255) | Default display name for new projects |
| `order` | INTEGER | Phase sequence |
| `default_contingency_pct` | DECIMAL(5,2) | Default contingency % for this phase type |
| `active` | BOOLEAN | Can deactivate templates for legacy data |

**Pre-seeded Data:**
```
('feasibility', 'Feasibility', 1, 10.0, true)
('planning_design', 'Planning & Design', 2, 0.0, true)
('build', 'Build', 3, 0.0, true)
('deployment', 'Deployment', 4, 0.0, true)
('closure', 'Closure', 5, 0.0, true)
```

**Design Rationale:**
- Used by project creation flow to auto-populate default phase structures
- Allows customization without hard-coding defaults in application code
- Separated from `ProjectPhase` to avoid coupling (templates are read-only system config)

---

## Relationships Diagram

```
User (1) -----> (*) Project
  |               |
  |               +-----> (*) ProjectPhase (1-5 per project)
  |               |          |
  |               |          +-----> (*) GanttTask
  |               |          |
  |               |          +<----- (*) AllocationEntry
  |               |
  |               +-----> (1) Baseline
  |               |
  |               +-----> (*) OngoingSnapshot
  |
  +<- (1) Baseline (pm_id filtering)

Resource (1) ----> (*) AllocationEntry

PublicHoliday ---------> NETWORKDAYS calculations (via computations.ts)

PhaseTemplate (1) ---> (*) ProjectPhase (at creation time)
```

### Foreign Key Constraints

| FK | References | ON DELETE | Purpose |
|---|---|---|---|
| Project.pm_id | User.id | SET NULL | Project owner |
| ProjectPhase.project_id | Project.id | CASCADE | Phase belongs to project |
| Resource.* | (no FK) | - | Global registry |
| AllocationEntry.resource_id | Resource.id | CASCADE | Allocation references resource |
| AllocationEntry.project_id | Project.id | CASCADE | Allocation references project |
| AllocationEntry.phase_id | ProjectPhase.id | CASCADE | Allocation references phase |
| Baseline.project_id | Project.id | CASCADE UNIQUE | One baseline per project |
| OngoingSnapshot.project_id | Project.id | CASCADE | Snapshot references project |
| OngoingSnapshot.phase_id | ProjectPhase.id | SET NULL | Phase is optional (project-level snapshot) |
| GanttTask.project_id | Project.id | CASCADE | Task references project |
| GanttTask.phase_id | ProjectPhase.id | CASCADE | Task references phase |

---

## Schema Details

### Uniqueness Constraints

| Table | Constraint | Rationale |
|---|---|---|
| User | email UNIQUE | One account per email |
| User | supabase_uid UNIQUE | One Supabase identity per user |
| Project | (none) | Multiple projects per PM allowed |
| ProjectPhase | (project_id, phase_type) implied | 5 fixed phases per project |
| Resource | (none) | Multiple resource definitions allowed (future: name+role combo?) |
| AllocationEntry | (resource_id, project_id, phase_id, week_start) | No double-booking |
| Baseline | project_id UNIQUE | One baseline per project |
| PublicHoliday | (country_code, date) | One holiday per date per country |
| PhaseTemplate | name UNIQUE | One template per phase type |

### Numeric Precision

| Field | Type | Rationale |
|---|---|---|
| day_rate | DECIMAL(15, 2) | GBP/currency; 2 fractional digits (pence) |
| budget, cost | DECIMAL(15, 2) | Same |
| fte | DECIMAL(3, 2) | 0.00-1.00; up to 3 total digits |
| contingency_pct | DECIMAL(5, 2) | 0.00-999.99; allows >100% for edge cases |

---

## Key Calculations

### Phase Budget (Computed, Not Stored)

```sql
SELECT SUM(ae.weekly_cost) AS phase_budget
FROM "AllocationEntry" ae
WHERE ae.phase_id = $1
GROUP BY ae.phase_id;
```

**Why computed:**
- Allocation entries are the authoritative source of cost
- Computing on-the-fly ensures consistency without sync issues
- Performance acceptable for typical project size (< 100 allocations per phase)

### Revised Forecast

```
revised_forecast = (time_based_forecast + cost_based_forecast) / 2

where:
  time_based_forecast = (spent_to_date / (working_days_used / total_working_days)) 
                         if pct_complete > 0
  cost_based_forecast = spent_to_date / budget_pct_of_total
                        if budget_pct_of_total > 0
```

See `backend/src/services/computations.ts` for implementation.

### RAG Status

```
ratio = revised_forecast / BAC

IN_LINEA:      ratio <= 1.05 (green)
A_RISCHIO:     1.05 < ratio <= 1.15 (amber)
FUORI_BUDGET:  ratio > 1.15 (red)
```

### Working Days (NETWORKDAYS)

```sql
NETWORKDAYS(start_date, end_date, holidays)
```

Calculated in backend service using:
- Weekends (Saturday, Sunday)
- Italian public holidays from `PublicHoliday` table
- Returns count of business days between two dates (inclusive)

See `frontend/src/utils/networkDays.ts` and `backend/src/services/computations.ts`.

---

## Migration History

Migrations are tracked in a `migrations` table (internal metadata, not user-visible).

| File | Description | Status |
|---|---|---|
| `001_initial_schema.sql` | User, Project, ProjectPhase | Applied |
| `002_resource_registry.sql` | Resource, AllocationEntry | Applied |
| `003_ongoing_snapshot.sql` | OngoingSnapshot | Applied |
| `004_allocation_week_granularity.sql` | month → week_start, monthly_cost → weekly_cost | Applied |
| `005_missing_tables.sql` | Baseline, PublicHoliday, GanttTask, PhaseTemplate | Applied |
| `006_project_keyedin_code.sql` | Add keyedin_code to Project | Applied |
| `007_phase_display_name.sql` | Add display_name, contingency_pct to ProjectPhase | Applied |
| `008_baseline_snapshot.sql` | Add phase_snapshot_at_lock, total_budget_at_lock, etc. | Applied |
| `009_ongoing_phase_id.sql` | Add phase_id to OngoingSnapshot (Step E) | Applied |
| `010_user_supabase_uid.sql` | Add supabase_uid to User (Step H) | Applied |

**Next planned migrations:**
- `011_*`: Phase-level Financial Engine (Step F)
- `012_*`: day_rate audit trail (Step G)

Run migrations with `pnpm migrate` from backend directory. See `backend/src/db/migrate.ts` for auto-runner.

---

## Indexing Strategy

Current indexes (created via migrations):

```sql
-- OngoingSnapshot lookup
CREATE INDEX idx_ongoing_project_phase_date 
  ON "OngoingSnapshot" (project_id, phase_id, reporting_date DESC);
```

**Recommended future indexes** (for performance):

| Index | Rationale |
|---|---|
| `idx_allocation_resource_week` | Aggregate FTE per resource per week (AllocationAggregator queries) |
| `idx_allocation_phase_week` | Query allocations per phase per week |
| `idx_phase_project` | List phases for a project (filtering) |
| `idx_gantt_task_phase` | Query tasks within a phase |
| `idx_baseline_project` | Usually queried via project_id |

Add these as performance testing identifies bottlenecks.

---

## Design Principles

### Immutability vs. Evolution

| Entity | Immutable | Mutable | Rationale |
|---|---|---|---|
| Baseline snapshot | YES (locked_at) | - | Historic reference point for variance |
| AllocationEntry.weekly_cost | YES (at insert) | - | Historical accuracy when day_rate changes |
| AllocationEntry.fte | NO | YES | User may adjust allocations |
| ProjectPhase.display_name | NO | YES | Customizable per project |
| ProjectPhase.phase_type | YES | - | Structural identifier |
| Resource.day_rate | NO | YES | May change; Step G backfills allocations |

### Single Source of Truth (SSOT)

| Concept | SSOT Location |
|---|---|
| Project Budget | AllocationEntry.weekly_cost (summed) |
| Budget at Completion | Baseline.total_budget_at_lock (snapshot) |
| Phase Progress | OngoingSnapshot (latest per phase) |
| Resource Availability | AllocationEntry (per week) |
| Phase Dates | ProjectPhase.planned_start/end (working copy) |

### Referential Integrity

- All foreign keys enabled with appropriate ON DELETE actions
- No orphaned records possible (cascade delete propagates)
- Phase template is read-only system data (not linked via FK from ProjectPhase)

---

## Best Practices

### Queries

**Do:**
- Use indexed columns in WHERE clauses
- Aggregate at query time for summary stats
- Filter by `pm_id` via Project table for access control

**Don't:**
- SELECT * without filtering by project_id / phase_id / week_start
- Rely on budget stored in ProjectPhase (compute from AllocationEntry)
- Assume Baseline snapshot is synced with current allocations

### Inserts/Updates

**Do:**
- Compute weekly_cost before INSERT into AllocationEntry
- Validate FTE cap against AllocationAggregator before INSERT
- Create new OngoingSnapshot records (append-only pattern)
- Lock baseline atomically with all phase snapshot data

**Don't:**
- Update AllocationEntry.weekly_cost after insert (recreate instead)
- Mutate phase_snapshot_at_lock (immutable by design)
- Assume phase_id is always present in OngoingSnapshot (nullable)

### Data Entry

**Do:**
- Validate date ranges (planned_start < planned_end)
- Ensure NETWORKDAYS >= 0 for phases
- Lock baseline before project is in-flight
- Seed PublicHoliday before running projects (required for NETWORKDAYS)

**Don't:**
- Allow phase overlap (sequentiality)
- Allow negative FTE or fte > 1.0
- Delete a project with active allocations (cascade will clean up)

---

## Future Enhancements

- **Phase dependencies** - Link phases with precedence rules (v2)
- **Resource skills matrix** - Track skills required vs. available (v2)
- **Budget versions** - Multiple baselines per project (Step J)
- **Audit trail** - Log changes to critical fields (Phase 2)
- **Currency conversion** - Multi-currency project portfolio (Phase 2)
