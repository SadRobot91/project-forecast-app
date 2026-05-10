interface Props {
  pct: number; // 0-100+
}

export default function BudgetBar({ pct }: Props) {
  const clamped = Math.min(pct, 100);
  const color =
    pct > 115 ? 'bg-rag-red' :
    pct > 105 ? 'bg-rag-yellow' :
    'bg-rag-green';

  return (
    <div className="w-full h-2 bg-base rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
