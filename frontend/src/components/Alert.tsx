import type { ReactNode } from 'react';

type AlertTone = 'error' | 'warning' | 'info';

interface AlertProps {
  tone?: AlertTone;
  children: ReactNode;
  className?: string;
}

const TONE_CLS: Record<AlertTone, string> = {
  error:   'bg-rag-red/10 border-rag-red/30 text-rag-red',
  warning: 'bg-rag-yellow/10 border-rag-yellow/30 text-rag-yellow',
  info:    'bg-surface-2 border-border text-text-muted',
};

export default function Alert({ tone = 'error', children, className = '' }: AlertProps) {
  return (
    <div role="alert" className={`border rounded-xl px-5 py-3 text-sm ${TONE_CLS[tone]} ${className}`}>
      {children}
    </div>
  );
}
