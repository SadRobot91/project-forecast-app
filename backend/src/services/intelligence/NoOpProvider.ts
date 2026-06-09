import type { IntelligenceProvider, ProjectKGContext, RetroContext } from './IntelligenceProvider';

export class NoOpProvider implements IntelligenceProvider {
  async summarizeScopingRisks(_project: ProjectKGContext, _similarHistory: ProjectKGContext[]): Promise<string> {
    return '';
  }

  async generateRetroQuestions(_project: ProjectKGContext, _observedData: RetroContext): Promise<string[]> {
    return [];
  }
}
