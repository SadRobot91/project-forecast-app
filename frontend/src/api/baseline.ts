import { apiClient } from './client';
import { withMock } from './mock';
import type { BaselineData } from '../types';
import { MOCK_BASELINE, MOCK_PROJECTS } from '../mocks/mockData';

export function fetchBaseline(projectId: string): Promise<BaselineData> {
  return withMock(
    () => {
      const id = parseInt(projectId, 10);
      const project = MOCK_PROJECTS.find((p) => p.id === id);
      return { ...MOCK_BASELINE, project_id: id, project_name: project?.name ?? MOCK_BASELINE.project_name };
    },
    () => apiClient<BaselineData>(`/api/projects/${projectId}/baseline`),
  );
}

export function saveBaseline(
  projectId: string,
  phases: { phase_id: number; planned_start: string; planned_end: string; contingency_pct?: number; display_name?: string }[]
): Promise<BaselineData> {
  return withMock(
    () => ({ ...MOCK_BASELINE }),
    () => apiClient<BaselineData>(`/api/projects/${projectId}/baseline`, {
      method: 'PUT',
      body: JSON.stringify({ phases }),
    }),
  );
}

export function lockBaseline(projectId: string): Promise<{ locked_at: string }> {
  return withMock(
    () => ({ locked_at: new Date().toISOString() }),
    () => apiClient<{ locked_at: string }>(`/api/projects/${projectId}/baseline/lock`, {
      method: 'POST',
    }),
  );
}
