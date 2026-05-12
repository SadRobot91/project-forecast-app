import { apiClient } from './client';
import type { GanttData, GanttTask, PhaseType, TaskStatus } from '../types';
import { MOCK_GANTT, MOCK_PROJECTS } from '../mocks/mockData';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export async function fetchGantt(projectId: string): Promise<GanttData> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 350));
    const id = parseInt(projectId, 10);
    const project = MOCK_PROJECTS.find((p) => p.id === id);
    return { ...MOCK_GANTT, project_id: id, project_name: project?.name ?? MOCK_GANTT.project_name };
  }
  return apiClient<GanttData>(`/api/projects/${projectId}/gantt`);
}

export interface TaskPayload {
  name?: string;
  owner?: string | null;
  start_date?: string;
  end_date?: string;
  status?: TaskStatus;
  is_milestone?: boolean;
  actual_date?: string | null;
}

export async function updateTask(projectId: string, taskId: number, data: TaskPayload): Promise<void> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    for (const phase of MOCK_GANTT.phases) {
      const task = phase.tasks.find((t) => t.id === taskId);
      if (task) { Object.assign(task, data); break; }
    }
    return;
  }
  await apiClient(`/api/projects/${projectId}/gantt/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function createTask(
  projectId: string,
  data: TaskPayload & { phase_id: number; phase_type: PhaseType }
): Promise<GanttTask> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    const newTask: GanttTask = {
      id: Math.floor(Math.random() * 1000) + 100,
      project_id: parseInt(projectId, 10),
      phase_id: data.phase_id,
      phase_type: data.phase_type,
      name: data.name ?? 'Nuovo task',
      owner: data.owner ?? null,
      start_date: data.start_date ?? '',
      end_date: data.end_date ?? '',
      working_days: 0,
      is_milestone: data.is_milestone ?? false,
      actual_date: data.actual_date ?? null,
      status: data.status ?? 'not_started',
    };
    const phase = MOCK_GANTT.phases.find((p) => p.phase_id === data.phase_id);
    if (phase) phase.tasks.push(newTask);
    return newTask;
  }
  return apiClient<GanttTask>(`/api/projects/${projectId}/gantt/tasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteTask(projectId: string, taskId: number): Promise<void> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 200));
    for (const phase of MOCK_GANTT.phases) {
      const idx = phase.tasks.findIndex((t) => t.id === taskId);
      if (idx !== -1) { phase.tasks.splice(idx, 1); break; }
    }
    return;
  }
  await apiClient(`/api/projects/${projectId}/gantt/tasks/${taskId}`, { method: 'DELETE' });
}
