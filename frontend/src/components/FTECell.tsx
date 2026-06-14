import { fteMeta } from '../utils/fteSemaphore';

interface Props {
  value: number;
  crossProjectTotal: number; // sum across all projects for this resource+month
  onChange: (val: number) => void;
  disabled?: boolean;
}

export default function FTECell({ value, crossProjectTotal, onChange, disabled = false }: Props) {
  const { icon, ariaLabel, ring, bg } = fteMeta(crossProjectTotal);
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
      <span
        className="text-xs"
        role="img"
        aria-label={`${ariaLabel} — ${(crossProjectTotal * 100).toFixed(0)}% cross-project`}
        title={`Cross-project total: ${(crossProjectTotal * 100).toFixed(0)}%`}
      >
        {icon}
      </span>
    </div>
  );
}
