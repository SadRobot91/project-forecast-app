import { OngoingDataProvider, SnapshotData } from './OngoingDataProvider';
import { ManualFallbackProvider } from './ManualFallbackProvider';

export class KeyedinApiProvider implements OngoingDataProvider {
  private fallbackProvider = new ManualFallbackProvider();

  async getLatestSnapshot(projectId: string): Promise<SnapshotData | null> {
    return this.fallbackProvider.getLatestSnapshot(projectId);
  }

  async getHistory(projectId: string): Promise<SnapshotData[]> {
    return this.fallbackProvider.getHistory(projectId);
  }

  async saveSnapshot(data: SnapshotData): Promise<SnapshotData> {
    throw new Error('KeyedinApiProvider does not support manual save. Use sync instead.');
  }

  async syncData(projectId: string): Promise<SnapshotData> {
    // Stub implementation: later this will call Keyedin API.
    // For now, just generate a stub snapshot.
    const stubData: SnapshotData = {
      project_id: parseInt(projectId, 10),
      reporting_date: new Date().toISOString().split('T')[0], // format as YYYY-MM-DD
      hours_spent_to_date: 0,
      cost_spent_to_date: 0,
      working_days_used: 0,
      working_days_remaining: 0,
      source: 'keyedin_api'
    };

    return this.fallbackProvider.saveSnapshot(stubData);
  }
}
