import { NoOpEmbeddingProvider } from './NoOpEmbeddingProvider';
import { OpenAIEmbeddingProvider } from './OpenAIEmbeddingProvider';
import type { EmbeddingProvider } from './EmbeddingProvider';
import { query } from '../../db';

export function getEmbeddingProvider(): EmbeddingProvider {
  const apiKey = process.env.EMBEDDING_API_KEY;
  if (apiKey) {
    return new OpenAIEmbeddingProvider(apiKey);
  }
  return new NoOpEmbeddingProvider();
}

export async function upsertProjectEmbedding(projectId: number, description: string): Promise<void> {
  if (!description || description.trim().length <= 20) return;
  if (!process.env.EMBEDDING_API_KEY) return;
  const provider = getEmbeddingProvider();
  const embedding = await provider.embed(description);
  await query(
    `UPDATE "Project" SET description_embedding = $1 WHERE id = $2`,
    [`[${embedding.join(',')}]`, projectId]
  );
}
