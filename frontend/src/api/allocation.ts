import { apiClient } from './client';
import type { AllocationData, Resource, ResourceRegistryData } from '../types';
import { MOCK_ALLOCATION, MOCK_RESOURCE_REGISTRY, MOCK_PROJECTS } from '../mocks/mockData';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export async function fetchAllocation(projectId: string): Promise<AllocationData> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    const id = parseInt(projectId, 10);
    const project = MOCK_PROJECTS.find((p) => p.id === id);
    return { ...MOCK_ALLOCATION, project_id: id, project_name: project?.name ?? MOCK_ALLOCATION.project_name };
  }
  return apiClient<AllocationData>(`/api/projects/${projectId}/allocation`);
}

export async function fetchResources(): Promise<Resource[]> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 200));
    return MOCK_ALLOCATION.all_resources;
  }
  return apiClient<Resource[]>('/api/resources');
}

export async function saveAllocationPhase(
  projectId: string,
  phaseId: number,
  allocations: { resource_id: number; week_start: string; fte: number }[]
): Promise<void> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 500));
    return;
  }
  await apiClient(`/api/projects/${projectId}/allocation`, {
    method: 'PUT',
    body: JSON.stringify({ phase_id: phaseId, allocations }),
  });
}

export async function fetchFTEWarnings(
  projectId: string,
  resourceId: number,
  weekStart: string
): Promise<{ isValid: boolean; warnings: { projectId: number; week_start: string; excess: number }[] }> {
  if (USE_MOCK) {
    // Simulate overallocation for Vishal in week 2026-06-01
    if (resourceId === 2 && weekStart === '2026-06-01') {
      return { isValid: false, warnings: [{ projectId: 1, week_start: '2026-06-01', excess: 0.3 }] };
    }
    return { isValid: true, warnings: [] };
  }
  return apiClient(`/api/projects/${projectId}/allocation/warnings?resource_id=${resourceId}&week_start=${weekStart}`);
}

export async function createResource(data: Omit<Resource, 'id'>): Promise<Resource> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return { ...data, id: Math.floor(Math.random() * 1000) + 10 };
  }
  return apiClient<Resource>('/api/resources', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteResource(id: number): Promise<void> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return;
  }
  await apiClient(`/api/resources/${id}`, { method: 'DELETE' });
}

export async function fetchResourceRegistry(): Promise<ResourceRegistryData> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    return MOCK_RESOURCE_REGISTRY;
  }
  return apiClient<ResourceRegistryData>('/api/resources/registry');
}
