import { apiClient } from './client';
import { withMock } from './mock';
import type { PhaseTemplate } from '../types';

const MOCK_TEMPLATES: PhaseTemplate[] = [
  { id: 1, name: 'feasibility',     display_name: 'Feasibility',       order: 1, default_contingency_pct: 10, active: true },
  { id: 2, name: 'planning_design', display_name: 'Planning & Design', order: 2, default_contingency_pct: 0,  active: true },
  { id: 3, name: 'build',           display_name: 'Build',             order: 3, default_contingency_pct: 0,  active: true },
  { id: 4, name: 'deployment',      display_name: 'Deployment',        order: 4, default_contingency_pct: 0,  active: true },
  { id: 5, name: 'closure',         display_name: 'Closure',           order: 5, default_contingency_pct: 0,  active: true },
];

export function fetchPhaseTemplates(): Promise<PhaseTemplate[]> {
  return withMock(
    () => [...MOCK_TEMPLATES],
    () => apiClient<PhaseTemplate[]>('/api/phase-templates'),
  );
}

export function updatePhaseTemplate(
  id: number,
  patch: Partial<Pick<PhaseTemplate, 'display_name' | 'order' | 'default_contingency_pct' | 'active'>>,
): Promise<PhaseTemplate> {
  return withMock(
    () => {
      const t = MOCK_TEMPLATES.find((x) => x.id === id);
      if (!t) throw new Error('Not found');
      Object.assign(t, patch);
      return { ...t };
    },
    () => apiClient<PhaseTemplate>(`/api/phase-templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  );
}

export function createPhaseTemplate(
  display_name: string,
  order: number,
  default_contingency_pct = 0,
): Promise<PhaseTemplate> {
  return withMock(
    () => {
      if (MOCK_TEMPLATES.some((t) => t.display_name.toLowerCase() === display_name.trim().toLowerCase())) {
        throw new Error(`Esiste già una fase con nome "${display_name.trim()}"`);
      }
      const t: PhaseTemplate = {
        id: Date.now(),
        name: `custom_${Date.now()}`,
        display_name,
        order,
        default_contingency_pct,
        active: true,
      };
      MOCK_TEMPLATES.push(t);
      return { ...t };
    },
    () => apiClient<PhaseTemplate>('/api/phase-templates', {
      method: 'POST',
      body: JSON.stringify({ display_name, order, default_contingency_pct }),
    }),
  );
}

export async function deletePhaseTemplate(id: number): Promise<void> {
  await withMock(
    () => {
      const idx = MOCK_TEMPLATES.findIndex((x) => x.id === id);
      if (idx !== -1) MOCK_TEMPLATES.splice(idx, 1);
    },
    () => apiClient(`/api/phase-templates/${id}`, { method: 'DELETE' }),
  );
}
