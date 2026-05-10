import { apiClient } from './client';
import type { BaselineData } from '../types';
import { MOCK_BASELINE, MOCK_PROJECTS } from '../mocks/mockData';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export async function fetchBaseline(projectId: string): Promise<BaselineData> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 350));
    const id = parseInt(projectId, 10);
    const project = MOCK_PROJECTS.find((p) => p.id === id);
    return { ...MOCK_BASELINE, project_id: id, project_name: project?.name ?? MOCK_BASELINE.project_name };
  }
  return apiClient<BaselineData>(`/api/projects/${projectId}/baseline`);
}

export async function saveBaseline(
  projectId: string,
  phases: { phase_id: number; planned_start: string; planned_end: string; contingency_pct?: number }[]
): Promise<BaselineData> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 500));
    return { ...MOCK_BASELINE };
  }
  return apiClient<BaselineData>(`/api/projects/${projectId}/baseline`, {
    method: 'PUT',
    body: JSON.stringify({ phases }),
  });
}

export async function lockBaseline(projectId: string): Promise<{ locked_at: string }> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 600));
    return { locked_at: new Date().toISOString() };
  }
  return apiClient<{ locked_at: string }>(`/api/projects/${projectId}/baseline/lock`, {
    method: 'POST',
  });
}
