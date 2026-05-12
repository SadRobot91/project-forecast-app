import { Router } from 'express';
import { query } from '../db';
import { calculateRevisedForecast, calculateRAGStatus } from '../services/computations';

const router = Router();

// GET /api/projects
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT p.id, p.name, p.status, p.currency,
              ph.phase_type as current_phase,
              COALESCE((
                SELECT SUM(ae.weekly_cost)
                FROM "AllocationEntry" ae
                WHERE ae.project_id = p.id
              ), 0)::numeric as budget_total,
              COALESCE((
                SELECT os.cost_spent_to_date
                FROM "OngoingSnapshot" os
                WHERE os.project_id = p.id
                ORDER BY os.reporting_date DESC, os.created_at DESC
                LIMIT 1
              ), 0)::numeric as budget_spent,
              (
                SELECT MAX(pp2.planned_end)
                FROM "ProjectPhase" pp2
                WHERE pp2.project_id = p.id
              ) as project_end,
              COALESCE((
                SELECT SUM(pp3.working_days)
                FROM "ProjectPhase" pp3
                WHERE pp3.project_id = p.id
              ), 0)::integer as working_days_total
       FROM "Project" p
       LEFT JOIN "ProjectPhase" ph ON ph.project_id = p.id AND ph.status = 'in_progress'
       GROUP BY p.id, p.name, p.status, p.currency, ph.phase_type
       ORDER BY p.id`
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const projects = result.rows.map((r: any) => {
      const total  = parseFloat(r.budget_total) || 0;
      const spent  = parseFloat(r.budget_spent) || 0;
      const budgetPct = total > 0 ? Math.round((spent / total) * 100) : 0;

      let daysRemaining = 0;
      if (r.project_end) {
        const end = new Date(r.project_end);
        end.setHours(0, 0, 0, 0);
        if (end >= today) {
          let d = new Date(today);
          while (d <= end) {
            const dow = d.getDay();
            if (dow !== 0 && dow !== 6) daysRemaining++;
            d.setDate(d.getDate() + 1);
          }
        }
      }

      const wdTotal = parseInt(r.working_days_total, 10) || 0;
      const dailyBurnRate = wdTotal > 0 ? total / wdTotal : 0;
      const revisedForecast = calculateRevisedForecast(0, spent, dailyBurnRate, daysRemaining, 0, 0);
      const ragStatus = calculateRAGStatus(revisedForecast, total);

      return {
        id: r.id,
        name: r.name,
        status: r.status,
        rag_status: ragStatus,
        current_phase: r.current_phase ?? null,
        budget_total: total,
        budget_spent: spent,
        budget_pct: budgetPct,
        days_remaining: daysRemaining,
        currency: r.currency ?? 'GBP',
      };
    });

    res.json(projects);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PATCH /api/projects/:id/status
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body as { status: string };

  const allowed = ['active', 'on_hold', 'closed', 'archived'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
  }

  try {
    const result = await query(
      'UPDATE "Project" SET status = $1 WHERE id = $2 RETURNING id, status',
      [status, id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
