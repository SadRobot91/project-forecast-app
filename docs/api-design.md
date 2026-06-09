# API Design Reference

Complete REST API endpoint reference for Project Forecast App backend.

## Base URL

```
http://localhost:3000          (development)
https://your-domain.com        (production)
```

## Authentication

All endpoints except `/api/auth/*` require a Bearer token:

```
Authorization: Bearer <token>
```

Tokens are obtained via `/api/auth/login` and valid for the session duration defined by Supabase.

**Error responses:**
- `401 Unauthorized` — Missing token, invalid token, or expired token
- `403 Forbidden` — User not provisioned or insufficient role
- `503 Service Unavailable` — Auth service not configured

---

## Endpoints

### Authentication

#### POST /api/auth/login

Authenticate with email and password.

**Request:**
```json
{
  "email": "pm@example.com",
  "password": "secure_password"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Project Manager",
    "email": "pm@example.com",
    "role": "pm"
  }
}
```

**Error (401):**
```json
{
  "error": "Authentication failed"
}
```

#### POST /api/auth/logout

Sign out the current user.

**Request:**
```
(empty body)
```

**Response (200 OK):**
```json
{
  "message": "Logged out"
}
```

---

### Projects

#### GET /api/projects

List all projects accessible to the user.

**Query Parameters:**
- `status?` (string) — Filter by status: `active`, `on_hold`, `closed`, `archived`

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "RXI Platform",
    "status": "active",
    "rag_status": "IN_LINEA",
    "pm_id": 1,
    "current_phase": "build",
    "current_phase_display_name": "Build",
    "budget_total": 150000,
    "budget_spent": 45000,
    "budget_pct": 30,
    "days_remaining": 120,
    "currency": "GBP",
    "keyedin_code": "RXI2025",
    "created_at": "2025-01-01T10:00:00Z",
    "updated_at": "2025-01-10T15:30:00Z"
  }
]
```

#### GET /api/projects/:id

Retrieve a specific project.

**Path Parameters:**
- `id` (number) — Project ID

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "RXI Platform",
  "status": "active",
  "pm_id": 1,
  "currency": "GBP",
  "keyedin_code": "RXI2025",
  "share_token": "abc123def456",
  "created_at": "2025-01-01T10:00:00Z",
  "updated_at": "2025-01-10T15:30:00Z"
}
```

**Error (404):**
```json
{
  "error": "Project not found"
}
```

#### POST /api/projects

Create a new project.

**Request:**
```json
{
  "name": "New Project",
  "status": "active",
  "pm_id": 1,
  "currency": "GBP",
  "keyedin_code": "NPR2025"
}
```

**Response (201 Created):**
```json
{
  "id": 2,
  "name": "New Project",
  "status": "active",
  "pm_id": 1,
  "currency": "GBP",
  "keyedin_code": "NPR2025",
  "share_token": "xyz789uvw012",
  "created_at": "2025-01-15T08:00:00Z",
  "updated_at": "2025-01-15T08:00:00Z"
}
```

**Error (400):**
```json
{
  "error": "Missing required fields: name, pm_id"
}
```

#### PATCH /api/projects/:id/status

Update project status.

**Path Parameters:**
- `id` (number) — Project ID

**Request:**
```json
{
  "status": "on_hold"
}
```

**Response (200 OK):**
```json
{
  "message": "Status updated",
  "id": 1,
  "status": "on_hold"
}
```

#### DELETE /api/projects/:id

Delete a project.

**Path Parameters:**
- `id` (number) — Project ID

**Response (200 OK):**
```json
{
  "message": "Deleted",
  "id": 1
}
```

**Error (404):**
```json
{
  "error": "Project not found"
}
```

---

### Phases

#### GET /api/projects/:id/phases

List all phases for a project.

**Path Parameters:**
- `id` (number) — Project ID

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "project_id": 1,
    "phase_type": "feasibility",
    "display_name": "Feasibility",
    "order": 1,
    "planned_start": "2025-01-13",
    "planned_end": "2025-02-09",
    "working_days": 20,
    "planned_hours": 160,
    "status": "completed",
    "created_at": "2025-01-01T10:00:00Z",
    "updated_at": "2025-01-10T15:30:00Z"
  },
  {
    "id": 2,
    "project_id": 1,
    "phase_type": "planning_design",
    "display_name": "Planning & Design",
    "order": 2,
    "planned_start": "2025-02-10",
    "planned_end": "2025-03-23",
    "working_days": 30,
    "planned_hours": 240,
    "status": "in_progress",
    "created_at": "2025-01-01T10:00:00Z",
    "updated_at": "2025-01-10T15:30:00Z"
  }
]
```

#### PUT /api/projects/:id/phases/:pid

Update phase dates and status.

**Path Parameters:**
- `id` (number) — Project ID
- `pid` (number) — Phase ID

**Request:**
```json
{
  "planned_start": "2025-02-10",
  "planned_end": "2025-03-23",
  "status": "in_progress"
}
```

**Response (200 OK):**
```json
{
  "id": 2,
  "phase_type": "planning_design",
  "display_name": "Planning & Design",
  "planned_start": "2025-02-10",
  "planned_end": "2025-03-23",
  "working_days": 30,
  "status": "in_progress"
}
```

**Error (404):**
```json
{
  "error": "Phase not found"
}
```

---

### Resources

#### GET /api/resources

List all resources.

**Query Parameters:**
- `role?` (string) — Filter by role

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "Alice Dev",
    "role": "developer",
    "day_rate": 400,
    "created_at": "2025-01-01T10:00:00Z",
    "updated_at": "2025-01-10T15:30:00Z"
  },
  {
    "id": 2,
    "name": "Bob Designer",
    "role": "designer",
    "day_rate": 350,
    "created_at": "2025-01-01T10:00:00Z",
    "updated_at": "2025-01-10T15:30:00Z"
  }
]
```

#### POST /api/resources

Create a new resource.

**Request:**
```json
{
  "name": "Charlie QA",
  "role": "qa_engineer",
  "day_rate": 380
}
```

**Response (201 Created):**
```json
{
  "id": 3,
  "name": "Charlie QA",
  "role": "qa_engineer",
  "day_rate": 380,
  "created_at": "2025-01-15T08:00:00Z",
  "updated_at": "2025-01-15T08:00:00Z"
}
```

#### PUT /api/resources/:rid

Update resource day rate.

**Path Parameters:**
- `rid` (number) — Resource ID

**Request:**
```json
{
  "day_rate": 400
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Alice Dev",
  "role": "developer",
  "day_rate": 400
}
```

---

### Allocations

#### GET /api/projects/:id/allocation

Get allocation matrix for a project with registry of all resources.

**Path Parameters:**
- `id` (number) — Project ID

**Response (200 OK):**
```json
{
  "projectName": "RXI Platform",
  "phases": [
    {
      "phase_id": 1,
      "phase_type": "feasibility",
      "display_name": "Feasibility",
      "budget": 8000,
      "allocations": [
        {
          "id": 1,
          "resource_id": 1,
          "resource_name": "Alice Dev",
          "week_start": "2025-01-13",
          "fte": 1.0,
          "weekly_cost": 2000
        }
      ]
    }
  ],
  "registry": {
    "weeks": ["2025-01-13", "2025-01-20", "2025-01-27"],
    "rows": [
      {
        "resource": {
          "id": 1,
          "name": "Alice Dev",
          "role": "developer",
          "day_rate": 400
        },
        "allocations": [
          {
            "project_id": 1,
            "project_name": "RXI Platform",
            "project_status": "active",
            "week_start": "2025-01-13",
            "fte": 1.0
          }
        ],
        "totals": {
          "2025-01-13": 1.0,
          "2025-01-20": 0.0,
          "2025-01-27": 0.0
        }
      }
    ],
    "has_overallocation": false
  }
}
```

#### POST /api/projects/:id/allocation

Create an allocation entry.

**Path Parameters:**
- `id` (number) — Project ID

**Request:**
```json
{
  "phase_id": 1,
  "resource_id": 1,
  "week_start": "2025-01-13",
  "fte": 0.5
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "project_id": 1,
  "phase_id": 1,
  "resource_id": 1,
  "week_start": "2025-01-13",
  "fte": 0.5,
  "weekly_cost": 1000,
  "project_budget_used_pct": 12.5
}
```

**Error (409 — FTE cap exceeded):**
```json
{
  "error": "FTE cap exceeded",
  "excess": 0.3,
  "breakdown": [
    {
      "project_id": 1,
      "project_name": "RXI Platform",
      "fte": 0.8
    },
    {
      "project_id": 2,
      "project_name": "New Project",
      "fte": 0.5
    }
  ]
}
```

#### PUT /api/projects/:id/allocation/:aid

Update an allocation entry (with FTE cap check).

**Path Parameters:**
- `id` (number) — Project ID
- `aid` (number) — Allocation Entry ID

**Request:**
```json
{
  "fte": 0.8
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "fte": 0.8,
  "weekly_cost": 1600,
  "project_budget_used_pct": 20.0
}
```

**Error (409 — FTE cap exceeded):**
```json
{
  "error": "FTE cap exceeded",
  "excess": 0.2,
  "breakdown": [...]
}
```

#### DELETE /api/projects/:id/allocation/:aid

Delete an allocation entry.

**Path Parameters:**
- `id` (number) — Project ID
- `aid` (number) — Allocation Entry ID

**Response (200 OK):**
```json
{
  "message": "Deleted",
  "id": 1
}
```

---

### Dashboard & KPIs

#### GET /api/projects/:id/dashboard

Retrieve project dashboard with KPIs, phase budgets, milestones, and financial rollup.

**Path Parameters:**
- `id` (number) — Project ID

**Response (200 OK):**
```json
{
  "phases": [
    {
      "phase_id": 1,
      "phase_type": "feasibility",
      "display_name": "Feasibility",
      "planned_start": "2025-01-13",
      "planned_end": "2025-02-09",
      "working_days": 20,
      "planned_hours": 160,
      "burn_rate_per_day": 400,
      "budget": 8000,
      "budget_pct_of_total": 5.3,
      "status": "completed",
      "cost_spent": 8000,
      "pct_complete": 100
    }
  ],
  "kpis": {
    "cost_spent": 45000,
    "budget_total": 150000,
    "revised_forecast": 155000,
    "daily_burn_rate": 1250,
    "variance": 5000,
    "days_remaining": 120,
    "budget_pct": 30,
    "rag_status": "A_RISCHIO",
    "last_sync_at": "2025-01-10T15:30:00Z",
    "last_sync_source": "manual",
    "hours_spent_to_date": 360,
    "working_days_used": 36
  },
  "milestones": [
    {
      "id": 1,
      "name": "Design Approval",
      "planned_date": "2025-02-15",
      "actual_date": "2025-02-14",
      "status": "completed"
    }
  ],
  "rollup": {
    "total_budget": 150000,
    "total_cost_spent": 45000,
    "total_revised_forecast": 155000,
    "total_variance": 5000,
    "rag_status": "A_RISCHIO"
  }
}
```

---

### Baseline & Budget Locks

#### GET /api/projects/:id/baseline

Get current baseline (budget lock).

**Path Parameters:**
- `id` (number) — Project ID

**Response (200 OK):**
```json
{
  "baseline_id": 1,
  "locked_at": "2025-01-01T10:00:00Z",
  "total_budget_at_lock": 150000,
  "phase_snapshot_at_lock": {
    "1": { "budget": 8000, "phase_type": "feasibility" },
    "2": { "budget": 30000, "phase_type": "planning_design" },
    "3": { "budget": 60000, "phase_type": "build" }
  }
}
```

**Response (204 No Content):** if no baseline exists

#### POST /api/projects/:id/baseline/lock

Lock project budget at current state.

**Path Parameters:**
- `id` (number) — Project ID

**Request:**
```json
{}
```

**Response (201 Created):**
```json
{
  "baseline_id": 1,
  "locked_at": "2025-01-15T08:00:00Z",
  "total_budget_at_lock": 150000
}
```

**Error (409):**
```json
{
  "error": "Baseline already locked"
}
```

---

### Ongoing Actuals

#### GET /api/projects/:id/ongoing

Get latest actuals snapshot.

**Path Parameters:**
- `id` (number) — Project ID

**Response (200 OK):**
```json
{
  "id": 5,
  "project_id": 1,
  "reporting_date": "2025-01-10",
  "cost_spent_to_date": 45000,
  "hours_spent_to_date": 360,
  "working_days_used": 36,
  "working_days_remaining": 120,
  "source": "manual",
  "created_at": "2025-01-10T15:30:00Z",
  "updated_at": "2025-01-10T15:30:00Z"
}
```

**Response (204 No Content):** if no snapshot exists

#### POST /api/projects/:id/ongoing/snapshot

Record actuals.

**Path Parameters:**
- `id` (number) — Project ID

**Request:**
```json
{
  "cost_spent_to_date": 45000,
  "hours_spent_to_date": 360,
  "working_days_used": 36,
  "source": "manual"
}
```

**Response (201 Created):**
```json
{
  "id": 5,
  "project_id": 1,
  "cost_spent_to_date": 45000,
  "hours_spent_to_date": 360,
  "working_days_used": 36,
  "source": "manual",
  "created_at": "2025-01-10T15:30:00Z"
}
```

#### POST /api/projects/:id/ongoing/sync-keyedin

Sync actuals from Keyedin API (if configured).

**Path Parameters:**
- `id` (number) — Project ID

**Request:**
```json
{}
```

**Response (200 OK):**
```json
{
  "synced_at": "2025-01-10T15:45:00Z",
  "new_snapshot": {
    "id": 5,
    "cost_spent_to_date": 46200,
    "hours_spent_to_date": 368,
    "working_days_used": 37,
    "source": "keyedin_api"
  }
}
```

**Error (503):**
```json
{
  "error": "Keyedin service not configured"
}
```

---

### Gantt Tasks & Milestones

#### GET /api/projects/:id/gantt

List Gantt tasks and milestones.

**Path Parameters:**
- `id` (number) — Project ID

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "project_id": 1,
    "phase_id": 1,
    "name": "Kickoff Meeting",
    "start_date": "2025-01-13",
    "end_date": "2025-01-13",
    "is_milestone": true,
    "status": "completed",
    "actual_date": "2025-01-13",
    "created_at": "2025-01-01T10:00:00Z"
  },
  {
    "id": 2,
    "project_id": 1,
    "phase_id": 1,
    "name": "Requirements Review",
    "start_date": "2025-01-20",
    "end_date": "2025-02-03",
    "is_milestone": false,
    "status": "completed",
    "actual_date": "2025-02-03",
    "created_at": "2025-01-01T10:00:00Z"
  }
]
```

#### POST /api/projects/:id/gantt

Create a Gantt task or milestone.

**Path Parameters:**
- `id` (number) — Project ID

**Request:**
```json
{
  "phase_id": 1,
  "name": "Design Sign-off",
  "start_date": "2025-02-15",
  "end_date": "2025-02-15",
  "is_milestone": true,
  "status": "not_started"
}
```

**Response (201 Created):**
```json
{
  "id": 3,
  "project_id": 1,
  "phase_id": 1,
  "name": "Design Sign-off",
  "start_date": "2025-02-15",
  "end_date": "2025-02-15",
  "is_milestone": true,
  "status": "not_started",
  "created_at": "2025-01-15T08:00:00Z"
}
```

#### PUT /api/projects/:id/gantt/:tid

Update Gantt task status and/or actual date.

**Path Parameters:**
- `id` (number) — Project ID
- `tid` (number) — Task ID

**Request:**
```json
{
  "status": "completed",
  "actual_date": "2025-02-15"
}
```

**Response (200 OK):**
```json
{
  "id": 3,
  "status": "completed",
  "actual_date": "2025-02-15"
}
```

#### DELETE /api/projects/:id/gantt/:tid

Delete a task or milestone.

**Path Parameters:**
- `id` (number) — Project ID
- `tid` (number) — Task ID

**Response (200 OK):**
```json
{
  "message": "Deleted",
  "id": 3
}
```

---

### Phase Templates

#### GET /api/phase-templates

List default phase templates.

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "feasibility",
    "display_name": "Feasibility",
    "order": 1,
    "default_contingency_pct": 10,
    "active": true
  },
  {
    "id": 2,
    "name": "planning_design",
    "display_name": "Planning & Design",
    "order": 2,
    "default_contingency_pct": 15,
    "active": true
  }
]
```

#### PUT /api/phase-templates/:tid

Update phase template.

**Path Parameters:**
- `tid` (number) — Template ID

**Request:**
```json
{
  "display_name": "Planning & Design (Updated)",
  "default_contingency_pct": 20,
  "active": true
}
```

**Response (200 OK):**
```json
{
  "id": 2,
  "name": "planning_design",
  "display_name": "Planning & Design (Updated)",
  "order": 2,
  "default_contingency_pct": 20,
  "active": true
}
```

---

### Health & Status

#### GET /api/health

Check backend health.

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

---

## Common Query Patterns

### Filtering by Date Range

Some endpoints support date filtering via query parameters:

```
GET /api/projects/1/gantt?from=2025-01-01&to=2025-03-31
```

### Pagination

For future large-data endpoints, pagination will follow:

```
GET /api/projects?skip=0&limit=20
```

### Ordering

Endpoints respect natural ordering:

```
GET /api/projects/1/phases          # Ordered by phase.order
GET /api/resources                   # Ordered by name
GET /api/projects/1/gantt           # Ordered by start_date
```

---

## Error Codes Summary

| Code | Scenario |
|---|---|
| 400 | Missing/invalid input, type mismatch, constraint violation |
| 401 | Missing token, invalid token, expired token |
| 403 | User not provisioned, insufficient permissions, pm_id mismatch |
| 404 | Resource not found (project, phase, allocation, etc.) |
| 409 | Business logic conflict (FTE cap, duplicate baseline, etc.) |
| 500 | Unexpected server error, database error |
| 503 | Service unavailable (Supabase Auth, Keyedin API) |

---

## Rate Limiting

Currently no rate limiting. Production deployment should implement:
- Per-user rate limits (e.g., 100 requests/minute)
- Per-IP rate limits for unauthenticated endpoints
- Burst allowance for bulk operations

---

## Data Types

### ISO 8601 Dates

All date fields use ISO 8601 format:
- Date: `YYYY-MM-DD` (e.g., `2025-01-13`)
- DateTime: `YYYY-MM-DDTHH:MM:SSZ` (e.g., `2025-01-13T15:30:00Z`)

### Numeric Precision

- **Currency amounts**: Fixed 2 decimal places in responses (e.g., `1000.00`)
- **FTE**: Up to 4 decimal places (e.g., `0.5`, `0.75`, `1.0`)
- **Percentages**: Whole numbers in responses (e.g., `30` = 30%)

### Enums

**RAG Status:**
- `IN_LINEA` — On track (forecast ≤ 1.05 × baseline)
- `A_RISCHIO` — At risk (forecast ≤ 1.15 × baseline)
- `FUORI_BUDGET` — Over budget (forecast > 1.15 × baseline)

**Project Status:**
- `active` — Currently running
- `on_hold` — Paused
- `closed` — Finished and closed
- `archived` — Historical (read-only)

**Phase Status:**
- `not_started`
- `in_progress`
- `completed`

**User Role:**
- `pm` — Project Manager
- `dm` — Delivery Manager

**Allocation Source:**
- `manual` — User-entered
- `keyedin_api` — Synced from Keyedin
- `import` — Bulk import

---

## Versioning

API versioning via URL path (future):

```
GET /api/v1/projects       # Current stable
GET /api/v2-beta/projects  # Beta features
```

Currently on implicit v1. Breaking changes will increment version.

---

## CORS

CORS is enabled for all origins in development. Production should restrict to known domains:

```javascript
cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') })
```

---

## Webhook Support

Planned for future releases:
- `project.updated` — Project status changed
- `allocation.created` — New allocation added
- `baseline.locked` — Budget locked
- `snapshot.synced` — Actuals updated

---

## OpenAPI / Swagger

TODO: Generate OpenAPI spec from this documentation.

```yaml
openapi: 3.0.0
info:
  title: Project Forecast App API
  version: 1.0.0
servers:
  - url: http://localhost:3000
paths:
  /api/projects:
    get:
      summary: List projects
      tags: [Projects]
      responses:
        200:
          description: Project list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ProjectSummary'
```

---

## Changelog

### Version 1.0.0 (2025-01-15)

- Initial API release
- Auth endpoints: login, logout
- Projects, phases, resources, allocations, baseline, ongoing, Gantt, dashboard
- FTE cap enforcement on allocation creation

### Upcoming

- Step D: FTE cap on allocation update (PUT)
- Step E: phase_id on OngoingSnapshot
- Step F: Phase-level financial engine (rollup per phase)
- Webhook support
- OpenAPI spec
- API key authentication (alternative to Bearer tokens)

---

## Support

For API issues, check:
1. Backend logs: `cd backend && pnpm run dev`
2. Database connectivity: `psql $DATABASE_URL -c "SELECT 1"`
3. Supabase auth: Console logs in `requireAuth` middleware
4. Test suite: `cd backend && pnpm test`
