import type { IntelligenceProvider, ProjectKGContext, RetroContext } from './IntelligenceProvider';

const COLD_START_THRESHOLD = 3;

export class ClaudeProvider implements IntelligenceProvider {
  private readonly apiKey: string;
  private readonly model = 'claude-haiku-4-5-20251001';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async summarizeScopingRisks(project: ProjectKGContext, similarHistory: ProjectKGContext[]): Promise<string> {
    if (similarHistory.length < COLD_START_THRESHOLD) {
      return '';
    }
    try {
      const prompt = `Sei un advisor di project management. Il PM sta avviando un nuovo progetto.

Progetto corrente:
- Nome: ${project.name}
- Descrizione: ${project.description ?? '(nessuna)'}
- Tag: ${project.tags.join(', ') || '(nessuno)'}

Storico di ${similarHistory.length} progetti simili:
${similarHistory.map((p) => `- ${p.name}: ${p.tags.join(', ')}`).join('\n')}

Elenca 2-3 rischi tipici basati sullo storico. Sii conciso (max 150 parole). Rispondi in italiano.`;

      return await this.callClaude(prompt);
    } catch (err) {
      console.error('ClaudeProvider.summarizeScopingRisks error:', err);
      return '';
    }
  }

  async generateRetroQuestions(project: ProjectKGContext, observedData: RetroContext): Promise<string[]> {
    if (observedData.slippage_count === 0 && observedData.budget_variance === 0) {
      return [];
    }
    try {
      const prompt = `Genera 3 domande di retrospettiva specifiche per questo progetto. Sii concreto.

Dati osservati:
- Slittamenti totali: ${observedData.slippage_count} (di cui inattesi: ${observedData.unexpected_slippage_count})
- Scostamento budget: ${observedData.budget_variance > 0 ? '+' : ''}${Math.round(observedData.budget_variance)}€
- Fasi in ritardo: ${observedData.phases_delayed}

Rispondi con SOLO le 3 domande, una per riga, senza numerazione. In italiano.`;

      const text = await this.callClaude(prompt);
      return text.split('\n').map((q) => q.trim()).filter(Boolean).slice(0, 3);
    } catch (err) {
      console.error('ClaudeProvider.generateRetroQuestions error:', err);
      return [];
    }
  }

  private async callClaude(prompt: string): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status}`);
    }

    const json = (await res.json()) as { content: Array<{ text: string }> };
    return json.content[0]?.text ?? '';
  }
}
