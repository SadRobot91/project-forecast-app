import { apiClient } from './client';
import { withMock } from './mock';
import type { GanttData, GanttTask, TaskStatus } from '../types';
import { MOCK_GANTT, MOCK_PROJECTS } from '../mocks/mockData';

export function fetchGantt(projectId: string): Promise<GanttData> {
  return withMock(
    () => {
      const id = parseInt(projectId, 10);
      const project = MOCK_PROJECTS.find((p) => p.id === id);
      return { ...MOCK_GANTT, project_id: id, project_name: project?.name ?? MOCK_GANTT.project_name };
    },
    () => apiClient<GanttData>(`/api/projects/${projectId}/gantt`),
  );
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
  await withMock(
    () => {
      for (const phase of MOCK_GANTT.phases) {
        const task = phase.tasks.find((t) => t.id === taskId);
        if (task) { Object.assign(task, data); break; }
      }
    },
    () => apiClient(`/api/projects/${projectId}/gantt/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  );
}

export function createTask(
  projectId: string,
  data: TaskPayload & { phase_id: number }
): Promise<GanttTask> {
  return withMock(
    () => {
      const phase = MOCK_GANTT.phases.find((p) => p.phase_id === data.phase_id);
      const newTask: GanttTask = {
        id: Math.floor(Math.random() * 1000) + 100,
        project_id: parseInt(projectId, 10),
        phase_id: data.phase_id,
        phase_type: phase?.phase_type ?? '',
        name: data.name ?? 'Nuovo task',
        owner: data.owner ?? null,
        start_date: data.start_date ?? '',
        end_date: data.end_date ?? '',
        working_days: 0,
        is_milestone: data.is_milestone ?? false,
        actual_date: data.actual_date ?? null,
        status: data.status ?? 'not_started',
      };
      if (phase) phase.tasks.push(newTask);
      return newTask;
    },
    () => apiClient<GanttTask>(`/api/projects/${projectId}/gantt/tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  );
}

export async function deleteTask(projectId: string, taskId: number): Promise<void> {
  await withMock(
    () => {
      for (const phase of MOCK_GANTT.phases) {
        const idx = phase.tasks.findIndex((t) => t.id === taskId);
        if (idx !== -1) { phase.tasks.splice(idx, 1); break; }
      }
    },
    () => apiClient(`/api/projects/${projectId}/gantt/tasks/${taskId}`, { method: 'DELETE' }),
  );
}
