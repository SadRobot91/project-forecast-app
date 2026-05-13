import { Router } from 'express';
import { query } from '../db';

const router = Router();

// GET /api/phase-templates
router.get('/', async (_req, res) => {
  try {
    const result = await query(
      'SELECT * FROM "PhaseTemplate" ORDER BY "order"',
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/phase-templates
router.post('/', async (req, res) => {
  const { display_name, order } = req.body;
  if (!display_name || typeof display_name !== 'string' || display_name.trim() === '') {
    return res.status(400).json({ error: 'display_name is required' });
  }
  if (order === undefined || isNaN(parseInt(order, 10))) {
    return res.status(400).json({ error: 'order must be a number' });
  }
  try {
    const existing = await query(
      'SELECT id FROM "PhaseTemplate" WHERE LOWER(display_name) = LOWER($1)',
      [display_name.trim()],
    );
    if (existing.rowCount) {
      return res.status(409).json({ error: `Esiste già una fase con nome "${display_name.trim()}"` });
    }
    const name = `custom_${Date.now()}`;
    const result = await query(
      `INSERT INTO "PhaseTemplate" (name, display_name, "order", default_contingency_pct)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, display_name.trim(), parseInt(order, 10), parseFloat(req.body.default_contingency_pct) || 0],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/phase-templates/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { display_name, order, default_contingency_pct, active } = req.body;

  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (display_name !== undefined) {
    if (typeof display_name !== 'string' || display_name.trim() === '') {
      return res.status(400).json({ error: 'display_name must be a non-empty string' });
    }
    updates.push(`display_name = $${idx++}`);
    values.push(display_name.trim());
  }
  if (order !== undefined) {
    updates.push(`"order" = $${idx++}`);
    values.push(parseInt(order, 10));
  }
  if (default_contingency_pct !== undefined) {
    const pct = parseFloat(default_contingency_pct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ error: 'default_contingency_pct must be 0–100' });
    }
    updates.push(`default_contingency_pct = $${idx++}`);
    values.push(pct);
  }
  if (active !== undefined) {
    updates.push(`active = $${idx++}`);
    values.push(Boolean(active));
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(parseInt(id, 10));
  try {
    const result = await query(
      `UPDATE "PhaseTemplate" SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    if (!result.rowCount) return res.status(404).json({ error: 'PhaseTemplate not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/phase-templates/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(
      'DELETE FROM "PhaseTemplate" WHERE id = $1 RETURNING id',
      [id],
    );
    if (!result.rowCount) return res.status(404).json({ error: 'PhaseTemplate not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
