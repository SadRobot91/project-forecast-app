import { NoOpEmbeddingProvider } from './NoOpEmbeddingProvider';
import { upsertProjectEmbedding } from './embeddingService';

describe('NoOpEmbeddingProvider', () => {
  it('returns array of 1536 zeros', async () => {
    const provider = new NoOpEmbeddingProvider();
    const result = await provider.embed('qualsiasi testo');
    expect(result).toHaveLength(1536);
    expect(result.every((v) => v === 0)).toBe(true);
  });
});

describe('upsertProjectEmbedding', () => {
  it('skips embedding when description is too short', async () => {
    // description <= 20 chars → returns without calling DB or provider
    await expect(upsertProjectEmbedding(1, 'corto')).resolves.toBeUndefined();
  });
});
