import { Router } from 'express';
import { query, withTransaction } from '../db';
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/resources/capacity-heatmap?weeks=12 — deve stare prima di /:id.
// Vista densa demand-vs-supply derivata da getRegistryAggregate (registry
// condiviso cross-project: nessun filtro pm_id, sotto requireAuth soltanto).
// Capacità per-risorsa fissa a 1.0 FTE/settimana — l'invariante già imposto da
// canAllocate; banda colore <0.5 sotto / 0.5–1.0 ottimale / >1.0 eccesso. (M-005)
const capacityBand = (total: number): 'under' | 'optimal' | 'over' => {
  if (total > 1.0) return 'over';
  if (total >= 0.5) return 'optimal';
  return 'under';
};

const currentMondayISO = (): string => {
  const d = new Date();
  const day = d.getUTCDay();                 // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;     // back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
};

router.get('/capacity-heatmap', async (req, res) => {
  try {
    const weeksParam = parseInt(req.query.weeks as string, 10);
    const horizon = Number.isFinite(weeksParam) && weeksParam > 0
      ? Math.min(weeksParam, 52)
      : 12;

    const aggregate = await getRegistryAggregate();

    // Prefer the next `horizon` weeks from the current week forward; if the data
    // is entirely in the past (e.g. demo/seed), fall back to the last `horizon`.
    const monday = currentMondayISO();
    const future = aggregate.weeks.filter((w) => w >= monday).slice(0, horizon);
    const weeks = future.length > 0 ? future : aggregate.weeks.slice(-horizon);

    const resources = aggregate.rows.map((r) => ({
      resource_id: r.resource.id,
      name: r.resource.name,
      role: r.resource.role,
      cells: weeks.map((w) => {
        const total = r.totals[w] ?? 0;
        return { week_start: w, total_fte: total, band: capacityBand(total) };
      }),
    }));

    res.json({ weeks, resources });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
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
    const updated = await withTransaction(async (q) => {
      const result = await q(
        'UPDATE "Resource" SET name = $1, role = $2, day_rate = $3 WHERE id = $4 RETURNING *',
        [name.trim(), role ?? '', rate, id]
      );
      if (result.rowCount === 0) {
        throw Object.assign(new Error('Not found'), { status: 404 });
      }

      // Record the new rate in history so Knowledge Graph can look up the rate
      // that was in effect at any given week_start.
      await q(
        `INSERT INTO "ResourceDayRateHistory" (resource_id, day_rate, effective_from)
         VALUES ($1, $2, CURRENT_DATE)
         ON CONFLICT (resource_id, effective_from) DO UPDATE SET day_rate = EXCLUDED.day_rate`,
        [id, rate]
      );

      // Cascade new rate only to current/future entries — past entries preserve
      // their original weekly_cost (point-in-time truth for historical analysis).
      await q(
        `UPDATE "AllocationEntry"
         SET weekly_cost = $1 * fte * working_days
         WHERE resource_id = $2 AND week_start >= DATE_TRUNC('week', CURRENT_DATE)`,
        [rate, id]
      );

      return result.rows[0];
    });
    res.json(updated);
  } catch (err: any) {
    if (err.status === 404) return res.status(404).json({ error: 'Not found' });
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
