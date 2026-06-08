import { Router } from 'express';
import { ManualFallbackProvider } from '../services/ongoing/ManualFallbackProvider';
import { KeyedinApiProvider } from '../services/ongoing/KeyedinApiProvider';
import { SnapshotData } from '../services/ongoing/OngoingDataProvider';
import { query } from '../db';

const router = Router({ mergeParams: true });
const manualProvider = new ManualFallbackProvider();
const keyedinProvider = new KeyedinApiProvider();

// GET /api/projects/:id/ongoing
router.get('/', async (req, res) => {
  const { id: projectId } = req.params as { id: string };
  const rawPhaseId = req.query.phase_id as string | undefined;
  const phaseId = rawPhaseId !== undefined ? (rawPhaseId === '' ? null : parseInt(rawPhaseId, 10)) : undefined;

  try {
    const projRes = await query(
      `SELECT p.name,
              COALESCE((SELECT SUM(ae.weekly_cost) FROM "AllocationEntry" ae WHERE ae.project_id = p.id), 0)::numeric as budget_total,
              COALESCE((SELECT SUM(pp.working_days) FROM "ProjectPhase" pp WHERE pp.project_id = p.id), 0)::integer as total_working_days
       FROM "Project" p WHERE p.id = $1`,
      [projectId]
    );
    if (!projRes.rowCount) return res.status(404).json({ error: 'Project not found' });

    const phasesRes = await query(
      `SELECT id, display_name, phase_type, "order" FROM "ProjectPhase" WHERE project_id = $1 ORDER BY "order"`,
      [projectId]
    );

    const snapshot = await manualProvider.getLatestSnapshot(projectId, phaseId);

    res.json({
      project_name:        projRes.rows[0].name,
      budget_total:        parseFloat(projRes.rows[0].budget_total),
      total_working_days:  parseInt(projRes.rows[0].total_working_days, 10),
      snapshot:            snapshot ?? null,
      phases:              phasesRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/ongoing/history
router.get('/history', async (req, res) => {
  const { id: projectId } = req.params as { id: string };
  const rawPhaseId = req.query.phase_id as string | undefined;
  const phaseId = rawPhaseId !== undefined ? (rawPhaseId === '' ? null : parseInt(rawPhaseId, 10)) : undefined;

  try {
    const history = await manualProvider.getHistory(projectId, phaseId);
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects/:id/ongoing
router.post('/', async (req, res) => {
  const { id: projectId } = req.params as { id: string };
  const { reporting_date, hours_spent_to_date, cost_spent_to_date, working_days_used, working_days_remaining, phase_id } = req.body;

  if (!reporting_date || typeof reporting_date !== 'string') {
    return res.status(400).json({ error: 'reporting_date is required (YYYY-MM-DD)' });
  }
  if (cost_spent_to_date === undefined || cost_spent_to_date === null || isNaN(parseFloat(cost_spent_to_date))) {
    return res.status(400).json({ error: 'cost_spent_to_date is required and must be a number' });
  }
  if (hours_spent_to_date === undefined || hours_spent_to_date === null || isNaN(parseFloat(hours_spent_to_date))) {
    return res.status(400).json({ error: 'hours_spent_to_date is required and must be a number' });
  }

  const resolvedPhaseId: number | null = (phase_id !== undefined && phase_id !== null) ? parseInt(phase_id, 10) : null;

  try {
    if (resolvedPhaseId !== null) {
      const phaseCheck = await query(
        'SELECT 1 FROM "ProjectPhase" WHERE id = $1 AND project_id = $2',
        [resolvedPhaseId, projectId]
      );
      if (!phaseCheck.rowCount) {
        return res.status(400).json({ error: 'phase_id does not belong to this project' });
      }
    }

    const data: SnapshotData = {
      project_id: parseInt(projectId, 10),
      phase_id: resolvedPhaseId,
      reporting_date,
      hours_spent_to_date,
      cost_spent_to_date,
      working_days_used,
      working_days_remaining,
      source: 'manual'
    };
    const saved = await manualProvider.saveSnapshot(data);
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:id/ongoing/:snapshotId
// Only allowed within 24 hours of creation (deletion window)
router.delete('/:snapshotId', async (req, res) => {
  const { id: projectId, snapshotId } = req.params as { id: string; snapshotId: string };
  try {
    const existing = await query(
      'SELECT id, created_at FROM "OngoingSnapshot" WHERE id = $1 AND project_id = $2',
      [snapshotId, projectId],
    );
    if (!existing.rowCount) return res.status(404).json({ error: 'Snapshot not found' });

    const createdAt = new Date(existing.rows[0].created_at);
    const windowMs = 24 * 60 * 60 * 1000;
    if (Date.now() - createdAt.getTime() > windowMs) {
      return res.status(403).json({ error: 'Deletion window expired (24h). Snapshot is now locked.' });
    }

    await query('DELETE FROM "OngoingSnapshot" WHERE id = $1', [snapshotId]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects/:id/ongoing/sync
router.post('/sync', async (req, res) => {
  const { id: projectId } = req.params as { id: string };
  try {
    const synced = await keyedinProvider.syncData(projectId);
    res.status(201).json(synced);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
