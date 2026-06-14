import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ProjectMemoryTab from './ProjectMemoryTab';

vi.mock('../api/knowledge', () => ({
  getDecisions:     vi.fn(),
  getRisks:         vi.fn(),
  getSlippageEvents: vi.fn(),
  getRetrospectives: vi.fn(),
}));

import * as knowledgeApi from '../api/knowledge';

const mockDecisions = [
  {
    id: 1, project_id: 1, phase_id: null, author_id: null,
    title: 'Decisione Alpha',
    rationale: 'Motivazione A',
    expected_consequence: null,
    decided_at: '2026-01-10T10:00:00Z',
    created_at: '2026-01-10T10:00:00Z',
  },
];

const mockRisks = [
  {
    id: 1, project_id: 1, decision_id: 1,
    decision_title: 'Decisione Alpha',
    category: 'Timeline' as const,
    description: 'Rischio di slittamento',
    identified_at: '2026-01-15T10:00:00Z',
    created_at: '2026-01-15T10:00:00Z',
  },
];

const mockSlippage = [
  {
    id: 1, project_id: 1, phase_id: null,
    expected: false,
    cause: 'Causa imprevista',
    recorded_at: '2026-01-20T10:00:00Z',
    created_at: '2026-01-20T10:00:00Z',
  },
];

const mockRetrospectives = [
  {
    id: 1, project_id: 1, phase_id: null,
    question: 'Cosa ha funzionato?',
    answer: 'Team collaborativo',
    created_at: '2026-01-25T10:00:00Z',
  },
];

describe('ProjectMemoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra una timeline ordinata cronologicamente con tutti gli item', async () => {
    vi.mocked(knowledgeApi.getDecisions).mockResolvedValue(mockDecisions);
    vi.mocked(knowledgeApi.getRisks).mockResolvedValue(mockRisks);
    vi.mocked(knowledgeApi.getSlippageEvents).mockResolvedValue(mockSlippage);
    vi.mocked(knowledgeApi.getRetrospectives).mockResolvedValue(mockRetrospectives);

    render(<ProjectMemoryTab projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Decisione Alpha')).toBeInTheDocument();
    });

    expect(screen.getByText('Rischio di slittamento')).toBeInTheDocument();
    expect(screen.getByText('Causa imprevista')).toBeInTheDocument();
    expect(screen.getByText('Team collaborativo')).toBeInTheDocument();

    const allItems = screen.getAllByRole('generic').filter(
      el => el.className?.includes('rounded-xl'),
    );
    expect(allItems.length).toBeGreaterThanOrEqual(4);
  });

  it('mostra il titolo della decisione collegata per un rischio con decision_id', async () => {
    vi.mocked(knowledgeApi.getDecisions).mockResolvedValue(mockDecisions);
    vi.mocked(knowledgeApi.getRisks).mockResolvedValue(mockRisks);
    vi.mocked(knowledgeApi.getSlippageEvents).mockResolvedValue([]);
    vi.mocked(knowledgeApi.getRetrospectives).mockResolvedValue([]);

    render(<ProjectMemoryTab projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/Decisione correlata: Decisione Alpha/)).toBeInTheDocument();
    });
  });

  it('mostra stato vuoto quando il KG e vuoto', async () => {
    vi.mocked(knowledgeApi.getDecisions).mockResolvedValue([]);
    vi.mocked(knowledgeApi.getRisks).mockResolvedValue([]);
    vi.mocked(knowledgeApi.getSlippageEvents).mockResolvedValue([]);
    vi.mocked(knowledgeApi.getRetrospectives).mockResolvedValue([]);

    render(<ProjectMemoryTab projectId={1} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Nessun elemento registrato nella memoria del progetto/),
      ).toBeInTheDocument();
    });
  });

  it('mostra messaggio di errore quando la fetch fallisce', async () => {
    vi.mocked(knowledgeApi.getDecisions).mockRejectedValue(new Error('Network error'));
    vi.mocked(knowledgeApi.getRisks).mockResolvedValue([]);
    vi.mocked(knowledgeApi.getSlippageEvents).mockResolvedValue([]);
    vi.mocked(knowledgeApi.getRetrospectives).mockResolvedValue([]);

    render(<ProjectMemoryTab projectId={1} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Impossibile caricare la memoria del progetto/),
      ).toBeInTheDocument();
    });
  });
});
