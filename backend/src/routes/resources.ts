import { Router } from 'express';
import { query } from '../db';
import { getRegistryAggregate } from '../services/allocationAggregator';

const router = Router();

// GET /api/resources/registry — deve stare prima di /:id per evitare conflitti.
// Step C: delegated to AllocationAggregator service for the cross-project SUM.
router.get('/registry', async (_req, res) => {
  try {
    const aggregate = await getRegistryAggregate();
    res.json(aggregate);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/resources
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM "Resource" ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/resources
router.post('/', async (req, res) => {
  const { name, role, day_rate } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }
  const rate = parseFloat(day_rate);
  if (isNaN(rate) || rate <= 0) {
    return res.status(400).json({ error: 'day_rate must be a positive number' });
  }
  try {
    const result = await query(
      'INSERT INTO "Resource" (name, role, day_rate) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), role ?? '', rate]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/resources/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, role, day_rate } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }
  const rate = parseFloat(day_rate);
  if (isNaN(rate) || rate <= 0) {
    return res.status(400).json({ error: 'day_rate must be a positive number' });
  }
  try {
    // Step B: after lock the BAC is snapshotted on Baseline. day_rate
    // changes affect only future weekly_cost calculations (when an
    // allocation cell is re-saved); they do not retroactively alter the
    // locked baseline. Step G (day_rate versioning) will track rate
    // history for full traceability.
    const result = await query(
      'UPDATE "Resource" SET name = $1, role = $2, day_rate = $3 WHERE id = $4 RETURNING *',
      [name.trim(), role ?? '', rate, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/resources/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const allocCheck = await query('SELECT id FROM "AllocationEntry" WHERE resource_id = $1 LIMIT 1', [id]);
    if (allocCheck.rowCount !== null && allocCheck.rowCount > 0) {
      return res.status(400).json({ error: 'Cannot delete resource that is already allocated.' });
    }
    
    const result = await query('DELETE FROM "Resource" WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
