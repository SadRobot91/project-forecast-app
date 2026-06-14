import DateInput from '../../components/DateInput';
import type { OngoingPhaseOption } from '../../types';

export interface SnapshotFormState {
  reporting_date: string;
  cost_spent_to_date: string;
  hours_spent_to_date: string;
  working_days_used: string;
  working_days_remaining: string;
}

const HOURS_PER_DAY = 8;

function deriveWorkingDays(
  hoursStr: string,
  totalWD: number,
): { working_days_used: string; working_days_remaining: string } {
  const hours = parseFloat(hoursStr);
  if (isNaN(hours) || hours < 0) return { working_days_used: '', working_days_remaining: '' };
  const used = Math.round(hours / HOURS_PER_DAY);
  const remaining = Math.max(0, totalWD - used);
  return { working_days_used: String(used), working_days_remaining: String(remaining) };
}

interface SnapshotFormProps {
  form: SnapshotFormState;
  phases: OngoingPhaseOption[];
  selectedPhaseId: number | null;
  totalWD: number;
  saving: boolean;
  saved: boolean;
  onSelectPhase: (id: number | null) => void;
  onChange: (patch: Partial<SnapshotFormState>) => void;
  onSave: () => void;
}

export default function SnapshotForm({
  form, phases, selectedPhaseId, totalWD, saving, saved, onSelectPhase, onChange, onSave,
}: SnapshotFormProps) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-card space-y-4">
      <h2 className="font-semibold text-text-primary">Inserisci Snapshot Manuale</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs text-text-muted mb-1">Riferito a</label>
          <select
            value={selectedPhaseId ?? ''}
            onChange={(e) => {
              const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
              onSelectPhase(val);
            }}
            className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          >
            {phases.map((p) => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-text-muted mb-1">Data di riferimento *</label>
          <DateInput
            value={form.reporting_date}
            onChange={(val) => onChange({ reporting_date: val })}
            className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Costo speso £ *</label>
          <input
            type="number"
            min={0}
            placeholder="es. 36200"
            value={form.cost_spent_to_date}
            onChange={(e) => onChange({ cost_spent_to_date: e.target.value })}
            className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Ore spese *</label>
          <input
            type="number"
            min={0}
            placeholder="es. 320"
            value={form.hours_spent_to_date}
            onChange={(e) => {
              const hours = e.target.value;
              const derived = deriveWorkingDays(hours, totalWD);
              onChange({ hours_spent_to_date: hours, ...derived });
            }}
            className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">
            GG lavorativi usati
            <span className="ml-1 text-text-muted text-[10px] normal-case">auto</span>
          </label>
          <input
            type="number"
            min={0}
            placeholder="es. 58"
            value={form.working_days_used}
            onChange={(e) => {
              const used = e.target.value;
              const usedNum = parseFloat(used);
              const remaining = isNaN(usedNum) ? '' : String(Math.max(0, totalWD - usedNum));
              onChange({ working_days_used: used, working_days_remaining: remaining });
            }}
            className="w-full bg-base border border-accent/20 text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">
            GG lavorativi rimanenti
            <span className="ml-1 text-text-muted text-[10px] normal-case">auto</span>
          </label>
          <input
            type="number"
            min={0}
            placeholder="es. 83"
            value={form.working_days_remaining}
            onChange={(e) => onChange({ working_days_remaining: e.target.value })}
            className="w-full bg-base border border-accent/20 text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <button
        onClick={onSave}
        disabled={saving}
        className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-accent hover:bg-accent/90 disabled:opacity-50 text-white transition-all"
      >
        {saving ? 'Salvataggio…' : saved ? '✓ Salvato' : 'Salva Snapshot'}
      </button>
    </div>
  );
}
