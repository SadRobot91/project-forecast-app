import { apiClient } from './client';
import type { OngoingData, OngoingPayload, OngoingSnapshot } from '../types';
import { MOCK_ONGOING, MOCK_ONGOING_HISTORY, MOCK_ONGOING_SNAPSHOT } from '../mocks/mockData';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export async function fetchOngoing(projectId: string): Promise<OngoingData> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return MOCK_ONGOING;
  }
  return apiClient<OngoingData>(`/api/projects/${projectId}/ongoing`);
}

export async function fetchOngoingHistory(projectId: string): Promise<OngoingSnapshot[]> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 200));
    return MOCK_ONGOING_HISTORY;
  }
  return apiClient<OngoingSnapshot[]>(`/api/projects/${projectId}/ongoing/history`);
}

export async function saveOngoing(projectId: string, payload: OngoingPayload): Promise<OngoingSnapshot> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    const saved: OngoingSnapshot = {
      ...MOCK_ONGOING_SNAPSHOT,
      ...payload,
      id: Date.now(),
      project_id: parseInt(projectId, 10),
      source: 'manual',
      created_at: new Date().toISOString(),
    };
    MOCK_ONGOING_HISTORY.unshift(saved);
    MOCK_ONGOING.snapshot = saved;
    return saved;
  }
  return apiClient<OngoingSnapshot>(`/api/projects/${projectId}/ongoing`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteSnapshot(projectId: string, snapshotId: number): Promise<void> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    const idx = MOCK_ONGOING_HISTORY.findIndex((s) => s.id === snapshotId);
    if (idx !== -1) MOCK_ONGOING_HISTORY.splice(idx, 1);
    if (MOCK_ONGOING.snapshot?.id === snapshotId) {
      MOCK_ONGOING.snapshot = MOCK_ONGOING_HISTORY[0] ?? null;
    }
    return;
  }
  await apiClient<void>(`/api/projects/${projectId}/ongoing/${snapshotId}`, {
    method: 'DELETE',
  });
}

export async function syncKeyedin(projectId: string): Promise<OngoingSnapshot> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 800));
    throw new Error('Keyedin non configurato in questo ambiente.');
  }
  return apiClient<OngoingSnapshot>(`/api/projects/${projectId}/ongoing/sync`, {
    method: 'POST',
  });
}
