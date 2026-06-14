import { apiClient } from './client';
import { withMock } from './mock';
import { MOCK_SIMILAR_SEMANTIC, MOCK_SCOPING_INSIGHT, MOCK_RETRO_QUESTIONS } from '../mocks/mockData';
import type { SimilarProject, ScopingInsight, RetroQuestions } from '../types';

export function fetchSimilarSemantic(projectId: number) {
  return withMock(
    () => MOCK_SIMILAR_SEMANTIC,
    () => apiClient<SimilarProject[]>(`/api/projects/${projectId}/similar-semantic`),
  );
}

export function fetchScopingInsight(projectId: number) {
  return withMock(
    () => MOCK_SCOPING_INSIGHT,
    () => apiClient<ScopingInsight>(`/api/projects/${projectId}/scoping-insight`),
  );
}

export function fetchRetroQuestions(projectId: number) {
  return withMock(
    () => MOCK_RETRO_QUESTIONS,
    () => apiClient<RetroQuestions>(`/api/projects/${projectId}/retro-questions`),
  );
}
