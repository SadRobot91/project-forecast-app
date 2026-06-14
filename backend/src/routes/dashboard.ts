import { Router } from 'express';
import { query } from '../db';
import { calculateNetworkDays } from '../services/computations';
import { computeProjectFinancials } from '../services/phaseFinancialEngine';

const router = Router({ mergeParams: true });

function isoDate(d: Date | null): string {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// GET /api/projects/:id/dashboard
router.get('/', async (req, res) => {
  const { id: projectId } = req.params as { id: string };

  try {
    const projRes = await query('SELECT name, tags FROM "Project" WHERE id = $1', [projectId]);
    if (!projRes.rowCount) return res.status(404).json({ error: 'Project not found' });

    // Phases with budget from allocations
    const phasesRes = await query(
      `SELECT pp.id as phase_id, pp.phase_type, pp.display_name, pp.planned_start, pp.planned_end,
              pp.working_days, pp.planned_hours, pp.status,
              COALESCE(SUM(ae.weekly_cost), 0)::numeric as budget
       FROM "ProjectPhase" pp
       LEFT JOIN "AllocationEntry" ae ON ae.phase_id = pp.id
       WHERE pp.project_id = $1
       GROUP BY pp.id
       ORDER BY pp."order"`,
      [projectId]
    );

    // Latest ongoing snapshot
    const ongoingRes = await query(
      `SELECT cost_spent_to_date, hours_spent_to_date, working_days_used,
              working_days_remaining, source, created_at
       FROM "OngoingSnapshot" WHERE project_id = $1
       ORDER BY reporting_date DESC, created_at DESC LIMIT 1`,
      [projectId]
    );
    const ongoing = ongoingRes.rows[0] ?? null;

    // Milestones (first 5 upcoming, then past)
    const milestonesRes = await query(
      `SELECT id, name, start_date as planned_date, actual_date, status
       FROM "GanttTask"
       WHERE project_id = $1 AND is_milestone = true
       ORDER BY start_date`,
      [projectId]
    );

    // Phase Financial Engine — EAC per fase e rollup di progetto
    const rollup = await computeProjectFinancials(parseInt(projectId, 10));

    // Compute flat KPIs (legacy fields preserved for backward compatibility)
    const phases = phasesRes.rows;
    const totalBudget       = rollup.total_budget;
    const totalWorkingDays  = phases.reduce((s: number, p: any) => s + (p.working_days ?? 0), 0);
    // Use rollup to avoid contradiction between project-level snapshot and phase-level engine
    const costSpent         = rollup.total_cost_spent;
    const hoursSpent        = rollup.total_hours_spent;
    const dailyBurnRate     = totalWorkingDays > 0 ? totalBudget / totalWorkingDays : 0;

    let daysRemaining = totalWorkingDays;
    if (ongoing) {
      daysRemaining = ongoing.working_days_remaining;
    } else {
      const maxEnd = phases.map((p: any) => p.planned_end).filter(Boolean).sort().pop();
      if (maxEnd) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const end   = new Date(maxEnd); end.setHours(0, 0, 0, 0);
        daysRemaining = end >= today ? calculateNetworkDays(today, end, []) : 0;
      }
    }

    const revisedForecast = rollup.total_revised_forecast;
    const ragStatus       = rollup.rag_status;
    const budgetPct       = totalBudget > 0 ? Math.round((costSpent / totalBudget) * 100) : 0;
    const variance        = Math.round(rollup.total_variance);

    const phaseBudgets = phases.map((p: any) => {
      const budget = parseFloat(p.budget);
      const wd     = p.working_days ?? 0;
      return {
        phase_id:          p.phase_id,
        phase_type:        p.phase_type,
        display_name:      p.display_name ?? p.phase_type,
        planned_start:     isoDate(p.planned_start),
        planned_end:       isoDate(p.planned_end),
        working_days:      wd,
        planned_hours:     p.planned_hours ?? wd * 8,
        burn_rate_per_day: wd > 0 ? Math.round(budget / wd) : 0,
        budget,
        budget_pct_of_total: totalBudget > 0
          ? parseFloat(((budget / totalBudget) * 100).toFixed(1))
          : 0,
      };
    });

    res.json({
      project_id:   parseInt(projectId, 10),
      project_name: projRes.rows[0].name,
      tags:         projRes.rows[0].tags ?? [],
      kpis: {
        cost_spent:        costSpent,
        budget_total:      totalBudget,
        revised_forecast:  Math.round(revisedForecast),
        daily_burn_rate:   Math.round(dailyBurnRate),
        variance,
        days_remaining:    daysRemaining,
        budget_pct:        budgetPct,
        rag_status:             ragStatus,
        last_sync_at:           ongoing?.created_at ?? null,
        last_sync_source:       ongoing?.source ?? null,
        hours_spent_to_date:    hoursSpent,
        working_days_used:      rollup.total_working_days_used,
      },
      phase_budgets: phaseBudgets,
      phase_financials: rollup.phases,
      milestones: milestonesRes.rows.map((m: any) => ({
        id:           m.id,
        name:         m.name,
        planned_date: isoDate(m.planned_date),
        actual_date:  m.actual_date ? isoDate(m.actual_date) : null,
        status:       m.status,
        is_milestone: true,
      })),
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
