import { Router } from 'express';
import { ManualFallbackProvider } from '../services/ongoing/ManualFallbackProvider';
import { KeyedinApiProvider } from '../services/ongoing/KeyedinApiProvider';
import { SnapshotData } from '../services/ongoing/OngoingDataProvider';

const router = Router({ mergeParams: true });
const manualProvider = new ManualFallbackProvider();
const keyedinProvider = new KeyedinApiProvider();

// GET /api/projects/:id/ongoing
router.get('/', async (req, res) => {
  const { id: projectId } = req.params as { id: string };
  try {
    const snapshot = await manualProvider.getLatestSnapshot(projectId);
    if (!snapshot) return res.status(404).json({ error: 'No ongoing snapshot found' });
    res.json(snapshot);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/ongoing/history
router.get('/history', async (req, res) => {
  const { id: projectId } = req.params as { id: string };
  try {
    const history = await manualProvider.getHistory(projectId);
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects/:id/ongoing
router.post('/', async (req, res) => {
  const { id: projectId } = req.params as { id: string };
  const { reporting_date, hours_spent_to_date, cost_spent_to_date, working_days_used, working_days_remaining } = req.body;

  if (!reporting_date || typeof reporting_date !== 'string') {
    return res.status(400).json({ error: 'reporting_date is required (YYYY-MM-DD)' });
  }
  if (cost_spent_to_date === undefined || cost_spent_to_date === null || isNaN(parseFloat(cost_spent_to_date))) {
    return res.status(400).json({ error: 'cost_spent_to_date is required and must be a number' });
  }
  if (hours_spent_to_date === undefined || hours_spent_to_date === null || isNaN(parseFloat(hours_spent_to_date))) {
    return res.status(400).json({ error: 'hours_spent_to_date is required and must be a number' });
  }

  try {
    const data: SnapshotData = {
      project_id: parseInt(projectId, 10),
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
