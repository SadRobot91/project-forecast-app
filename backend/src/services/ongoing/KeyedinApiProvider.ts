import { OngoingDataProvider, SnapshotData } from './OngoingDataProvider';
import { ManualFallbackProvider } from './ManualFallbackProvider';
import { query } from '../../db';

// ── Config from environment ─────────────────────────────────────────────────
const CORE_BASE    = process.env.KEYEDIN_CORE_URL    ?? 'https://coreapi.keyedinprojects.com';
const REPORT_BASE  = process.env.KEYEDIN_REPORT_URL  ?? 'https://coreapi.keyedinprojects.com';
const API_KEY      = process.env.KEYEDIN_API_KEY     ?? '';
const REPORT_KEY   = parseInt(process.env.KEYEDIN_REPORT_KEY ?? '0', 10);
const FORECAST_KEY = parseInt(process.env.KEYEDIN_FORECAST_KEY ?? '0', 10);

// Reporting API: column names in the report row
const FIELD_HOURS     = process.env.KEYEDIN_FIELD_HOURS     ?? 'ActualHours';
const FIELD_COST      = process.env.KEYEDIN_FIELD_COST      ?? 'ActualCost';
const FIELD_REMAINING = process.env.KEYEDIN_FIELD_REMAINING ?? ''; // optional report column
// Date column in the report — if present, used as reporting_date instead of today()
const FIELD_DATE      = process.env.KEYEDIN_FIELD_DATE      ?? '';
// Report filter param key that accepts the Keyedin project code
const PARAM_PROJECT   = process.env.KEYEDIN_PARAM_PROJECT   ?? 'param1';
const HOURS_PER_DAY   = parseFloat(process.env.KEYEDIN_HOURS_PER_DAY ?? '8');

// ── Shared auth header ───────────────────────────────────────────────────────
function authHeaders(): Record<string, string> {
  return { 'Authorization': API_KEY, 'Content-Type': 'application/json' };
}

// ── Core API helper ──────────────────────────────────────────────────────────
async function coreGet<T>(path: string): Promise<T> {
  const res = await fetch(`${CORE_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`Keyedin Core API ${res.status}: ${path}`);
  }
  const body = await res.json() as { data: T };
  return body.data;
}

// ── Reporting API helper ─────────────────────────────────────────────────────
async function fetchReport(
  projectCode: string,
): Promise<Record<string, string>> {
  if (!REPORT_KEY) throw new Error('KEYEDIN_REPORT_KEY not configured');

  const res = await fetch(`${REPORT_BASE}/v7.0/Report`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      key: REPORT_KEY,
      resultsPerPage: 1,
      pageNumber: 1,
      params: { [PARAM_PROJECT]: projectCode },
    }),
  });

  if (!res.ok) throw new Error(`Keyedin Reporting API ${res.status}`);

  const body = await res.json() as {
    data?: { data?: Record<string, string>[] };
  };
  const rows = body?.data?.data ?? [];
  if (rows.length === 0) throw new Error(`No report data returned for project "${projectCode}"`);
  return rows[0];
}

// ── Core API: fetch future expenditure lines for a forecast ──────────────────
interface ExpenditureLine {
  name?: string;
  details?: Array<{ startDate: string; endDate: string; cost: number }>;
}

async function fetchForecastExpenditure(): Promise<ExpenditureLine[]> {
  if (!FORECAST_KEY) return [];
  const data = await coreGet<{ lines?: ExpenditureLine[] }>(
    `/v7.0/Planning/Forecast/Expenditure?key=${FORECAST_KEY}`,
  );
  return data?.lines ?? [];
}

// Sum cost from future expenditure detail lines (startDate > today)
function remainingDaysFromExpenditure(
  lines: ExpenditureLine[],
  dailyCostRate: number,
): number | null {
  if (!lines.length || dailyCostRate <= 0) return null;

  const today = new Date();
  let futureCost = 0;

  for (const line of lines) {
    for (const detail of line.details ?? []) {
      const start = new Date(detail.startDate);
      if (start > today) futureCost += detail.cost;
    }
  }

  return Math.round(futureCost / dailyCostRate);
}

// ── Resolve the reporting date from the report row ───────────────────────────
// Uses KEYEDIN_FIELD_DATE column if configured and the value parses as a valid
// date; otherwise falls back to today. Normalises to YYYY-MM-DD.
function resolveReportingDate(row: Record<string, string>): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!FIELD_DATE) return today;

  const raw = row[FIELD_DATE];
  if (!raw) return today;

  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return today;

  return parsed.toISOString().slice(0, 10);
}

// ── Provider ─────────────────────────────────────────────────────────────────
export class KeyedinApiProvider implements OngoingDataProvider {
  private fallback = new ManualFallbackProvider();

  async getLatestSnapshot(projectId: string): Promise<SnapshotData | null> {
    return this.fallback.getLatestSnapshot(projectId);
  }

  async getHistory(projectId: string): Promise<SnapshotData[]> {
    return this.fallback.getHistory(projectId);
  }

  async saveSnapshot(data: SnapshotData): Promise<SnapshotData> {
    throw new Error('Use syncData() to write Keyedin snapshots');
  }

  async syncData(projectId: string): Promise<SnapshotData> {
    if (!API_KEY) throw new Error('KEYEDIN_API_KEY not configured');

    // Resolve Keyedin project code from our DB
    const projRes = await query(
      `SELECT keyedin_code,
              COALESCE((SELECT SUM(pp.working_days) FROM "ProjectPhase" pp WHERE pp.project_id = p.id), 0)::integer AS total_wd
       FROM "Project" p WHERE p.id = $1`,
      [projectId],
    );

    if (!projRes.rowCount) throw new Error(`Project ${projectId} not found`);

    const { keyedin_code: projectCode, total_wd } = projRes.rows[0];
    if (!projectCode) {
      throw new Error(
        `Project ${projectId} has no keyedin_code set. ` +
        'Update the project record with its Keyedin project code before syncing.',
      );
    }

    const totalWorkingDays = parseInt(total_wd, 10) || 0;

    // ── Parallel fetch from both APIs ────────────────────────────────────────
    const [reportRow, expenditureLines] = await Promise.all([
      fetchReport(projectCode),
      fetchForecastExpenditure().catch(() => [] as ExpenditureLine[]), // non-fatal
    ]);

    // ── Extract actuals from Reporting API ───────────────────────────────────
    const hoursSpent = parseFloat(reportRow[FIELD_HOURS] ?? '0') || 0;
    const costSpent  = parseFloat(reportRow[FIELD_COST]  ?? '0') || 0;
    const workingDaysUsed = Math.round(hoursSpent / HOURS_PER_DAY);

    // ── Derive remaining from Core API expenditure, or fall back to DB total ─
    let workingDaysRemaining: number;

    if (FIELD_REMAINING && reportRow[FIELD_REMAINING]) {
      // If the report itself has a remaining column, use it directly
      workingDaysRemaining = Math.round(parseFloat(reportRow[FIELD_REMAINING]));
    } else if (expenditureLines.length > 0) {
      // Derive from future expenditure cost ÷ daily burn rate
      const dailyRate = workingDaysUsed > 0 ? costSpent / workingDaysUsed : 0;
      const fromExpenditure = remainingDaysFromExpenditure(expenditureLines, dailyRate);
      workingDaysRemaining = fromExpenditure ?? Math.max(0, totalWorkingDays - workingDaysUsed);
    } else {
      // Last resort: total planned days from our Baseline minus days used
      workingDaysRemaining = Math.max(0, totalWorkingDays - workingDaysUsed);
    }

    // ── Resolve reporting date from report data, fall back to today ──────────
    const reportingDate = resolveReportingDate(reportRow);

    // ── Merge and persist ─────────────────────────────────────────────────────
    const snapshot: SnapshotData = {
      project_id:            parseInt(projectId, 10),
      reporting_date:        reportingDate,
      hours_spent_to_date:   hoursSpent,
      cost_spent_to_date:    costSpent,
      working_days_used:     workingDaysUsed,
      working_days_remaining: workingDaysRemaining,
      source:                'keyedin_api',
    };

    return this.fallback.saveSnapshot(snapshot);
  }
}
