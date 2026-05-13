import { Router } from 'express';
import { query } from '../db';
import { calculateNetworkDays } from '../services/computations';

const router = Router({ mergeParams: true });

const VALID_STATUSES = ['not_started', 'in_progress', 'completed', 'on_hold'] as const;
type PhaseStatus = typeof VALID_STATUSES[number];

/**
 * PATCH /api/projects/:id/phases/:phase_id
 *
 * Working-copy update for a phase. Allowed even when the baseline is
 * locked: planned dates and status are part of the live schedule, not the
 * BAC. Only contingency_pct and display_name are BAC parameters — those
 * stay on PUT /baseline (rejected post-lock).
 *
 * Accepted body fields (all optional, any subset):
 *   - planned_start: 'YYYY-MM-DD' | null
 *   - planned_end:   'YYYY-MM-DD' | null
 *   - status:        'not_started' | 'in_progress' | 'completed' | 'on_hold'
 *
 * When either date changes, working_days and planned_hours are recomputed
 * from the new range using NETWORKDAYS minus IT public holidays.
 */
router.patch('/:phase_id', async (req, res) => {
  const { id: projectId, phase_id: phaseId } = req.params as { id: string; phase_id: string };
  const { planned_start, planned_end, status } = req.body as {
    planned_start?: string | null;
    planned_end?: string | null;
    status?: string;
  };

  if (planned_start !== undefined && planned_start !== null && typeof planned_start !== 'string') {
    return res.status(400).json({ error: 'planned_start must be a YYYY-MM-DD string or null' });
  }
  if (planned_end !== undefined && planned_end !== null && typeof planned_end !== 'string') {
    return res.status(400).json({ error: 'planned_end must be a YYYY-MM-DD string or null' });
  }
  if (status !== undefined && !VALID_STATUSES.includes(status as PhaseStatus)) {
    return res.status(400).json({
      error: `status must be one of: ${VALID_STATUSES.join(', ')}`,
    });
  }

  // Cross-field validation: if both dates end up set, end must be >= start.
  // We need to know the resulting state, so compare provided values against
  // current ones when only one side is in the payload.
  try {
    const phaseRes = await query(
      `SELECT planned_start, planned_end
         FROM "ProjectPhase"
        WHERE id = $1 AND project_id = $2`,
      [phaseId, projectId]
    );
    if (!phaseRes.rowCount) {
      return res.status(404).json({ error: 'Phase not found in this project' });
    }
    const current = phaseRes.rows[0];

    function toIso(d: Date | string | null | undefined): string | null {
      if (!d) return null;
      const date = d instanceof Date ? d : new Date(d);
      if (isNaN(date.getTime())) return null;
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    const nextStart = planned_start !== undefined ? planned_start : toIso(current.planned_start);
    const nextEnd   = planned_end   !== undefined ? planned_end   : toIso(current.planned_end);

    if (nextStart && nextEnd && nextEnd < nextStart) {
      return res.status(400).json({ error: 'planned_end must be on or after planned_start' });
    }

    const datesChanged = planned_start !== undefined || planned_end !== undefined;
    let workingDays = 0;
    if (datesChanged && nextStart && nextEnd) {
      const holidaysRes = await query(`SELECT date FROM "PublicHoliday" WHERE country_code = 'IT'`);
      const holidays = holidaysRes.rows.map((h: any) => new Date(h.date));
      workingDays = calculateNetworkDays(new Date(nextStart), new Date(nextEnd), holidays);
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (planned_start !== undefined) {
      updates.push(`planned_start = $${idx++}`);
      values.push(planned_start || null);
    }
    if (planned_end !== undefined) {
      updates.push(`planned_end = $${idx++}`);
      values.push(planned_end || null);
    }
    if (datesChanged) {
      updates.push(`working_days = $${idx++}`);
      values.push(workingDays);
      updates.push(`planned_hours = $${idx++}`);
      values.push(workingDays * 8);
    }
    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(phaseId);
    const result = await query(
      `UPDATE "ProjectPhase" SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
