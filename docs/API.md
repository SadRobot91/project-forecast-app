# API Reference — Project Forecast App

Complete documentation of all backend REST API endpoints, request/response formats, error handling, and authentication.

## Table of Contents

1. [Authentication](#authentication)
2. [Base URL & Headers](#base-url--headers)
3. [Projects](#projects)
4. [Baseline & Budget](#baseline--budget)
5. [Resource Allocation](#resource-allocation)
6. [Resources](#resources)
7. [Ongoing (Actuals) Tracking](#ongoing-actuals-tracking)
8. [Gantt & Tasks](#gantt--tasks)
9. [Dashboard](#dashboard)
10. [Error Handling](#error-handling)
11. [Rate Limiting](#rate-limiting)

---

## Authentication

### Supabase Auth

All protected endpoints require a valid JWT token from Supabase Auth.

**Obtain Token (Frontend):**
```typescript
// In Login.tsx
import { supabase } from '../api/supabase';

const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});

if (data.session) {
  localStorage.setItem('token', data.session.access_token);
}
```

**Send Token with Request:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The `apiClient()` wrapper automatically includes this header:
```typescript
const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};
```

### Mock Authentication (Development)

When `VITE_USE_MOCK=true`, use mock token:
```
Authorization: Bearer mock-jwt-token-dev
```

---

## Base URL & Headers

### Base URL

- **Development:** `http://localhost:3000`
- **Production (Vercel):** `https://your-domain.vercel.app`

All endpoints are prefixed with `/api/`.

### Request Headers

```
Content-Type: application/json
Authorization: Bearer <token>
```

### Response Format

All responses are JSON.

**Success (2xx):**
```json
{
  "id": 1,
  "name": "Project A",
  "status": "active"
}
```

**Error (4xx, 5xx):**
```json
{
  "error": "Resource not found",
  "details": "Project with id 999 does not exist"
}
```

---

## Projects

### List Projects

**GET** `/api/projects`

Returns all projects for the authenticated PM.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Website Redesign",
    "status": "active",
    "rag_status": "IN_LINEA",
    "current_phase": "planning_design",
    "current_phase_display_name": "Planning & Design",
    "budget_total": 100000,
    "budget_spent": 45000,
    "budget_pct": 45,
    "days_remaining": 120,
    "currency": "GBP"
  },
  {
    "id": 2,
    "name": "Data Migration",
    "status": "active",
    "rag_status": "A_RISCHIO",
    "current_phase": "build",
    "current_phase_display_name": "Build",
    "budget_total": 250000,
    "budget_spent": 180000,
    "budget_pct": 72,
    "days_remaining": 45,
    "currency": "GBP"
  }
]
```

**Status Codes:**
- `200` — Success
- `401` — Unauthorized (invalid/missing token)

---

### Get Project Detail

**GET** `/api/projects/:id`

Returns detailed information for a single project.

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | number | Project ID (URL param) |

**Response:**
```json
{
  "id": 1,
  "name": "Website Redesign",
  "description": "Complete redesign of customer portal",
  "status": "active",
  "pm_id": 42,
  "keyedin_code": "WEB-2025",
  "share_token": "abc123def456",
  "phases": [
    {
      "phase_id": 1,
      "phase_type": "feasibility",
      "display_name": "Feasibility",
      "order": 1,
      "planned_start": "2025-01-06",
      "planned_end": "2025-01-17",
      "status": "completed",
      "budget": 25000,
      "contingency_pct": 10,
      "working_days": 10,
      "planned_hours": 80
    },
    {
      "phase_id": 2,
      "phase_type": "planning_design",
      "display_name": "Planning & Design",
      "order": 2,
      "planned_start": "2025-01-20",
      "planned_end": "2025-03-07",
      "status": "in_progress",
      "budget": 50000,
      "contingency_pct": 15,
      "working_days": 35,
      "planned_hours": 280
    }
  ],
  "created_at": "2025-01-01T10:00:00Z",
  "updated_at": "2025-06-08T15:30:00Z"
}
```

**Status Codes:**
- `200` — Success
- `401` — Unauthorized
- `404` — Project not found
- `403` — Forbidden (not your project)

---

### Create Project

**POST** `/api/projects`

Creates a new project.

**Request Body:**
```json
{
  "name": "New Project",
  "description": "Optional description",
  "status": "active",
  "currency": "GBP"
}
```

**Response:** (201 Created)
```json
{
  "id": 3,
  "name": "New Project",
  "description": "Optional description",
  "status": "active",
  "pm_id": 42,
  "phases": [
    {
      "phase_id": 11,
      "phase_type": "feasibility",
      "display_name": "Feasibility",
      "order": 1,
      "planned_start": null,
      "planned_end": null,
      "status": "not_started",
      "budget": 0,
      "contingency_pct": 10
    },
    // ... 4 more default phases
  ],
  "created_at": "2025-06-08T16:00:00Z"
}
```

**Status Codes:**
- `201` — Created
- `400` — Invalid input
- `401` — Unauthorized

---

### Update Project

**PUT** `/api/projects/:id`

Updates project metadata.

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | number | Project ID |

**Request Body:**
```json
{
  "name": "Updated Name",
  "status": "on_hold",
  "keyedin_code": "NEW-CODE"
}
```

**Response:** (200 OK)
```json
{
  "id": 1,
  "name": "Updated Name",
  "status": "on_hold",
  "pm_id": 42,
  "keyedin_code": "NEW-CODE",
  "updated_at": "2025-06-08T16:15:00Z"
}
```

**Status Codes:**
- `200` — Success
- `400` — Invalid input
- `401` — Unauthorized
- `404` — Project not found

---

## Baseline & Budget

### Get Baseline

**GET** `/api/projects/:id/baseline`

Returns baseline snapshot if locked, or current working baseline.

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | number | Project ID |

**Response:**
```json
{
  "project_id": 1,
  "is_locked": true,
  "locked_at": "2025-05-15T10:00:00Z",
  "total_budget_at_lock": 150000,
  "total_forecast_at_lock": 157500,
  "total_working_days_at_lock": 180,
  "phase_snapshot_at_lock": [
    {
      "phase_id": 1,
      "phase_type": "feasibility",
      "budget": 25000,
      "contingency_pct": 10,
      "working_days": 10
    },
    // ... more phases
  ],
  "phases": [
    {
      "phase_id": 1,
      "phase_type": "feasibility",
      "display_name": "Feasibility",
      "order": 1,
      "planned_start": "2025-01-06",
      "planned_end": "2025-01-17",
      "budget": 25000,
      "contingency_pct": 10
    },
    // ... more phases
  ]
}
```

**Status Codes:**
- `200` — Success
- `401` — Unauthorized
- `404` — Baseline not found

---

### Save Baseline (Phases & Dates)

**PUT** `/api/projects/:id/baseline`

Updates phase dates and contingency percentages (only if NOT locked).

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | number | Project ID |

**Request Body:**
```json
{
  "phases": [
    {
      "phase_id": 1,
      "planned_start": "2025-01-06",
      "planned_end": "2025-01-17",
      "contingency_pct": 10,
      "display_name": "Feasibility"
    },
    {
      "phase_id": 2,
      "planned_start": "2025-01-20",
      "planned_end": "2025-03-07",
      "contingency_pct": 15,
      "display_name": "Planning & Design"
    }
  ]
}
```

**Response:** (200 OK)
```json
{
  "success": true,
  "updated_phases": 2,
  "message": "Baseline phases updated successfully"
}
```

**Status Codes:**
- `200` — Success
- `400` — Invalid input (bad dates, locked baseline)
- `401` — Unauthorized
- `404` — Project not found
- `409` — Conflict (baseline locked)

---

### Lock Baseline

**POST** `/api/projects/:id/baseline/lock`

Freezes the baseline snapshot (BAC). Cannot be undone (future re-baselining planned).

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | number | Project ID |

**Request Body:** (none)

**Response:** (200 OK)
```json
{
  "success": true,
  "locked_at": "2025-06-08T16:30:00Z",
  "total_budget_at_lock": 150000,
  "total_forecast_at_lock": 157500,
  "total_working_days_at_lock": 180
}
```

**Status Codes:**
- `200` — Success
- `401` — Unauthorized
- `404` — Project not found
- `409` — Already locked

---

## Resource Allocation

### Get Allocation Matrix

**GET** `/api/projects/:id/allocations`

Returns allocation matrix (resource × phase × week) for a project.

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | number | Project ID |

**Query Params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `start` | ISO date | Phase start | Week range start |
| `end` | ISO date | Phase end | Week range end |

**Response:**
```json
{
  "project_id": 1,
  "weeks": ["2025-01-06", "2025-01-13", "2025-01-20", ...],
  "phases": [
    {
      "phase_id": 1,
      "phase_type": "feasibility",
      "display_name": "Feasibility",
      "order": 1
    },
    // ... more phases
  ],
  "resources": [
    {
      "resource_id": 1,
      "name": "Alice Johnson",
      "day_rate": 500,
      "allocations": [
        {
          "week_start": "2025-01-06",
          "phase_id": 1,
          "fte": 0.5,
          "working_days": 5,
          "weekly_cost": 1250
        },
        {
          "week_start": "2025-01-06",
          "phase_id": 2,
          "fte": 0.5,
          "working_days": 5,
          "weekly_cost": 1250
        }
      ]
    },
    // ... more resources
  ],
  "warnings": [
    {
      "week_start": "2025-01-13",
      "resource_id": 1,
      "total_fte": 1.2,
      "message": "Resource exceeds 1.0 FTE in this week"
    }
  ]
}
```

**Status Codes:**
- `200` — Success
- `401` — Unauthorized
- `404` — Project not found

---

### Create/Update Allocation Entry

**PUT** `/api/projects/:id/allocations`

Creates or updates a single allocation entry.

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | number | Project ID |

**Request Body:**
```json
{
  "resource_id": 1,
  "phase_id": 2,
  "week_start": "2025-01-13",
  "fte": 0.75
}
```

**Response:** (200 OK or 201 Created)
```json
{
  "allocation_id": 42,
  "resource_id": 1,
  "phase_id": 2,
  "week_start": "2025-01-13",
  "fte": 0.75,
  "working_days": 5,
  "day_rate": 500,
  "weekly_cost": 1875,
  "created_at": "2025-06-08T16:45:00Z"
}
```

**Status Codes:**
- `200` — Updated
- `201` — Created
- `400` — Invalid input
- `401` — Unauthorized
- `404` — Project/resource/phase not found
- `409` — FTE cap exceeded (Step D validation)

---

### Delete Allocation Entry

**DELETE** `/api/projects/:id/allocations/:allocationId`

Removes an allocation entry.

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | number | Project ID |
| `allocationId` | number | Allocation entry ID |

**Response:** (204 No Content)

**Status Codes:**
- `204` — Deleted
- `401` — Unauthorized
- `404` — Not found

---

## Resources

### List Resources

**GET** `/api/resources`

Returns all resources in the system with utilization summary.

**Query Params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `week_start` | ISO date | Current week | Week for utilization calculation |

**Response:**
```json
[
  {
    "resource_id": 1,
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "day_rate": 500,
    "utilization": {
      "week_start": "2025-06-08",
      "total_fte": 0.8,
      "projects_allocated": 2,
      "available_fte": 0.2,
      "warnings": []
    }
  },
  {
    "resource_id": 2,
    "name": "Bob Smith",
    "email": "bob@example.com",
    "day_rate": 650,
    "utilization": {
      "week_start": "2025-06-08",
      "total_fte": 1.1,
      "projects_allocated": 3,
      "available_fte": -0.1,
      "warnings": [
        {
          "project_id": 1,
          "phase_id": 3,
          "fte": 0.4,
          "message": "Over-allocated by 0.1 FTE"
        }
      ]
    }
  }
]
```

**Status Codes:**
- `200` — Success
- `401` — Unauthorized

---

### Create Resource

**POST** `/api/resources`

Adds a new resource to the registry.

**Request Body:**
```json
{
  "name": "Carol Davis",
  "email": "carol@example.com",
  "day_rate": 600
}
```

**Response:** (201 Created)
```json
{
  "resource_id": 3,
  "name": "Carol Davis",
  "email": "carol@example.com",
  "day_rate": 600,
  "created_at": "2025-06-08T17:00:00Z"
}
```

**Status Codes:**
- `201` — Created
- `400` — Invalid input (missing fields)
- `401` — Unauthorized
- `409` — Resource already exists

---

### Update Resource

**PUT** `/api/resources/:id`

Updates resource information.

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | number | Resource ID |

**Request Body:**
```json
{
  "day_rate": 625
}
```

**Response:** (200 OK)
```json
{
  "resource_id": 1,
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "day_rate": 625,
  "updated_at": "2025-06-08T17:10:00Z"
}
```

**Status Codes:**
- `200` — Success
- `400` — Invalid input
- `401` — Unauthorized
- `404` — Resource not found

---

## Ongoing (Actuals) Tracking

### Get Latest Snapshot

**GET** `/api/projects/:id/ongoing`

Returns the most recent actual spend/hours/days snapshot.

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | number | Project ID |

**Response:**
```json
{
  "snapshot_id": 1,
  "project_id": 1,
  "hours_spent": 320,
  "cost_spent": 32000,
  "working_days_used": 40,
  "source": "manual",
  "recorded_at": "2025-06-08T15:00:00Z",
  "notes": "Status as of end of week 23"
}
```

**Status Codes:**
- `200` — Success
- `401` — Unauthorized
- `404` — No snapshot found for this project

---

### Record New Snapshot (Manual)

**POST** `/api/projects/:id/ongoing`

Records a new manual actuals snapshot.

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | number | Project ID |

**Request Body:**
```json
{
  "hours_spent": 320,
  "cost_spent": 32000,
  "working_days_used": 40,
  "notes": "Status as of 2025-06-08"
}
```

**Response:** (201 Created)
```json
{
  "snapshot_id": 2,
  "project_id": 1,
  "hours_spent": 320,
  "cost_spent": 32000,
  "working_days_used": 40,
  "source": "manual",
  "recorded_at": "2025-06-08T17:30:00Z"
}
```

**Status Codes:**
- `201` — Created
- `400` — Invalid input
- `401` — Unauthorized
- `404` — Project not found

---

### Sync with Keyedin API

**POST** `/api/projects/:id/ongoing/sync-keyedin`

Pulls actuals from Keyedin API and records a new snapshot.

Requires `KEYEDIN_API_URL` and `KEYEDIN_API_KEY` in backend `.env`.

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | number | Project ID |

**Request Body:** (optional)
```json
{
  "force": true  // Force refresh even if recent sync
}
```

**Response:** (201 Created)
```json
{
  "snapshot_id": 3,
  "project_id": 1,
  "hours_spent": 335,
  "cost_spent": 33500,
  "working_days_used": 42,
  "source": "keyedin_api",
  "recorded_at": "2025-06-08T17:45:00Z",
  "message": "Successfully synced from Keyedin"
}
```

**Status Codes:**
- `201` — Synced
- `400` — Invalid project keyedin_code
- `401` — Unauthorized
- `404` — Project not found
- `503` — Keyedin API unavailable (falls back to manual)

---

## Gantt & Tasks

### Get Gantt Data

**GET** `/api/projects/:id/gantt`

Returns tasks, milestones, and phases for Gantt chart visualization.

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | number | Project ID |

**Response:**
```json
{
  "project_id": 1,
  "phases": [
    {
      "phase_id": 1,
      "phase_type": "feasibility",
      "display_name": "Feasibility",
      "planned_start": "2025-01-06",
      "planned_end": "2025-01-17",
      "working_days": 10,
      "status": "completed"
    },
    // ... more phases
  ],
  "tasks": [
    {
      "task_id": 1,
      "phase_id": 1,
      "name": "Requirements gathering",
      "planned_date": "2025-01-10",
      "actual_date": "2025-01-10",
      "status": "completed",
      "is_milestone": false
    },
    {
      "task_id": 2,
      "phase_id": 2,
      "name": "Design approval",
      "planned_date": "2025-02-28",
      "actual_date": null,
      "status": "in_progress",
      "is_milestone": true
    }
  ]
}
```

**Status Codes:**
- `200` — Success
- `401` — Unauthorized
- `404` — Project not found

---

### Create Task/Milestone

**POST** `/api/projects/:id/gantt/tasks`

Adds a new task or milestone.

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | number | Project ID |

**Request Body:**
```json
{
  "phase_id": 2,
  "name": "Database schema finalized",
  "planned_date": "2025-02-15",
  "is_milestone": true
}
```

**Response:** (201 Created)
```json
{
  "task_id": 3,
  "phase_id": 2,
  "name": "Database schema finalized",
  "planned_date": "2025-02-15",
  "actual_date": null,
  "status": "not_started",
  "is_milestone": true,
  "created_at": "2025-06-08T18:00:00Z"
}
```

**Status Codes:**
- `201` — Created
- `400` — Invalid input
- `401` — Unauthorized
- `404` — Project/phase not found

---

### Update Task Status

**PUT** `/api/projects/:id/gantt/tasks/:taskId`

Updates task status and/or actual date.

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | number | Project ID |
| `taskId` | number | Task ID |

**Request Body:**
```json
{
  "status": "completed",
  "actual_date": "2025-02-15"
}
```

**Response:** (200 OK)
```json
{
  "task_id": 2,
  "status": "completed",
  "actual_date": "2025-02-15",
  "updated_at": "2025-06-08T18:10:00Z"
}
```

**Status Codes:**
- `200` — Updated
- `400` — Invalid input
- `401` — Unauthorized
- `404` — Task not found

---

## Dashboard

### Get Dashboard KPIs

**GET** `/api/projects/:id/dashboard`

Returns KPIs, phase budget breakdown, and milestone status for dashboard view.

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | number | Project ID |

**Response:**
```json
{
  "project_id": 1,
  "project_name": "Website Redesign",
  "kpis": {
    "cost_spent": 45000,
    "budget_total": 150000,
    "revised_forecast": 157500,
    "daily_burn_rate": 833.33,
    "variance": 7500,
    "days_remaining": 120,
    "budget_pct": 30,
    "rag_status": "IN_LINEA",
    "last_sync_at": "2025-06-08T15:00:00Z",
    "last_sync_source": "manual",
    "hours_spent_to_date": 320,
    "working_days_used": 40
  },
  "phases": [
    {
      "phase_id": 1,
      "phase_type": "feasibility",
      "display_name": "Feasibility",
      "planned_start": "2025-01-06",
      "planned_end": "2025-01-17",
      "working_days": 10,
      "planned_hours": 80,
      "burn_rate_per_day": 2500,
      "budget": 25000,
      "budget_pct_of_total": 17
    },
    {
      "phase_id": 2,
      "phase_type": "planning_design",
      "display_name": "Planning & Design",
      "planned_start": "2025-01-20",
      "planned_end": "2025-03-07",
      "working_days": 35,
      "planned_hours": 280,
      "burn_rate_per_day": 1429,
      "budget": 50000,
      "budget_pct_of_total": 33
    }
    // ... more phases
  ],
  "milestones": [
    {
      "task_id": 1,
      "name": "Requirements approval",
      "planned_date": "2025-01-10",
      "actual_date": "2025-01-10",
      "status": "completed",
      "days_variance": 0
    },
    {
      "task_id": 2,
      "name": "Design sign-off",
      "planned_date": "2025-02-28",
      "actual_date": null,
      "status": "in_progress",
      "days_variance": null
    }
  ]
}
```

**Status Codes:**
- `200` — Success
- `401` — Unauthorized
- `404` — Project not found

---

## Error Handling

### Error Response Format

All errors return JSON with consistent format:

```json
{
  "error": "Human-readable error message",
  "details": "Optional additional context",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| HTTP Status | Code | Description |
|---|---|---|
| 400 | `INVALID_INPUT` | Malformed request body or invalid parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 403 | `FORBIDDEN` | Authenticated but not authorized for this resource |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Request conflicts with current state (e.g., baseline locked) |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `SERVICE_UNAVAILABLE` | External service (e.g., Keyedin) unavailable |

### Example Error Response

```json
{
  "error": "Project with id 999 does not exist",
  "details": null,
  "code": "NOT_FOUND"
}
```

---

## Rate Limiting

Currently **no rate limiting** is enforced (suitable for internal POC).

For production deployment, consider:
- 100 requests/minute per user
- 1000 requests/minute per IP
- Implement via middleware (e.g., `express-rate-limit`)

---

## Testing with cURL

### List Projects
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/projects
```

### Create Project
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project"}' \
  http://localhost:3000/api/projects
```

### Get Baseline
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/projects/1/baseline
```

### Record Actuals
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hours_spent": 320,
    "cost_spent": 32000,
    "working_days_used": 40,
    "notes": "Week 23"
  }' \
  http://localhost:3000/api/projects/1/ongoing
```

---

## Versioning

The API is currently **v1** (unversioned). Future versions will use URL versioning:
```
/api/v2/projects
/api/v2/allocations
```

---

## Changelog

**Current version (POC)**
- All endpoints documented
- Authentication via Supabase JWT
- No rate limiting
- No API versioning

See `NEXT_STEPS.md` for planned API changes.
