interface Props {
  value: number;
  crossProjectTotal: number; // sum across all projects for this resource+month
  onChange: (val: number) => void;
  disabled?: boolean;
}

function getSemaphore(total: number): { icon: string; ring: string; bg: string } {
  if (total === 0)   return { icon: '⚪', ring: 'ring-border',       bg: ''               };
  if (total > 1.0)   return { icon: '🔴', ring: 'ring-rag-red/60',   bg: 'bg-rag-red/10'  };
  if (total < 0.8)   return { icon: '🟡', ring: 'ring-rag-yellow/40', bg: 'bg-rag-yellow/5'};
  return                    { icon: '✅', ring: 'ring-rag-green/40',  bg: 'bg-rag-green/5' };
}

export default function FTECell({ value, crossProjectTotal, onChange, disabled = false }: Props) {
  const { icon, ring, bg } = getSemaphore(crossProjectTotal);
  const isOverallocated = crossProjectTotal > 1.0;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative rounded-lg ring-1 ${ring} ${bg} overflow-hidden`}>
        <input
          type="number"
          min={0}
          max={1}
          step={0.1}
          value={value === 0 ? '' : value}
          placeholder="—"
          disabled={disabled}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (isNaN(v)) { onChange(0); return; }
            onChange(Math.min(1, Math.max(0, v)));
          }}
          className={`w-16 px-2 py-1.5 text-center text-sm font-medium bg-transparent text-text-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
            isOverallocated ? 'text-rag-red' : ''
          }`}
        />
      </div>
      <span className="text-xs" title={`Cross-project total: ${(crossProjectTotal * 100).toFixed(0)}%`}>
        {icon}
      </span>
    </div>
  );
}
