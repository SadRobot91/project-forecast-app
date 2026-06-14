import { apiClient } from './client';
import { withMock } from './mock';
import type { AllocationData, Resource, ResourceRegistryData, CapacityHeatmapData } from '../types';
import { MOCK_ALLOCATION, MOCK_RESOURCE_REGISTRY, MOCK_PROJECTS, MOCK_CAPACITY_HEATMAP } from '../mocks/mockData';

export function fetchCapacityHeatmap(weeks = 12): Promise<CapacityHeatmapData> {
  return withMock(
    () => MOCK_CAPACITY_HEATMAP,
    () => apiClient<CapacityHeatmapData>(`/api/resources/capacity-heatmap?weeks=${weeks}`),
  );
}

export function fetchAllocation(projectId: string): Promise<AllocationData> {
  return withMock(
    () => {
      const id = parseInt(projectId, 10);
      const project = MOCK_PROJECTS.find((p) => p.id === id);
      return { ...MOCK_ALLOCATION, project_id: id, project_name: project?.name ?? MOCK_ALLOCATION.project_name };
    },
    () => apiClient<AllocationData>(`/api/projects/${projectId}/allocation`),
  );
}

export function fetchResources(): Promise<Resource[]> {
  return withMock(
    () => MOCK_ALLOCATION.all_resources,
    () => apiClient<Resource[]>('/api/resources'),
  );
}

export async function saveAllocationPhase(
  projectId: string,
  phaseId: number,
  allocations: { resource_id: number; week_start: string; fte: number }[]
): Promise<void> {
  await withMock(
    () => undefined,
    () => apiClient(`/api/projects/${projectId}/allocation`, {
      method: 'PUT',
      body: JSON.stringify({ phase_id: phaseId, allocations }),
    }),
  );
}

export function fetchFTEWarnings(
  projectId: string,
  resourceId: number,
  weekStart: string
): Promise<{ isValid: boolean; warnings: { projectId: number; week_start: string; excess: number }[] }> {
  return withMock(
    () => {
      // Simulate overallocation for Vishal in week 2026-06-01
      if (resourceId === 2 && weekStart === '2026-06-01') {
        return { isValid: false, warnings: [{ projectId: 1, week_start: '2026-06-01', excess: 0.3 }] };
      }
      return { isValid: true, warnings: [] };
    },
    () => apiClient(`/api/projects/${projectId}/allocation/warnings?resource_id=${resourceId}&week_start=${weekStart}`),
  );
}

export function createResource(data: Omit<Resource, 'id'>): Promise<Resource> {
  return withMock(
    () => ({ ...data, id: Math.floor(Math.random() * 1000) + 10 }),
    () => apiClient<Resource>('/api/resources', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  );
}

export async function deleteResource(id: number): Promise<void> {
  await withMock(
    () => undefined,
    () => apiClient(`/api/resources/${id}`, { method: 'DELETE' }),
  );
}

export function fetchResourceRegistry(): Promise<ResourceRegistryData> {
  return withMock(
    () => MOCK_RESOURCE_REGISTRY,
    () => apiClient<ResourceRegistryData>('/api/resources/registry'),
  );
}
