export interface ProjectKGContext {
  id: number;
  name: string;
  description: string | null;
  tags: string[];
}

export interface RetroContext {
  slippage_count: number;
  unexpected_slippage_count: number;
  budget_variance: number;
  phases_delayed: number;
}

export interface IntelligenceProvider {
  summarizeScopingRisks(project: ProjectKGContext, similarHistory: ProjectKGContext[]): Promise<string>;
  generateRetroQuestions(project: ProjectKGContext, observedData: RetroContext): Promise<string[]>;
}
