import { query } from '../../db';
import { OngoingDataProvider, SnapshotData } from './OngoingDataProvider';

export class ManualFallbackProvider implements OngoingDataProvider {
  async getLatestSnapshot(projectId: string): Promise<SnapshotData | null> {
    const res = await query(
      'SELECT * FROM "OngoingSnapshot" WHERE project_id = $1 ORDER BY reporting_date DESC, created_at DESC LIMIT 1',
      [projectId]
    );
    return (res.rowCount !== null && res.rowCount > 0) ? res.rows[0] : null;
  }

  async getHistory(projectId: string): Promise<SnapshotData[]> {
    const res = await query(
      'SELECT * FROM "OngoingSnapshot" WHERE project_id = $1 ORDER BY reporting_date DESC, created_at DESC',
      [projectId]
    );
    return res.rows;
  }

  async saveSnapshot(data: SnapshotData): Promise<SnapshotData> {
    const { project_id, reporting_date, hours_spent_to_date, cost_spent_to_date, working_days_used, working_days_remaining, source } = data;
    
    const res = await query(
      `INSERT INTO "OngoingSnapshot" 
       (project_id, reporting_date, hours_spent_to_date, cost_spent_to_date, working_days_used, working_days_remaining, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [project_id, reporting_date, hours_spent_to_date, cost_spent_to_date, working_days_used, working_days_remaining, source]
    );
    return res.rows[0];
  }

  async syncData(projectId: string): Promise<SnapshotData> {
    throw new Error('ManualFallbackProvider does not support automated sync');
  }
}
