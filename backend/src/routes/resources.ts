import { Router } from 'express';
import { query } from '../db';

const router = Router();

// GET /api/resources/registry — deve stare prima di /:id per evitare conflitti
router.get('/registry', async (req, res) => {
  try {
    const allocRes = await query(
      `SELECT r.id as resource_id, r.name as resource_name, r.role, r.day_rate::numeric as day_rate,
              p.id as project_id, p.name as project_name, p.status as project_status,
              to_char(ae.week_start, 'YYYY-MM-DD') as week_start,
              ae.fte::numeric as fte
       FROM "AllocationEntry" ae
       JOIN "Resource" r ON r.id = ae.resource_id
       JOIN "Project" p ON p.id = ae.project_id
       ORDER BY r.name, p.name, ae.week_start`
    );

    const resourceMap = new Map<number, any>();
    const weekSet = new Set<string>();

    for (const row of allocRes.rows) {
      weekSet.add(row.week_start);
      if (!resourceMap.has(row.resource_id)) {
        resourceMap.set(row.resource_id, {
          resource: {
            id: row.resource_id,
            name: row.resource_name,
            role: row.role,
            day_rate: parseFloat(row.day_rate),
          },
          allocations: [],
          totals: {},
        });
      }
      const entry = resourceMap.get(row.resource_id);
      const fte = parseFloat(row.fte);
      entry.allocations.push({
        project_id: row.project_id,
        project_name: row.project_name,
        project_status: row.project_status,
        week_start: row.week_start,
        fte,
      });
      entry.totals[row.week_start] = parseFloat(((entry.totals[row.week_start] ?? 0) + fte).toFixed(4));
    }

    const weeks = Array.from(weekSet).sort();
    const rows = Array.from(resourceMap.values());
    const hasOverallocation = rows.some((r) =>
      Object.values(r.totals).some((t: any) => t > 1.0)
    );

    res.json({ weeks, rows, has_overallocation: hasOverallocation });
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
  try {
    const result = await query(
      'INSERT INTO "Resource" (name, role, day_rate) VALUES ($1, $2, $3) RETURNING *',
      [name, role, day_rate]
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
  try {
    const result = await query(
      'UPDATE "Resource" SET name = $1, role = $2, day_rate = $3 WHERE id = $4 RETURNING *',
      [name, role, day_rate, id]
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
