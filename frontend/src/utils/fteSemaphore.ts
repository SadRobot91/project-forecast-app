// Logica del semaforo FTE — unica fonte (prima duplicata in FTECell e Resources
// con codice diverso, a rischio di divergenza al primo ritocco).

export type FTELevel = 'empty' | 'under' | 'optimal' | 'over';

export function fteLevel(total: number): FTELevel {
  if (total === 0) return 'empty';
  if (total > 1.0) return 'over';
  if (total < 0.8) return 'under';
  return 'optimal';
}

interface FTELevelMeta {
  icon: string;
  ariaLabel: string;
  textClass: string;
  ring: string;
  bg: string;
}

export const FTE_LEVEL_META: Record<FTELevel, FTELevelMeta> = {
  empty:   { icon: '⚪', ariaLabel: 'Non allocato',     textClass: 'text-text-dim',            ring: 'ring-border',        bg: '' },
  under:   { icon: '🟡', ariaLabel: 'Sottoutilizzo',    textClass: 'text-rag-yellow',          ring: 'ring-rag-yellow/40', bg: 'bg-rag-yellow/5' },
  optimal: { icon: '✅', ariaLabel: 'Allocazione ottimale', textClass: 'text-rag-green',       ring: 'ring-rag-green/40',  bg: 'bg-rag-green/5' },
  over:    { icon: '🔴', ariaLabel: 'Sovrallocazione',  textClass: 'text-rag-red font-bold',   ring: 'ring-rag-red/60',    bg: 'bg-rag-red/10' },
};

export function fteMeta(total: number): FTELevelMeta {
  return FTE_LEVEL_META[fteLevel(total)];
}
