import { Router } from 'express';
import { query } from '../db';
import { calculateNetworkDays } from '../services/computations';

const router = Router({ mergeParams: true });

function isoDate(d: Date | null): string {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeStatus(
  startDate: Date | null,
  endDate: Date | null,
  actualDate: Date | null
): 'not_started' | 'in_progress' | 'completed' {
  if (actualDate) return 'completed';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!startDate || !endDate) return 'not_started';
  const s = new Date(startDate); s.setHours(0, 0, 0, 0);
  const e = new Date(endDate);   e.setHours(0, 0, 0, 0);
  if (e < today) return 'completed';
  if (s <= today && today <= e) return 'in_progress';
  return 'not_started';
}

// GET /api/projects/:id/gantt
router.get('/', async (req, res) => {
  const { id: projectId } = req.params as { id: string };
  try {
    const projRes = await query('SELECT name FROM "Project" WHERE id = $1', [projectId]);
    if (!projRes.rowCount) return res.status(404).json({ error: 'Project not found' });

    const phasesRes = await query(
      `SELECT id as phase_id, phase_type, planned_start, planned_end, status
       FROM "ProjectPhase" WHERE project_id = $1 ORDER BY "order"`,
      [projectId]
    );

    const tasksRes = await query(
      `SELECT id, project_id, phase_id, name, owner,
              start_date, end_date, working_days, is_milestone, actual_date
       FROM "GanttTask" WHERE project_id = $1 ORDER BY phase_id, start_date`,
      [projectId]
    );

    const phases = phasesRes.rows.map((ph: any) => {
      const tasks = tasksRes.rows
        .filter((t: any) => t.phase_id === ph.phase_id)
        .map((t: any) => ({
          id:           t.id,
          project_id:   t.project_id,
          phase_id:     t.phase_id,
          phase_type:   ph.phase_type,
          name:         t.name,
          owner:        t.owner,
          start_date:   isoDate(t.start_date),
          end_date:     isoDate(t.end_date),
          working_days: t.working_days,
          is_milestone: t.is_milestone,
          actual_date:  t.actual_date ? isoDate(t.actual_date) : null,
          status:       computeStatus(t.start_date, t.end_date, t.actual_date),
        }));
      return {
        phase_id:      ph.phase_id,
        phase_type:    ph.phase_type,
        planned_start: isoDate(ph.planned_start),
        planned_end:   isoDate(ph.planned_end),
        status:        ph.status ?? 'not_started',
        tasks,
      };
    });

    const starts = phases.map((p: any) => p.planned_start).filter(Boolean).sort();
    const ends   = phases.map((p: any) => p.planned_end).filter(Boolean).sort();
    const project_start = starts[0] ?? new Date().toISOString().split('T')[0];
    const project_end   = ends[ends.length - 1] ?? project_start;

    res.json({
      project_id:   parseInt(projectId, 10),
      project_name: projRes.rows[0].name,
      project_start,
      project_end,
      phases,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/projects/:id/gantt/tasks
router.post('/tasks', async (req, res) => {
  const { id: projectId } = req.params as { id: string };
  const { phase_id, name, owner, start_date, end_date, is_milestone, status } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  if (!start_date)    return res.status(400).json({ error: 'start_date is required' });

  try {
    const phaseRes = await query(
      'SELECT phase_type, planned_start, planned_end FROM "ProjectPhase" WHERE id = $1',
      [phase_id]
    );
    if (!phaseRes.rowCount) return res.status(404).json({ error: 'Phase not found' });

    const phase = phaseRes.rows[0];
    const phaseStart = isoDate(phase.planned_start);
    const phaseEnd   = isoDate(phase.planned_end);
    const effectiveEnd = end_date ?? start_date;

    if (effectiveEnd < start_date) {
      return res.status(400).json({ error: `end_date (${effectiveEnd}) must be ≥ start_date (${start_date})` });
    }
    if (phaseStart && start_date < phaseStart) {
      return res.status(400).json({
        error: `start_date (${start_date}) precede l'inizio della fase (${phaseStart})`,
      });
    }
    if (phaseEnd && effectiveEnd > phaseEnd) {
      return res.status(400).json({
        error: `end_date (${effectiveEnd}) supera la fine della fase (${phaseEnd})`,
      });
    }

    const s = new Date(start_date); const e = new Date(effectiveEnd);
    const workingDays = calculateNetworkDays(s, e, []);

    const result = await query(
      `INSERT INTO "GanttTask"
       (project_id, phase_id, name, owner, start_date, end_date, working_days, is_milestone, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [projectId, phase_id, name, owner ?? null, start_date, end_date ?? start_date, workingDays, is_milestone ?? false, status ?? 'not_started']
    );

    const t = result.rows[0];
    res.status(201).json({
      id: t.id, project_id: t.project_id, phase_id: t.phase_id,
      phase_type: phaseRes.rows[0].phase_type,
      name: t.name, owner: t.owner,
      start_date: isoDate(t.start_date), end_date: isoDate(t.end_date),
      working_days: t.working_days, is_milestone: t.is_milestone,
      actual_date: null, status: t.status,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PUT /api/projects/:id/gantt/tasks/:tid
router.put('/tasks/:tid', async (req, res) => {
  const { id: projectId, tid } = req.params as { id: string; tid: string };
  const body = req.body as {
    actual_date?: string | null; name?: string; owner?: string | null;
    start_date?: string; end_date?: string; status?: string; is_milestone?: boolean;
  };

  try {
    // If dates are being updated, validate against phase bounds
    if ('start_date' in body || 'end_date' in body) {
      const taskRes = await query(
        `SELECT gt.start_date, gt.end_date, gt.is_milestone,
                pp.planned_start, pp.planned_end
         FROM "GanttTask" gt
         JOIN "ProjectPhase" pp ON pp.id = gt.phase_id
         WHERE gt.id = $1 AND gt.project_id = $2`,
        [tid, projectId]
      );
      if (!taskRes.rowCount) return res.status(404).json({ error: 'Task not found' });

      const current = taskRes.rows[0];
      const newStart = body.start_date ?? isoDate(current.start_date);
      const newEnd   = body.end_date   ?? isoDate(current.end_date);
      const phaseStart = isoDate(current.planned_start);
      const phaseEnd   = isoDate(current.planned_end);

      if (newEnd < newStart) {
        return res.status(400).json({ error: `end_date (${newEnd}) must be ≥ start_date (${newStart})` });
      }
      if (phaseStart && newStart < phaseStart) {
        return res.status(400).json({
          error: `start_date (${newStart}) precede l'inizio della fase (${phaseStart})`,
        });
      }
      if (phaseEnd && newEnd > phaseEnd) {
        return res.status(400).json({
          error: `end_date (${newEnd}) supera la fine della fase (${phaseEnd})`,
        });
      }
    }

    const setClauses: string[] = [];
    const params: any[] = [];

    const addField = (key: string, value: any) => { params.push(value); setClauses.push(`${key} = $${params.length}`); };

    if ('actual_date' in body) addField('actual_date', body.actual_date || null);
    if ('name'        in body) addField('name',        body.name);
    if ('owner'       in body) addField('owner',       body.owner ?? null);
    if ('start_date'  in body) addField('start_date',  body.start_date);
    if ('end_date'    in body) addField('end_date',    body.end_date);
    if ('status'      in body) addField('status',      body.status);
    if ('is_milestone' in body) addField('is_milestone', body.is_milestone);

    if (setClauses.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(tid, projectId);
    const result = await query(
      `UPDATE "GanttTask" SET ${setClauses.join(', ')} WHERE id = $${params.length - 1} AND project_id = $${params.length} RETURNING id`,
      params
    );

    if (!result.rowCount) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// DELETE /api/projects/:id/gantt/tasks/:tid
router.delete('/tasks/:tid', async (req, res) => {
  const { id: projectId, tid } = req.params as { id: string; tid: string };
  try {
    const result = await query('DELETE FROM "GanttTask" WHERE id = $1 AND project_id = $2 RETURNING id', [tid, projectId]);
    if (!result.rowCount) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
