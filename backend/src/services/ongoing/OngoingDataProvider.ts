export interface SnapshotData {
  id?: number;
  project_id: number;
  reporting_date: Date | string;
  hours_spent_to_date: number;
  cost_spent_to_date: number;
  working_days_used: number;
  working_days_remaining: number;
  source: 'manual' | 'keyedin_api';
  created_at?: Date | string;
}

export interface OngoingDataProvider {
  getLatestSnapshot(projectId: string): Promise<SnapshotData | null>;
  getHistory(projectId: string): Promise<SnapshotData[]>;
  saveSnapshot(data: SnapshotData): Promise<SnapshotData>;
  syncData(projectId: string): Promise<SnapshotData>;
}
