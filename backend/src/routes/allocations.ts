import { Router } from 'express';
import { query } from '../db';
import { calculateNetworkDays, validateFTE } from '../services/computations';

const router = Router({ mergeParams: true });

/** Compute working days within a phase that fall in the given ISO week (Mon–Sun). */
async function calculatePhaseWeekWorkingDays(phaseId: string, weekStart: string): Promise<number> {
  const phaseRes = await query('SELECT planned_start, planned_end FROM "ProjectPhase" WHERE id = $1', [phaseId]);
  if (!phaseRes.rowCount) throw new Error('Phase not found');
  const phase = phaseRes.rows[0];
  if (!phase.planned_start || !phase.planned_end) return 0;

  const weekStartDate = new Date(weekStart);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 4); // Friday of that week

  const phaseStart = new Date(phase.planned_start);
  const phaseEnd = new Date(phase.planned_end);

  const start = phaseStart > weekStartDate ? phaseStart : weekStartDate;
  const end = phaseEnd < weekEndDate ? phaseEnd : weekEndDate;

  if (start > end) return 0;
  return calculateNetworkDays(start, end, []);
}

// GET /api/projects/:id/allocation
router.get('/', async (req, res) => {
  const projectId = (req.params as { id: string }).id;
  try {
    const projRes = await query('SELECT name FROM "Project" WHERE id = $1', [projectId]);
    if (!projRes.rowCount) return res.status(404).json({ error: 'Project not found' });
    const projectName = projRes.rows[0].name;

    const phasesRes = await query(
      `SELECT id as phase_id, phase_type, display_name, "order", planned_start, planned_end, status, working_days
       FROM "ProjectPhase" WHERE project_id = $1 ORDER BY "order"`,
      [projectId]
    );

    const allocRes = await query(
      `SELECT ae.phase_id, ae.resource_id,
              to_char(ae.week_start, 'YYYY-MM-DD') as week_start,
              ae.fte::numeric as fte,
              ae.working_days, ae.weekly_cost::numeric as weekly_cost,
              r.name, r.role, r.day_rate::numeric as day_rate
       FROM "AllocationEntry" ae
       JOIN "Resource" r ON r.id = ae.resource_id
       WHERE ae.project_id = $1
       ORDER BY ae.phase_id, r.name, ae.week_start`,
      [projectId]
    );

    const resourcesRes = await query('SELECT * FROM "Resource" ORDER BY name');

    function isoDate(d: Date | null): string {
      if (!d) return '';
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    const phases = phasesRes.rows.map((ph: any) => {
      const phAllocs = allocRes.rows.filter((a: any) => a.phase_id === ph.phase_id);

      const resourceMap = new Map<number, any>();
      phAllocs.forEach((a: any) => {
        if (!resourceMap.has(a.resource_id)) {
          resourceMap.set(a.resource_id, {
            id: a.resource_id,
            name: a.name,
            role: a.role,
            day_rate: parseFloat(a.day_rate),
          });
        }
      });

      const cells = phAllocs.map((a: any) => ({
        resource_id: a.resource_id,
        phase_id: a.phase_id,
        week_start: a.week_start,
        fte: parseFloat(a.fte),
        working_days: a.working_days,
        weekly_cost: parseFloat(a.weekly_cost),
      }));

      const phaseBudget = cells.reduce((s: number, c: any) => s + c.weekly_cost, 0);
      const ftesWithValue = cells.map((c: any) => c.fte).filter((f: number) => f > 0);
      const avgFte =
        ftesWithValue.length > 0
          ? ftesWithValue.reduce((s: number, f: number) => s + f, 0) / ftesWithValue.length
          : 0;

      return {
        phase_id: ph.phase_id,
        phase_type:   ph.phase_type,
        display_name: ph.display_name,
        planned_start: isoDate(ph.planned_start),
        planned_end: isoDate(ph.planned_end),
        resources: Array.from(resourceMap.values()),
        cells,
        phase_budget: phaseBudget,
        avg_fte: avgFte,
        burn_rate_per_day: ph.working_days > 0 ? Math.round(phaseBudget / ph.working_days) : 0,
      };
    });

    res.json({
      project_id: parseInt(projectId, 10),
      project_name: projectName,
      phases,
      all_resources: resourcesRes.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        role: r.role,
        day_rate: parseFloat(r.day_rate),
      })),
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PUT /api/projects/:id/allocation
router.put('/', async (req, res) => {
  const projectId = (req.params as { id: string }).id;
  const { phase_id, allocations } = req.body;

  try {
    // Step B: after lock, AllocationEntry is the working copy and remains
    // mutable. The locked baseline is preserved as a snapshot on the
    // Baseline row (total_budget_at_lock + phase_snapshot_at_lock), so
    // updates here do not retroactively alter the BAC.
    await query('BEGIN');
    await query('DELETE FROM "AllocationEntry" WHERE project_id = $1 AND phase_id = $2', [projectId, phase_id]);

    const inserted = [];
    for (const alloc of allocations) {
      const { resource_id, week_start, fte } = alloc;

      const resQuery = await query('SELECT day_rate FROM "Resource" WHERE id = $1', [resource_id]);
      if (!resQuery.rowCount) throw new Error(`Resource ${resource_id} not found`);
      const dayRate = parseFloat(resQuery.rows[0].day_rate);

      const workingDays = await calculatePhaseWeekWorkingDays(phase_id, week_start);
      const weeklyCost = dayRate * fte * workingDays;

      const result = await query(
        `INSERT INTO "AllocationEntry"
         (resource_id, project_id, phase_id, week_start, fte, working_days, weekly_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [resource_id, projectId, phase_id, week_start, fte, workingDays, weeklyCost]
      );
      inserted.push(result.rows[0]);
    }

    await query('COMMIT');
    res.json(inserted);
  } catch (err: any) {
    await query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/projects/:id/allocation/warnings
router.get('/warnings', async (req, res) => {
  const { week_start, resource_id } = req.query;

  if (!week_start || !resource_id) {
    return res.status(400).json({ error: 'Missing week_start or resource_id query parameters' });
  }

  try {
    const allAllocs = await query(
      `SELECT project_id, to_char(week_start, 'YYYY-MM-DD') as week_start, fte
       FROM "AllocationEntry"
       WHERE resource_id = $1`,
      [resource_id]
    );

    const fteAllocations = allAllocs.rows.map((row: any) => ({
      projectId: row.project_id,
      week_start: row.week_start,
      fte: parseFloat(row.fte),
    }));

    const result = validateFTE(fteAllocations, week_start as string);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
