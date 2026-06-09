import type { EmbeddingProvider } from './EmbeddingProvider';

// Returns a zero vector — used when no embedding API key is configured.
export class NoOpEmbeddingProvider implements EmbeddingProvider {
  async embed(_text: string): Promise<number[]> {
    return new Array(1536).fill(0);
  }
}
