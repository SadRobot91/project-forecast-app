import { NoOpProvider } from './NoOpProvider';
import { ClaudeProvider } from './ClaudeProvider';
import type { IntelligenceProvider } from './IntelligenceProvider';

export function getIntelligenceProvider(): IntelligenceProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    return new ClaudeProvider(apiKey);
  }
  return new NoOpProvider();
}
