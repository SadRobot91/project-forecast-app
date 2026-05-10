import { Router } from 'express';
import { query } from '../db';
import { calculateNetworkDays } from '../services/computations';

const router = Router({ mergeParams: true });

function isoDate(d: Date | null): string {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
    const contingencyPct = parseFloat(baseline?.contingency_pct ?? 0);
    const isLocked = !!baseline?.locked_at;

    const phasesRes = await query(
      `SELECT pp.id as phase_id, pp.phase_type, pp."order",
              pp.planned_start, pp.planned_end,
              pp.working_days, pp.planned_hours, pp.status,
              COALESCE(SUM(ae.weekly_cost), 0)::numeric as budget
       FROM "ProjectPhase" pp
       LEFT JOIN "AllocationEntry" ae ON ae.phase_id = pp.id
       WHERE pp.project_id = $1
       GROUP BY pp.id
       ORDER BY pp."order"`,
      [projectId]
    );

    const phases = phasesRes.rows.map((p: any) => ({
      phase_id: p.phase_id,
      phase_type: p.phase_type,
      order: p.order,
      planned_start: isoDate(p.planned_start),
      planned_end: isoDate(p.planned_end),
      working_days: p.working_days ?? 0,
      planned_hours: p.planned_hours ?? 0,
      budget: parseFloat(p.budget),
      contingency_pct: p.phase_type === 'feasibility' ? contingencyPct : 0,
      status: p.status ?? 'not_started',
      is_locked: isLocked,
    }));

    const totalBudget = phases.reduce((s: number, p: any) => s + p.budget, 0);
    const feasibilityBudget = phases.find((p: any) => p.phase_type === 'feasibility')?.budget ?? 0;
    const totalForecast = totalBudget + feasibilityBudget * (contingencyPct / 100);

    res.json({
      project_id: parseInt(projectId, 10),
      project_name: projectName,
      phases,
      is_locked: isLocked,
      locked_at: baseline?.locked_at ?? null,
      contingency_pct: contingencyPct,
      total_budget: totalBudget,
      total_forecast: totalForecast,
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
    phases: { phase_id: number; planned_start: string; planned_end: string; contingency_pct?: number }[];
  };

  try {
    const baselineRes = await query('SELECT locked_at FROM "Baseline" WHERE project_id = $1', [projectId]);
    if (baselineRes.rows[0]?.locked_at) {
      return res.status(400).json({ error: 'Baseline is locked and cannot be modified.' });
    }

    const holidaysRes = await query(`SELECT date FROM "PublicHoliday" WHERE country_code = 'IT'`);
    const holidays = holidaysRes.rows.map((h: any) => new Date(h.date));

    let contingencyPct = 0;

    await query('BEGIN');

    for (const p of phases) {
      if (p.contingency_pct !== undefined && p.contingency_pct > 0) {
        contingencyPct = p.contingency_pct;
      }

      const wd =
        p.planned_start && p.planned_end
          ? calculateNetworkDays(new Date(p.planned_start), new Date(p.planned_end), holidays)
          : 0;

      await query(
        `UPDATE "ProjectPhase"
         SET planned_start = $1, planned_end = $2, working_days = $3, planned_hours = $4
         WHERE id = $5`,
        [p.planned_start || null, p.planned_end || null, wd, wd * 8, p.phase_id]
      );
    }

    await query(
      `INSERT INTO "Baseline" (project_id, contingency_pct)
       VALUES ($1, $2)
       ON CONFLICT (project_id) DO UPDATE SET contingency_pct = EXCLUDED.contingency_pct`,
      [projectId, contingencyPct]
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
    // If already locked, return existing timestamp
    const existing = await query('SELECT locked_at FROM "Baseline" WHERE project_id = $1', [projectId]);
    if (existing.rows[0]?.locked_at) {
      return res.json({ locked_at: existing.rows[0].locked_at });
    }

    await query(
      `INSERT INTO "Baseline" (project_id, locked_at)
       VALUES ($1, NOW())
       ON CONFLICT (project_id) DO UPDATE SET locked_at = NOW()`,
      [projectId]
    );

    const result = await query('SELECT locked_at FROM "Baseline" WHERE project_id = $1', [projectId]);
    res.json({ locked_at: result.rows[0].locked_at });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
