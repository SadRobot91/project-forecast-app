import { apiClient } from './client';
import { withMock } from './mock';
import {
  MOCK_DECISIONS, MOCK_RISKS, MOCK_SLIPPAGE, MOCK_RETROSPECTIVES, MOCK_SIMILAR_PROJECTS,
} from '../mocks/mockData';
import type { Decision, Risk, SlippageEvent, Retrospective, SimilarProject } from '../types';

export function patchProjectScoping(id: number, body: { description?: string; tags?: string[] }) {
  return apiClient<{ id: number; name: string; description: string | null; tags: string[] }>(
    `/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }
  );
}

export function postDecision(projectId: number, body: Partial<Decision> & { title: string }) {
  return apiClient<Decision>(`/api/projects/${projectId}/decisions`, { method: 'POST', body: JSON.stringify(body) });
}

export function getDecisions(projectId: number) {
  return withMock(
    () => MOCK_DECISIONS.filter(d => d.project_id === projectId),
    () => apiClient<Decision[]>(`/api/projects/${projectId}/decisions`),
  );
}

export function postRisk(projectId: number, body: Partial<Risk> & { description: string }) {
  return apiClient<Risk>(`/api/projects/${projectId}/risks`, { method: 'POST', body: JSON.stringify(body) });
}

export function getRisks(projectId: number) {
  return withMock(
    () => MOCK_RISKS.filter(r => r.project_id === projectId),
    () => apiClient<Risk[]>(`/api/projects/${projectId}/risks`),
  );
}

export function postSlippage(projectId: number, body: { expected: boolean; cause?: string; phase_id?: number }) {
  return apiClient<SlippageEvent>(`/api/projects/${projectId}/slippage`, { method: 'POST', body: JSON.stringify(body) });
}

export function getSlippageEvents(projectId: number) {
  return withMock(
    () => MOCK_SLIPPAGE.filter(s => s.project_id === projectId),
    () => apiClient<SlippageEvent[]>(`/api/projects/${projectId}/slippage`),
  );
}

export function postRetrospective(projectId: number, body: { answer: string; question?: string; phase_id?: number }) {
  return apiClient<Retrospective>(`/api/projects/${projectId}/retrospectives`, { method: 'POST', body: JSON.stringify(body) });
}

export function getRetrospectives(projectId: number) {
  return withMock(
    () => MOCK_RETROSPECTIVES.filter(r => r.project_id === projectId),
    () => apiClient<Retrospective[]>(`/api/projects/${projectId}/retrospectives`),
  );
}

export function fetchSimilarProjects(tags: string[], excludeId: number) {
  const params = new URLSearchParams();
  tags.forEach(t => params.append('tags[]', t));
  params.append('exclude_id', String(excludeId));
  return withMock(
    () => MOCK_SIMILAR_PROJECTS,
    () => apiClient<SimilarProject[]>(`/api/projects/similar?${params}`),
  );
}
