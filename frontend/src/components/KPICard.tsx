interface Props {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  danger?: boolean;
  positive?: boolean;
}

export default function KPICard({ label, value, sub, accent, danger, positive }: Props) {
  return (
    <div className={`bg-surface border rounded-2xl px-5 py-4 shadow-card transition-colors ${accent ? 'border-accent/40 hover:border-accent/60' : danger ? 'border-rag-red/30 hover:border-rag-red/50' : 'border-border hover:border-white/10'}`}>
      <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${accent ? 'text-accent' : danger ? 'text-rag-red' : positive ? 'text-rag-green' : 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-text-dim text-xs mt-0.5">{sub}</p>}
    </div>
  );
}
