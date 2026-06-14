import { memo, useState } from 'react';
import DateInput from '../../components/DateInput';
import { networkDays } from '../../utils/networkDays';
import { formatCurrency } from '../../utils/formatCurrency';

export interface PhaseState {
  phase_id: number;
  phase_type: string;
  display_name: string;
  order: number;
  planned_start: string;
  planned_end: string;
  budget: number;
  contingency_pct: number;
  status: string;
}

interface FasiTabProps {
  phases: PhaseState[];
  isLocked: boolean;
  lockedAt: string | null;
  saveLoading: boolean;
  saveError: string | null;
  saved: boolean;
  onUpdatePhase: (idx: number, field: 'planned_start' | 'planned_end', val: string) => void;
  onUpdateContingency: (idx: number, val: number) => void;
  onUpdateName: (phaseId: number, val: string) => void;
  onSave: () => void;
  onShowLockModal: () => void;
  onRegisterSlippage: (phase: { id: number; name: string }) => void;
}

function FasiTab({
  phases, isLocked, lockedAt, saveLoading, saveError, saved,
  onUpdatePhase, onUpdateContingency, onUpdateName, onSave, onShowLockModal, onRegisterSlippage,
}: FasiTabProps) {
  const [editingName, setEditingName] = useState<Record<number, string>>({});

  function startEditName(phaseId: number, current: string) {
    setEditingName((prev) => ({ ...prev, [phaseId]: current }));
  }

  function commitName(phaseId: number) {
    const val = editingName[phaseId]?.trim();
    if (val) onUpdateName(phaseId, val);
    setEditingName((prev) => { const next = { ...prev }; delete next[phaseId]; return next; });
  }

  const rows = phases.map((p) => {
    const wd = networkDays(p.planned_start, p.planned_end);
    return { ...p, working_days: wd, planned_hours: wd * 8 };
  });

  const totalBudget   = rows.reduce((s, r) => s + r.budget, 0);
  const totalForecast = rows.reduce((s, r) => s + r.budget + r.budget * (r.contingency_pct / 100), 0);
  const totalWD       = rows.reduce((s, r) => s + r.working_days, 0);
  const totalHours    = rows.reduce((s, r) => s + r.planned_hours, 0);

  const inputCls = isLocked
    ? 'bg-base/40 text-text-dim cursor-not-allowed'
    : 'bg-accent/10 border border-accent/30 text-accent focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent';

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <p className="text-text-muted text-sm">
          {isLocked
            ? `🔒 Bloccata il ${lockedAt ? new Date(lockedAt).toLocaleDateString('it-IT') : '—'}`
            : 'Imposta date e contingenza per ogni fase. Il nome fase è modificabile inline.'}
        </p>
        <div className="flex gap-3">
          {!isLocked && (
            <>
              <button onClick={onSave} disabled={saveLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-surface border border-border hover:border-accent/50 text-text-primary transition-all disabled:opacity-50">
                {saveLoading ? 'Salvataggio…' : saved ? '✓ Salvato' : 'Salva'}
              </button>
              <button onClick={onShowLockModal}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-rag-red/20 border border-rag-red/40 text-rag-red hover:bg-rag-red/30 transition-all">
                🔒 Blocca Baseline
              </button>
            </>
          )}
        </div>
      </div>

      {saveError && (
        <div className="bg-rag-red/10 border border-rag-red/30 rounded-xl px-5 py-3 text-rag-red text-sm">
          {saveError}
        </div>
      )}

      {isLocked && (
        <div className="bg-rag-yellow/10 border border-rag-yellow/30 rounded-xl px-5 py-3 text-rag-yellow text-sm">
          ⚠️ La baseline è bloccata. I dati sono in sola lettura.
        </div>
      )}

      {/* Table */}
      <p className="md:hidden text-xs text-text-dim">↔ Scorri la tabella in orizzontale o usa il desktop per vederla intera.</p>
      <div className="relative rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="sticky left-0 bg-surface-2 z-10 text-left text-text-muted font-medium px-4 py-3 text-xs uppercase tracking-wider whitespace-nowrap">
                  Fase
                </th>
                {['Inizio', 'Fine', 'GG Lavorativi *', 'Ore Pianificate', 'Budget £', 'Contingenza %', ''].map((h) => (
                  <th key={h} className="text-left text-text-muted font-medium px-4 py-3 text-xs uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.phase_id} className="border-b border-border/50 hover:bg-surface-2/40 transition-colors">
                  <td className="sticky left-0 bg-surface z-10 px-4 py-3 font-semibold text-text-primary">
                    {isLocked ? (
                      <span>{row.display_name}</span>
                    ) : editingName[row.phase_id] !== undefined ? (
                      <input
                        autoFocus
                        value={editingName[row.phase_id]}
                        onChange={(e) => setEditingName((prev) => ({ ...prev, [row.phase_id]: e.target.value }))}
                        onBlur={() => commitName(row.phase_id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitName(row.phase_id);
                          if (e.key === 'Escape') setEditingName((prev) => { const n = {...prev}; delete n[row.phase_id]; return n; });
                        }}
                        className="bg-base border border-accent/40 text-text-primary rounded px-2 py-0.5 text-sm w-40 focus:outline-none focus:border-accent"
                      />
                    ) : (
                      <button
                        onClick={() => startEditName(row.phase_id, row.display_name)}
                        className="group flex items-center gap-1.5 hover:text-accent transition-colors"
                        title="Clicca per rinominare"
                      >
                        {row.display_name}
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <DateInput value={row.planned_start} disabled={isLocked}
                      onChange={(val) => onUpdatePhase(idx, 'planned_start', val)}
                      className={`rounded-lg px-2 py-1 text-sm w-36 ${inputCls}`} />
                  </td>
                  <td className="px-4 py-3">
                    <DateInput value={row.planned_end} disabled={isLocked}
                      onChange={(val) => onUpdatePhase(idx, 'planned_end', val)}
                      className={`rounded-lg px-2 py-1 text-sm w-36 ${inputCls}`} />
                  </td>
                  <td className="px-4 py-3 font-medium text-text-primary">{row.working_days}</td>
                  <td className="px-4 py-3 text-text-muted">{row.planned_hours}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {row.budget > 0 ? formatCurrency(row.budget) : (
                      <span className="text-text-dim text-xs">£0 — definito in Risorse</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={0} max={100}
                        value={row.contingency_pct}
                        disabled={isLocked}
                        onChange={(e) => onUpdateContingency(idx, parseFloat(e.target.value) || 0)}
                        className={`rounded-lg px-2 py-1 text-sm w-20 text-center ${inputCls}`}
                      />
                      <span className="text-text-muted">%</span>
                      {row.contingency_pct > 0 && (
                        <span className="text-text-dim text-xs">+{formatCurrency(row.budget * row.contingency_pct / 100)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {row.status === 'in_progress' && (
                      <button
                        onClick={() => onRegisterSlippage({ id: row.phase_id, name: row.display_name })}
                        className="text-xs text-text-dim border border-border rounded px-2 py-1 hover:border-accent/50 hover:text-accent transition-colors whitespace-nowrap"
                      >
                        Registra slittamento
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-2">
                <td className="sticky left-0 bg-surface-2 z-10 px-4 py-3 font-bold text-text-primary">TOTALE</td>
                <td colSpan={2} className="px-4 py-3" />
                <td className="px-4 py-3 font-bold text-accent">{totalWD}</td>
                <td className="px-4 py-3 font-bold text-accent">{totalHours}</td>
                <td className="px-4 py-3 font-bold text-accent">{formatCurrency(totalBudget)}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent" />
      </div>

      <p className="text-text-dim text-xs">* I GG mostrati escludono le festività. Il valore definitivo (con festività IT) viene calcolato al salvataggio.</p>

      {/* Forecast summary */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-2xl px-5 py-4 shadow-card">
          <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-1">Budget Totale</p>
          <p className="text-xl font-bold text-text-primary">{formatCurrency(totalBudget)}</p>
        </div>
        <div className="bg-surface border border-accent/30 rounded-2xl px-5 py-4 shadow-glow-accent">
          <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-1">BASELINE TOTAL FORECAST</p>
          <p className="text-2xl font-bold text-accent">{formatCurrency(totalForecast)}</p>
          {totalForecast > totalBudget && (
            <p className="text-text-dim text-xs mt-1">+{formatCurrency(totalForecast - totalBudget)} contingenza totale</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(FasiTab);
