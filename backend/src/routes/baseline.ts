import { Router } from 'express';
import { query } from '../db';
import { calculateNetworkDays } from '../services/computations';

const router = Router({ mergeParams: true });

function isoDate(d: Date | string | null): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

interface PhaseSnapshotEntry {
  phase_id: number;
  phase_type: string;
  display_name: string | null;
  order: number;
  planned_start: string | null;
  planned_end: string | null;
  working_days: number;
  planned_hours: number;
  budget: number;
  contingency_pct: number;
  status: string;
}

/**
 * Read current phase state from DB plus SUM(weekly_cost) per phase.
 * Used both for GET /baseline (live view) and for building the BAC
 * snapshot at lock time.
 */
async function readLivePhases(projectId: string): Promise<PhaseSnapshotEntry[]> {
  const phasesRes = await query(
    `SELECT pp.id as phase_id, pp.phase_type, pp.display_name, pp."order",
            pp.planned_start, pp.planned_end,
            pp.working_days, pp.planned_hours, pp.status, pp.contingency_pct,
            COALESCE(SUM(ae.weekly_cost), 0)::numeric as budget
     FROM "ProjectPhase" pp
     LEFT JOIN "AllocationEntry" ae ON ae.phase_id = pp.id
     WHERE pp.project_id = $1
     GROUP BY pp.id
     ORDER BY pp."order"`,
    [projectId]
  );

  return phasesRes.rows.map((p: any) => ({
    phase_id:        p.phase_id,
    phase_type:      p.phase_type,
    display_name:    p.display_name,
    order:           p.order,
    planned_start:   isoDate(p.planned_start),
    planned_end:     isoDate(p.planned_end),
    working_days:    p.working_days ?? 0,
    planned_hours:   p.planned_hours ?? 0,
    budget:          parseFloat(p.budget),
    contingency_pct: parseFloat(p.contingency_pct ?? 0),
    status:          p.status ?? 'not_started',
  }));
}

/** Read the snapshot stored at lock time. Returns null if no snapshot exists. */
function readSnapshotPhases(snapshotJson: any): PhaseSnapshotEntry[] | null {
  if (!Array.isArray(snapshotJson)) return null;
  return snapshotJson.map((p: any) => ({
    phase_id:        Number(p.phase_id),
    phase_type:      String(p.phase_type),
    display_name:    p.display_name ?? null,
    order:           Number(p.order),
    planned_start:   p.planned_start ? isoDate(p.planned_start) : null,
    planned_end:     p.planned_end ? isoDate(p.planned_end) : null,
    working_days:    Number(p.working_days ?? 0),
    planned_hours:   Number(p.planned_hours ?? 0),
    budget:          parseFloat(p.budget ?? 0),
    contingency_pct: parseFloat(p.contingency_pct ?? 0),
    status:          p.status ?? 'not_started',
  }));
}

// GET /api/projects/:id/baseline
router.get('/', async (req, res) => {
  const { id: projectId } = req.params as { id: string };
  try {
    const projRes = await query('SELECT name FROM "Project" WHERE id = $1', [projectId]);
    if (!projRes.rowCount) return res.status(404).json({ error: 'Project not found' });
    const projectName = projRes.rows[0].name;

    const baselineRes = await query('SELECT * FROM "Baseline" WHERE project_id = $1', [projectId]);
    const baseline = baselineRes.rows[0] ?? null;
    const isLocked = !!baseline?.locked_at;

    // When locked AND we have a snapshot, serve the frozen BAC. Otherwise
    // compute live from current ProjectPhase + AllocationEntry.
    let phases: PhaseSnapshotEntry[];
    let totalBudget: number;
    let totalForecast: number;
    let totalWorkingDays: number;
    let servedFromSnapshot = false;

    const snapshot = isLocked ? readSnapshotPhases(baseline.phase_snapshot_at_lock) : null;

    if (snapshot) {
      phases = snapshot;
      totalBudget       = parseFloat(baseline.total_budget_at_lock ?? '0');
      totalForecast     = parseFloat(baseline.total_forecast_at_lock ?? '0');
      totalWorkingDays  = Number(baseline.total_working_days_at_lock ?? 0);
      servedFromSnapshot = true;
    } else {
      phases = await readLivePhases(projectId);
      totalBudget      = phases.reduce((s, p) => s + p.budget, 0);
      totalForecast    = phases.reduce((s, p) => s + p.budget + p.budget * (p.contingency_pct / 100), 0);
      totalWorkingDays = phases.reduce((s, p) => s + p.working_days, 0);
    }

    res.json({
      project_id:    parseInt(projectId, 10),
      project_name:  projectName,
      phases:        phases.map((p) => ({ ...p, is_locked: isLocked })),
      is_locked:     isLocked,
      locked_at:     baseline?.locked_at ?? null,
      total_budget:        totalBudget,
      total_forecast:      totalForecast,
      total_working_days:  totalWorkingDays,
      served_from_snapshot: servedFromSnapshot,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PUT /api/projects/:id/baseline
router.put('/', async (req, res) => {
  const { id: projectId } = req.params as { id: string };
  const { phases } = req.body as {
    phases: {
      phase_id: number;
      planned_start: string;
      planned_end: string;
      contingency_pct?: number;
      display_name?: string;
    }[];
  };

  if (!Array.isArray(phases) || phases.length === 0) {
    return res.status(400).json({ error: 'phases must be a non-empty array' });
  }
  for (const p of phases) {
    if (!p.phase_id || typeof p.phase_id !== 'number') {
      return res.status(400).json({ error: 'each phase must have a numeric phase_id' });
    }
    if (p.contingency_pct !== undefined) {
      const pct = Number(p.contingency_pct);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ error: 'contingency_pct must be between 0 and 100' });
      }
    }
  }

  try {
    // PUT /baseline modifies BAC parameters (contingency, display_name) and
    // currently also phase dates. Once the baseline is locked, BAC params
    // are frozen → reject. Step I will split this into a separate endpoint
    // for working-copy date changes that remains allowed post-lock.
    const baselineRes = await query('SELECT locked_at FROM "Baseline" WHERE project_id = $1', [projectId]);
    if (baselineRes.rows[0]?.locked_at) {
      return res.status(400).json({ error: 'Baseline is locked and cannot be modified.' });
    }

    const holidaysRes = await query(`SELECT date FROM "PublicHoliday" WHERE country_code = 'IT'`);
    const holidays = holidaysRes.rows.map((h: any) => new Date(h.date));

    await query('BEGIN');

    for (const p of phases) {
      const wd =
        p.planned_start && p.planned_end
          ? calculateNetworkDays(new Date(p.planned_start), new Date(p.planned_end), holidays)
          : 0;

      const contingencyPct = p.contingency_pct !== undefined ? p.contingency_pct : 0;

      if (p.display_name !== undefined && p.display_name.trim() !== '') {
        await query(
          `UPDATE "ProjectPhase"
           SET planned_start = $1, planned_end = $2, working_days = $3,
               planned_hours = $4, contingency_pct = $5, display_name = $6
           WHERE id = $7`,
          [p.planned_start || null, p.planned_end || null, wd, wd * 8, contingencyPct, p.display_name.trim(), p.phase_id],
        );
      } else {
        await query(
          `UPDATE "ProjectPhase"
           SET planned_start = $1, planned_end = $2, working_days = $3,
               planned_hours = $4, contingency_pct = $5
           WHERE id = $6`,
          [p.planned_start || null, p.planned_end || null, wd, wd * 8, contingencyPct, p.phase_id],
        );
      }
    }

    await query(
      `INSERT INTO "Baseline" (project_id) VALUES ($1)
       ON CONFLICT (project_id) DO NOTHING`,
      [projectId],
    );

    await query('COMMIT');
    res.json({ success: true });
  } catch (err: any) {
    await query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/projects/:id/baseline/lock
router.post('/lock', async (req, res) => {
  const { id: projectId } = req.params as { id: string };
  try {
    const existing = await query('SELECT locked_at FROM "Baseline" WHERE project_id = $1', [projectId]);
    if (existing.rows[0]?.locked_at) {
      return res.json({ locked_at: existing.rows[0].locked_at });
    }

    // Build the BAC snapshot from current state BEFORE we set locked_at.
    // From this moment on, working copy (ProjectPhase, AllocationEntry) can
    // evolve freely; the snapshot is what variance is measured against.
    const phases = await readLivePhases(projectId);
    const totalBudget       = phases.reduce((s, p) => s + p.budget, 0);
    const totalForecast     = phases.reduce((s, p) => s + p.budget + p.budget * (p.contingency_pct / 100), 0);
    const totalWorkingDays  = phases.reduce((s, p) => s + p.working_days, 0);

    await query('BEGIN');
    await query(
      `INSERT INTO "Baseline"
         (project_id, locked_at,
          total_budget_at_lock, total_forecast_at_lock,
          total_working_days_at_lock, phase_snapshot_at_lock)
       VALUES ($1, NOW(), $2, $3, $4, $5::jsonb)
       ON CONFLICT (project_id) DO UPDATE
         SET locked_at                  = NOW(),
             total_budget_at_lock       = EXCLUDED.total_budget_at_lock,
             total_forecast_at_lock     = EXCLUDED.total_forecast_at_lock,
             total_working_days_at_lock = EXCLUDED.total_working_days_at_lock,
             phase_snapshot_at_lock     = EXCLUDED.phase_snapshot_at_lock`,
      [projectId, totalBudget, totalForecast, totalWorkingDays, JSON.stringify(phases)],
    );
    await query('COMMIT');

    const result = await query(
      `SELECT locked_at, total_budget_at_lock, total_forecast_at_lock,
              total_working_days_at_lock
         FROM "Baseline" WHERE project_id = $1`,
      [projectId],
    );
    const row = result.rows[0];
    res.json({
      locked_at:                  row.locked_at,
      total_budget_at_lock:       parseFloat(row.total_budget_at_lock ?? '0'),
      total_forecast_at_lock:     parseFloat(row.total_forecast_at_lock ?? '0'),
      total_working_days_at_lock: Number(row.total_working_days_at_lock ?? 0),
    });
  } catch (err: any) {
    await query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
