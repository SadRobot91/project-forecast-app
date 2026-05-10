import type { RAGStatus } from '../types';

interface Props {
  status: RAGStatus;
  size?: 'sm' | 'md';
}

const config: Record<RAGStatus, { label: string; classes: string }> = {
  IN_LINEA:     { label: '✅ In Linea',     classes: 'bg-rag-green/15 text-rag-green border-rag-green/30' },
  A_RISCHIO:    { label: '⚠️ A Rischio',    classes: 'bg-rag-yellow/15 text-rag-yellow border-rag-yellow/30' },
  FUORI_BUDGET: { label: '🔴 Fuori Budget', classes: 'bg-rag-red/15 text-rag-red border-rag-red/30' },
};

export default function RAGBadge({ status, size = 'sm' }: Props) {
  const { label, classes } = config[status];
  const sizeClass = size === 'sm' ? 'text-xs px-2.5 py-1' : 'text-sm px-3 py-1.5';
  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${classes} ${sizeClass}`}>
      {label}
    </span>
  );
}
