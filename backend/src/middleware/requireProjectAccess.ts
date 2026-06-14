import { Request, Response, NextFunction } from 'express';
import { query } from '../db/index';

/**
 * Object-level authorization per /api/projects/:id/*.
 * Il PM accede solo ai progetti di cui è owner (Project.pm_id); il DM a tutti.
 * Risponde 404 (non 403) per non confermare l'esistenza di progetti altrui.
 */
export async function requireProjectAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id?: string };

    if (!id || !/^\d+$/.test(id)) return next();

    const result = await query('SELECT pm_id FROM "Project" WHERE id = $1', [id]);
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (req.auth?.role !== 'dm' && result.rows[0].pm_id !== req.auth?.userId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
