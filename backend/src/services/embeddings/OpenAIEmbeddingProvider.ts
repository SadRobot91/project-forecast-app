import type { EmbeddingProvider } from './EmbeddingProvider';

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private readonly apiKey: string;
  private readonly model = 'text-embedding-ada-002';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: text }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI Embeddings API error: ${res.status}`);
    }

    const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return json.data[0].embedding;
  }
}
