# Keyedin Integration Guide

This document describes how to integrate with the Keyedin project management platform to automatically sync actuals (hours spent, costs) into the Project Forecast App.

---

## Overview

The app supports pulling actual spend and hours from Keyedin via its **Reporting API** and **Core API**. When configured, users can sync the latest project actuals with a single button click. If Keyedin is not configured, manual entry is always available as a fallback.

```
Keyedin APIs (optional)
    ↓
KeyedinApiProvider (fetches actuals)
    ↓
ManualFallbackProvider (reads/writes snapshots)
    ↓
OngoingSnapshot table (persistent store)
    ↓
Dashboard (revised forecast, burn rate)
```

---

## Provider Pattern

The app uses a **plugin-style provider pattern** to decouple Keyedin integration from the core logic.

### Interface

**File:** `backend/src/services/ongoing/OngoingDataProvider.ts`

```typescript
export interface SnapshotData {
  id?: number;
  project_id: number;
  phase_id?: number | null;         // Step E: track actuals per phase
  reporting_date: Date | string;
  hours_spent_to_date: number;
  cost_spent_to_date: number;
  working_days_used: number;
  working_days_remaining: number;
  source: 'manual' | 'keyedin_api';
  created_at?: Date | string;
}

export interface OngoingDataProvider {
  // Get the most recent snapshot for a project (optionally filtered by phase)
  getLatestSnapshot(projectId: string, phaseId?: number | null): Promise<SnapshotData | null>;

  // Get full history of snapshots
  getHistory(projectId: string, phaseId?: number | null): Promise<SnapshotData[]>;

  // Save a snapshot (manual entry or from Keyedin)
  saveSnapshot(data: SnapshotData): Promise<SnapshotData>;

  // Sync from Keyedin (only implemented by KeyedinApiProvider)
  syncData(projectId: string): Promise<SnapshotData>;
}
```

### Two Implementations

#### 1. ManualFallbackProvider

**File:** `backend/src/services/ongoing/ManualFallbackProvider.ts`

Always available. Reads and writes to the `OngoingSnapshot` table directly.

```typescript
export class ManualFallbackProvider implements OngoingDataProvider {
  async getLatestSnapshot(projectId: string, phaseId?: number | null): Promise<SnapshotData | null> {
    const res = await query(
      `SELECT * FROM "OngoingSnapshot"
       WHERE project_id = $1 AND phase_id IS NOT DISTINCT FROM $2
       ORDER BY reporting_date DESC, created_at DESC
       LIMIT 1`,
      [projectId, phaseId]
    );
    return res.rowCount > 0 ? res.rows[0] : null;
  }

  async saveSnapshot(data: SnapshotData): Promise<SnapshotData> {
    const res = await query(
      `INSERT INTO "OngoingSnapshot"
       (project_id, phase_id, reporting_date, hours_spent_to_date, cost_spent_to_date,
        working_days_used, working_days_remaining, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [data.project_id, data.phase_id ?? null, data.reporting_date, ...]
    );
    return res.rows[0];
  }

  async syncData(projectId: string): Promise<SnapshotData> {
    throw new Error('ManualFallbackProvider does not support automated sync');
  }
}
```

#### 2. KeyedinApiProvider

**File:** `backend/src/services/ongoing/KeyedinApiProvider.ts`

Pulls actuals from Keyedin, then delegates storage to `ManualFallbackProvider`.

```typescript
export class KeyedinApiProvider implements OngoingDataProvider {
  private fallback = new ManualFallbackProvider();

  async syncData(projectId: string): Promise<SnapshotData> {
    // 1. Resolve Keyedin project code from our DB
    const projRes = await query(
      `SELECT keyedin_code FROM "Project" WHERE id = $1`,
      [projectId]
    );
    const { keyedin_code: projectCode } = projRes.rows[0];

    // 2. Fetch actuals from Keyedin Reporting API
    const reportRow = await fetchReport(projectCode);
    const hoursSpent = parseFloat(reportRow[FIELD_HOURS] ?? '0') || 0;
    const costSpent = parseFloat(reportRow[FIELD_COST] ?? '0') || 0;

    // 3. Fetch future expenditure (forecast) from Core API
    const expenditureLines = await fetchForecastExpenditure();

    // 4. Calculate remaining days
    const workingDaysRemaining = calculateRemaining(expenditureLines, costSpent, ...);

    // 5. Save via fallback (to OngoingSnapshot table)
    const snapshot: SnapshotData = {
      project_id: parseInt(projectId, 10),
      reporting_date: resolveReportingDate(reportRow),
      hours_spent_to_date: hoursSpent,
      cost_spent_to_date: costSpent,
      working_days_used: Math.round(hoursSpent / HOURS_PER_DAY),
      working_days_remaining: workingDaysRemaining,
      source: 'keyedin_api',
    };

    return this.fallback.saveSnapshot(snapshot);
  }
}
```

---

## API Configuration

### Environment Variables

Set these in `backend/.env` or Vercel environment settings:

```bash
# Keyedin API credentials
KEYEDIN_API_KEY=<your-api-token>
KEYEDIN_CORE_URL=https://coreapi.keyedinprojects.com        # (optional, default shown)
KEYEDIN_REPORT_URL=https://coreapi.keyedinprojects.com      # (optional, default shown)

# Keyedin Report setup
KEYEDIN_REPORT_KEY=<report-id>                              # Numeric ID of your custom report
KEYEDIN_PARAM_PROJECT=param1                                # Report parameter name (default: param1)

# Report column names (customizable per your report structure)
KEYEDIN_FIELD_HOURS=ActualHours                             # Column name for hours (default)
KEYEDIN_FIELD_COST=ActualCost                               # Column name for cost (default)
KEYEDIN_FIELD_DATE=ReportingDate                            # (optional) Column with reporting date
KEYEDIN_FIELD_REMAINING=DaysRemaining                       # (optional) Pre-calculated remaining days

# Forecast
KEYEDIN_FORECAST_KEY=<forecast-id>                          # (optional) Numeric ID of forecast
KEYEDIN_HOURS_PER_DAY=8                                     # Working hours per day (default: 8)
```

---

## Keyedin Report Setup

The integration expects a Keyedin Reporting API custom report that returns rows with columns for:
- **ActualHours** — Total hours spent to date
- **ActualCost** — Total cost spent to date
- (Optional) **ReportingDate** — Date of the report
- (Optional) **DaysRemaining** — Pre-calculated remaining working days

### Creating a Custom Report

1. Log in to Keyedin → **Reports**
2. Create a new **Custom Report** (REST API exportable)
3. Add columns:
   - `ProjectCode` (to filter by project)
   - `ActualHours` (sum of logged hours)
   - `ActualCost` (sum of logged costs)
   - `ReportingDate` (optional, snapshot date)
4. Set up a **Filter Parameter** named `param1` → filters by project code
5. Note the report ID (e.g., `12345`)

### Query Example

```bash
curl -X POST https://coreapi.keyedinprojects.com/v7.0/Report \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "key": 12345,
    "resultsPerPage": 1,
    "pageNumber": 1,
    "params": { "param1": "PROJECT_CODE_ABC" }
  }'
```

---

## Routes

### POST /api/projects/:id/ongoing/sync

Manually trigger a sync from Keyedin.

**Request:**
```http
POST /api/projects/1/ongoing/sync
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": 42,
  "project_id": 1,
  "phase_id": null,
  "reporting_date": "2026-06-08",
  "hours_spent_to_date": 240,
  "cost_spent_to_date": 12000,
  "working_days_used": 30,
  "working_days_remaining": 15,
  "source": "keyedin_api",
  "created_at": "2026-06-08T14:30:00Z"
}
```

**Possible errors:**
- `400` — Project not found or missing `keyedin_code`
- `401` — Missing or invalid token
- `503` — Keyedin API is down or misconfigured

**Backend code:**

**File:** `backend/src/routes/ongoing.ts`

```typescript
router.post('/sync', async (req, res) => {
  const { id: projectId } = req.params;

  try {
    // Check if Keyedin is configured
    if (!process.env.KEYEDIN_API_KEY) {
      return res.status(503).json({ error: 'Keyedin not configured' });
    }

    const provider = new KeyedinApiProvider();
    const snapshot = await provider.syncData(projectId);

    res.json(snapshot);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
```

### POST /api/projects/:id/ongoing

Manually save a snapshot (always available, even without Keyedin).

**Request:**
```http
POST /api/projects/1/ongoing
Authorization: Bearer <token>
Content-Type: application/json

{
  "phase_id": 1,
  "reporting_date": "2026-06-08",
  "hours_spent_to_date": 240,
  "cost_spent_to_date": 12000,
  "working_days_used": 30,
  "working_days_remaining": 15
}
```

**Response (200 OK):**
```json
{
  "id": 43,
  "project_id": 1,
  "phase_id": 1,
  "reporting_date": "2026-06-08",
  "hours_spent_to_date": 240,
  "cost_spent_to_date": 12000,
  "working_days_used": 30,
  "working_days_remaining": 15,
  "source": "manual",
  "created_at": "2026-06-08T14:35:00Z"
}
```

### GET /api/projects/:id/ongoing

Get the latest snapshot and history.

**Request:**
```http
GET /api/projects/1/ongoing?phase_id=1
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "latest": { ... },
  "history": [
    { ... },
    { ... }
  ]
}
```

---

## Frontend Integration

### Avanzamento Page (Actuals)

**File:** `frontend/src/pages/Avanzamento.tsx`

```typescript
function Avanzamento() {
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(false);

  // Manual entry
  const handleSaveSnapshot = async (data: SnapshotData) => {
    const res = await apiClient(`/api/projects/${projectId}/ongoing`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      alert('Failed to save snapshot');
      return;
    }
    const saved = await res.json();
    setSnapshot(saved);
  };

  // Sync from Keyedin
  const handleSyncKeyedin = async () => {
    setLoading(true);
    try {
      const res = await apiClient(`/api/projects/${projectId}/ongoing/sync`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Sync failed: ${err.error}`);
        setLoading(false);
        return;
      }
      const synced = await res.json();
      setSnapshot(synced);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Project Actuals</h1>
      
      {/* Manual entry form */}
      <form onSubmit={e => { e.preventDefault(); handleSaveSnapshot(...); }}>
        <input name="hours_spent_to_date" type="number" />
        <input name="cost_spent_to_date" type="number" />
        <button type="submit">Save Snapshot</button>
      </form>

      {/* Keyedin sync button */}
      <button onClick={handleSyncKeyedin} disabled={loading}>
        {loading ? 'Syncing...' : 'Sync from Keyedin'}
      </button>

      {/* Display latest */}
      {snapshot && (
        <div>
          <h3>Latest Snapshot ({snapshot.source})</h3>
          <p>Hours: {snapshot.hours_spent_to_date}</p>
          <p>Cost: ${snapshot.cost_spent_to_date}</p>
          <p>Reporting Date: {snapshot.reporting_date}</p>
        </div>
      )}
    </div>
  );
}
```

---

## Data Flow Example

### Scenario: Sync Project Actuals from Keyedin

```
User: "I want to get the latest actuals from Keyedin"
  ↓
Frontend (Avanzamento.tsx): Click "Sync from Keyedin" button
  ↓
POST /api/projects/1/ongoing/sync
  ↓
Backend (routes/ongoing.ts):
  → Instantiate new KeyedinApiProvider()
  → Call provider.syncData(projectId='1')
    ↓
    1. Query Project where id=1 → get keyedin_code='ABC-123'
    2. Fetch from Keyedin Reporting API with param1='ABC-123'
       → Returns { ActualHours: 240, ActualCost: 12000, ... }
    3. Fetch from Keyedin Core API forecast/expenditure
       → Calculate remaining days from future cost
    4. Assemble SnapshotData object
       {
         project_id: 1,
         reporting_date: '2026-06-08',
         hours_spent_to_date: 240,
         cost_spent_to_date: 12000,
         working_days_used: 30,
         working_days_remaining: 15,
         source: 'keyedin_api'
       }
    5. Call fallback.saveSnapshot(snapshot)
       → INSERT into OngoingSnapshot table
       → RETURNING *
  ↓
Response 200 OK with saved snapshot
  ↓
Frontend: Update Avanzamento page with new actuals
  ↓
Dashboard re-renders: Revised forecast, burn rate, RAG status updated
```

---

## Configuration Checklist

- [ ] Create Keyedin custom report (columns: ProjectCode, ActualHours, ActualCost, ReportingDate)
- [ ] Note report ID and parameter name
- [ ] Generate Keyedin API token
- [ ] Set `KEYEDIN_API_KEY` in `backend/.env`
- [ ] Set `KEYEDIN_REPORT_KEY` to report ID
- [ ] Set `KEYEDIN_PARAM_PROJECT` if not `param1`
- [ ] (Optional) Set `KEYEDIN_FORECAST_KEY` for remaining days forecast
- [ ] Test sync manually: `POST /api/projects/1/ongoing/sync`
- [ ] Verify `OngoingSnapshot` table has new row with `source='keyedin_api'`
- [ ] Deploy to Vercel with Keyedin env vars

---

## Fallback Behavior

If Keyedin is not configured or the sync fails:

1. `KeyedinApiProvider.syncData()` throws an error
2. Frontend displays error message
3. **Manual entry is always available** — User can fill in actuals manually via the form
4. Manual snapshots are saved with `source='manual'` (for audit/reporting purposes)

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Keyedin not configured" (503) | Missing `KEYEDIN_API_KEY` | Set environment variable |
| "Project N has no keyedin_code" (400) | Project not linked to Keyedin code | Set `keyedin_code` on Project record |
| "Keyedin Core API 401" | Invalid API key | Verify `KEYEDIN_API_KEY` is correct |
| "No report data returned" (400) | Report filter did not match any projects | Check Keyedin project code matches |
| Network timeout | Keyedin API is slow or down | Retry or use manual entry |

---

## Testing

### Unit Tests

**File:** `backend/src/services/ongoing/ongoingDataProvider.test.ts` (to be added)

```typescript
describe('KeyedinApiProvider', () => {
  it('should sync actuals from Keyedin', async () => {
    // Mock fetch responses
    const provider = new KeyedinApiProvider();
    const snapshot = await provider.syncData('1');
    expect(snapshot.hours_spent_to_date).toBeGreaterThan(0);
    expect(snapshot.source).toBe('keyedin_api');
  });

  it('should fall back to manual provider on error', async () => {
    // Simulate Keyedin API down
    const provider = new KeyedinApiProvider();
    expect(() => provider.syncData('1')).rejects.toThrow();
  });
});
```

### Integration Tests

```typescript
describe('POST /api/projects/:id/ongoing/sync', () => {
  it('should sync and store snapshot', async () => {
    const res = await request(app)
      .post('/api/projects/1/ongoing/sync')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('keyedin_api');
  });

  it('should return 503 if Keyedin not configured', async () => {
    process.env.KEYEDIN_API_KEY = '';
    const res = await request(app)
      .post('/api/projects/1/ongoing/sync')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(503);
  });
});
```

---

## Phase-level Actuals (Step E)

As of migration 009, `OngoingSnapshot` now has an optional `phase_id` column.

```typescript
// Get actuals for a specific phase
const phaseActuals = await provider.getLatestSnapshot(projectId, phaseId=1);

// Get all actuals for a project (phase_id IS NULL)
const projectActuals = await provider.getLatestSnapshot(projectId, phaseId=null);
```

**Frontend:** When recording actuals, users select the phase to which the hours/costs belong. This enables phase-level variance analysis and EAC computation (Step F).

---

## Future Enhancements

- **Webhook integration** — Keyedin sends updates directly to the app (instead of pull-based)
- **Scheduled sync** — Nightly sync from Keyedin via a cron job
- **Multi-project bulk sync** — Sync all projects at once
- **Cost allocation** — Automatically split costs across phases based on billable time per phase

