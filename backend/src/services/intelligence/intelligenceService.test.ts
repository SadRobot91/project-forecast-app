import { NoOpProvider } from './NoOpProvider';
import { ClaudeProvider } from './ClaudeProvider';

const mockProject = { id: 1, name: 'RXI', description: 'Piattaforma microservizi', tags: ['microservizi'] };

describe('NoOpProvider', () => {
  const provider = new NoOpProvider();

  it('summarizeScopingRisks returns empty string', async () => {
    const result = await provider.summarizeScopingRisks(mockProject, []);
    expect(result).toBe('');
  });

  it('generateRetroQuestions returns empty array', async () => {
    const result = await provider.generateRetroQuestions(mockProject, { slippage_count: 0, unexpected_slippage_count: 0, budget_variance: 0, phases_delayed: 0 });
    expect(result).toEqual([]);
  });
});

describe('ClaudeProvider — cold start guard', () => {
  const provider = new ClaudeProvider('fake-api-key');

  it('summarizeScopingRisks returns empty string when < 3 similar projects', async () => {
    const result = await provider.summarizeScopingRisks(mockProject, [mockProject, mockProject]);
    expect(result).toBe('');
  });

  it('summarizeScopingRisks returns empty string when 0 similar projects', async () => {
    const result = await provider.summarizeScopingRisks(mockProject, []);
    expect(result).toBe('');
  });

  it('generateRetroQuestions returns empty array when no observed issues', async () => {
    const result = await provider.generateRetroQuestions(mockProject, { slippage_count: 0, unexpected_slippage_count: 0, budget_variance: 0, phases_delayed: 0 });
    expect(result).toEqual([]);
  });

  it('returns empty string on API fetch error (fallback)', async () => {
    // Simulate fetch throwing an error
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const result = await provider.summarizeScopingRisks(mockProject, [mockProject, mockProject, mockProject]);
    expect(result).toBe('');
    global.fetch = originalFetch;
  });
});
