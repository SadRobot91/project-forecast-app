import { apiClient } from './client';
import type { PhaseTemplate } from '../types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

const MOCK_TEMPLATES: PhaseTemplate[] = [
  { id: 1, name: 'feasibility',     display_name: 'Feasibility',       order: 1, default_contingency_pct: 10, active: true },
  { id: 2, name: 'planning_design', display_name: 'Planning & Design', order: 2, default_contingency_pct: 0,  active: true },
  { id: 3, name: 'build',           display_name: 'Build',             order: 3, default_contingency_pct: 0,  active: true },
  { id: 4, name: 'deployment',      display_name: 'Deployment',        order: 4, default_contingency_pct: 0,  active: true },
  { id: 5, name: 'closure',         display_name: 'Closure',           order: 5, default_contingency_pct: 0,  active: true },
];

export async function fetchPhaseTemplates(): Promise<PhaseTemplate[]> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 200));
    return [...MOCK_TEMPLATES];
  }
  return apiClient<PhaseTemplate[]>('/api/phase-templates');
}

export async function updatePhaseTemplate(
  id: number,
  patch: Partial<Pick<PhaseTemplate, 'display_name' | 'order' | 'default_contingency_pct' | 'active'>>,
): Promise<PhaseTemplate> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 200));
    const t = MOCK_TEMPLATES.find((x) => x.id === id);
    if (!t) throw new Error('Not found');
    Object.assign(t, patch);
    return { ...t };
  }
  return apiClient<PhaseTemplate>(`/api/phase-templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function createPhaseTemplate(
  display_name: string,
  order: number,
): Promise<PhaseTemplate> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    const t: PhaseTemplate = {
      id: Date.now(),
      name: `custom_${Date.now()}`,
      display_name,
      order,
      default_contingency_pct: 0,
      active: true,
    };
    MOCK_TEMPLATES.push(t);
    return { ...t };
  }
  return apiClient<PhaseTemplate>('/api/phase-templates', {
    method: 'POST',
    body: JSON.stringify({ display_name, order }),
  });
}

export async function deletePhaseTemplate(id: number): Promise<void> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 200));
    const idx = MOCK_TEMPLATES.findIndex((x) => x.id === id);
    if (idx !== -1) MOCK_TEMPLATES.splice(idx, 1);
    return;
  }
  await apiClient(`/api/phase-templates/${id}`, { method: 'DELETE' });
}
