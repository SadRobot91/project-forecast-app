import { apiClient } from './client';
import { withMock } from './mock';
import type { OngoingData, OngoingPayload, OngoingSnapshot } from '../types';
import { MOCK_ONGOING, MOCK_ONGOING_HISTORY, MOCK_ONGOING_SNAPSHOT } from '../mocks/mockData';

export function fetchOngoing(projectId: string, phaseId?: number | null): Promise<OngoingData> {
  return withMock(
    () => MOCK_ONGOING,
    () => {
      const qs = phaseId !== undefined ? `?phase_id=${phaseId ?? ''}` : '';
      return apiClient<OngoingData>(`/api/projects/${projectId}/ongoing${qs}`);
    },
  );
}

export function fetchOngoingHistory(projectId: string, phaseId?: number | null): Promise<OngoingSnapshot[]> {
  return withMock(
    () => MOCK_ONGOING_HISTORY,
    () => {
      const qs = phaseId !== undefined ? `?phase_id=${phaseId ?? ''}` : '';
      return apiClient<OngoingSnapshot[]>(`/api/projects/${projectId}/ongoing/history${qs}`);
    },
  );
}

export function saveOngoing(projectId: string, payload: OngoingPayload): Promise<OngoingSnapshot> {
  return withMock(
    () => {
      const saved: OngoingSnapshot = {
        ...MOCK_ONGOING_SNAPSHOT,
        ...payload,
        phase_id: payload.phase_id ?? null,
        id: Date.now(),
        project_id: parseInt(projectId, 10),
        source: 'manual',
        created_at: new Date().toISOString(),
      };
      MOCK_ONGOING_HISTORY.unshift(saved);
      MOCK_ONGOING.snapshot = saved;
      return saved;
    },
    () => apiClient<OngoingSnapshot>(`/api/projects/${projectId}/ongoing`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  );
}

export async function deleteSnapshot(projectId: string, snapshotId: number): Promise<void> {
  await withMock(
    () => {
      const idx = MOCK_ONGOING_HISTORY.findIndex((s) => s.id === snapshotId);
      if (idx !== -1) MOCK_ONGOING_HISTORY.splice(idx, 1);
      if (MOCK_ONGOING.snapshot?.id === snapshotId) {
        MOCK_ONGOING.snapshot = MOCK_ONGOING_HISTORY[0] ?? null;
      }
    },
    () => apiClient<void>(`/api/projects/${projectId}/ongoing/${snapshotId}`, {
      method: 'DELETE',
    }),
  );
}

export function syncKeyedin(projectId: string): Promise<OngoingSnapshot> {
  return withMock(
    () => { throw new Error('Keyedin non configurato in questo ambiente.'); },
    () => apiClient<OngoingSnapshot>(`/api/projects/${projectId}/ongoing/sync`, {
      method: 'POST',
    }),
  );
}
