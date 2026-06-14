import { apiClient } from './client';
import { withMock } from './mock';
import type { DashboardData, ProjectStatus, ProjectSummary } from '../types';
import { MOCK_PROJECTS, MOCK_DASHBOARD } from '../mocks/mockData';

export function fetchProjects(): Promise<ProjectSummary[]> {
  return withMock(
    () => MOCK_PROJECTS,
    () => apiClient<ProjectSummary[]>('/api/projects'),
  );
}

export function fetchDashboard(projectId: string): Promise<DashboardData> {
  return withMock(
    () => {
      const id = parseInt(projectId, 10);
      const project = MOCK_PROJECTS.find((p) => p.id === id);
      return { ...MOCK_DASHBOARD, project_id: id, project_name: project?.name ?? MOCK_DASHBOARD.project_name };
    },
    () => apiClient<DashboardData>(`/api/projects/${projectId}/dashboard`),
  );
}

export async function updateProjectStatus(projectId: number, status: ProjectStatus): Promise<void> {
  await withMock(
    () => {
      const p = MOCK_PROJECTS.find((x) => x.id === projectId);
      if (p) p.status = status;
    },
    () => apiClient(`/api/projects/${projectId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  );
}
