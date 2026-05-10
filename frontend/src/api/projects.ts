import { apiClient } from './client';
import type { DashboardData, ProjectStatus, ProjectSummary } from '../types';
import { MOCK_PROJECTS, MOCK_DASHBOARD } from '../mocks/mockData';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export async function fetchProjects(): Promise<ProjectSummary[]> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    return MOCK_PROJECTS;
  }
  return apiClient<ProjectSummary[]>('/api/projects');
}

export async function fetchDashboard(projectId: string): Promise<DashboardData> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    const id = parseInt(projectId, 10);
    const project = MOCK_PROJECTS.find((p) => p.id === id);
    return { ...MOCK_DASHBOARD, project_id: id, project_name: project?.name ?? MOCK_DASHBOARD.project_name };
  }
  return apiClient<DashboardData>(`/api/projects/${projectId}/dashboard`);
}

export async function updateProjectStatus(projectId: number, status: ProjectStatus): Promise<void> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 200));
    const p = MOCK_PROJECTS.find((x) => x.id === projectId);
    if (p) p.status = status;
    return;
  }
  await apiClient(`/api/projects/${projectId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
