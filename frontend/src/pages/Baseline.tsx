import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import AppNav from '../components/AppNav';
import ConfirmModal from '../components/ConfirmModal';
import DateInput from '../components/DateInput';
import { fetchBaseline, saveBaseline, lockBaseline } from '../api/baseline';
import { networkDays } from '../utils/networkDays';
import type { BaselineData } from '../types';

function fmt(n: number) {
  return `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}

interface PhaseState {
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

export default function Baseline() {
  const { id: projectId } = useParams<{ id: string }>();
  const [data, setData]           = useState<BaselineData | null>(null);
  const [phases, setPhases]       = useState<PhaseState[]>([]);
  const [isLocked, setIsLocked]   = useState(false);
  const [lockedAt, setLockedAt]   = useState<string | null>(null);
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockLoading, setLockLoading]     = useState(false);
  const [saveLoading, setSaveLoading]     = useState(false);
  const [saveError, setSaveError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saved, setSaved]         = useState(false);
  // inline rename state: phase_id → editing name value
  const [editingName, setEditingName] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!projectId) return;
    fetchBaseline(projectId).then((d) => {
      setData(d);
      setIsLocked(d.is_locked);
      setLockedAt(d.locked_at);
      const sorted = [...d.phases].sort((a, b) => a.order - b.order);
      setPhases(sorted.map((p) => ({
        phase_id:       p.phase_id,
        phase_type:     p.phase_type,
        display_name:   p.display_name,
        order:          p.order,
        planned_start:  p.planned_start,
        planned_end:    p.planned_end,
        budget:         p.budget,
        contingency_pct: p.contingency_pct,
        status:         p.status,
      })));
    }).finally(() => setLoading(false));
  }, [projectId]);

  const updatePhase = useCallback((idx: number, field: 'planned_start' | 'planned_end', val: string) => {
    setPhases((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  }, []);

  const updateContingency = useCallback((idx: number, val: number) => {
    setPhases((prev) => prev.map((p, i) => i === idx ? { ...p, contingency_pct: val } : p));
  }, []);

  function startEditName(phaseId: number, current: string) {
    setEditingName((prev) => ({ ...prev, [phaseId]: current }));
  }

  function commitName(phaseId: number) {
    const val = editingName[phaseId]?.trim();
    if (val) {
      setPhases((prev) => prev.map((p) => p.phase_id === phaseId ? { ...p, display_name: val } : p));
    }
    setEditingName((prev) => { const next = { ...prev }; delete next[phaseId]; return next; });
  }

  // Derived totals (client-side; exact WD recalculated server-side on save)
  const rows = phases.map((p) => {
    const wd = networkDays(p.planned_start, p.planned_end);
    return { ...p, working_days: wd, planned_hours: wd * 8 };
  });

  const totalBudget   = rows.reduce((s, r) => s + r.budget, 0);
  const totalForecast = rows.reduce((s, r) => s + r.budget + r.budget * (r.contingency_pct / 100), 0);
  const totalWD       = rows.reduce((s, r) => s + r.working_days, 0);
  const totalHours    = rows.reduce((s, r) => s + r.planned_hours, 0);

  async function handleSave() {
    if (!projectId) return;
    const invalid = phases.find((p) => p.planned_end && p.planned_start && p.planned_end < p.planned_start);
    if (invalid) {
      setSaveError(`La data di fine di "${invalid.display_name}" è precedente alla data di inizio.`);
      return;
    }
    setSaveLoading(true);
    setSaveError(null);
    try {
      await saveBaseline(projectId, phases.map((p) => ({
        phase_id:        p.phase_id,
        planned_start:   p.planned_start,
        planned_end:     p.planned_end,
        contingency_pct: p.contingency_pct,
        display_name:    p.display_name,
      })));
      const fresh = await fetchBaseline(projectId);
      setData(fresh);
      setPhases(fresh.phases.sort((a, b) => a.order - b.order).map((p) => ({
        phase_id:        p.phase_id,
        phase_type:      p.phase_type,
        display_name:    p.display_name,
        order:           p.order,
        planned_start:   p.planned_start,
        planned_end:     p.planned_end,
        budget:          p.budget,
        contingency_pct: p.contingency_pct,
        status:          p.status,
      })));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError('Errore durante il salvataggio. Riprova.');
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleLock() {
    if (!projectId) return;
    setLockLoading(true);
    setSaveError(null);
    try {
      const res = await lockBaseline(projectId);
      setIsLocked(true);
      setLockedAt(res.locked_at);
      setShowLockModal(false);
    } catch {
      setSaveError('Errore durante il blocco della baseline. Riprova.');
    } finally {
      setLockLoading(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <p className="text-text-muted animate-pulse">Caricamento baseline…</p>
    </div>
  );

  const inputCls = isLocked
    ? 'bg-base/40 text-text-dim cursor-not-allowed'
    : 'bg-accent/10 border border-accent/30 text-accent focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent';

  return (
    <div className="min-h-screen bg-base text-text-primary">
      <AppNav projectId={projectId} projectName={data?.project_name} />

      {showLockModal && (
        <ConfirmModal
          title="🔒 Blocca Baseline"
          message="Questa azione è IRREVERSIBILE. Una volta bloccata, la baseline non potrà più essere modificata. I dati verranno usati come riferimento permanente per tutti i calcoli di scostamento. Sei sicuro?"
          confirmLabel="Blocca Definitivamente"
          confirmDanger
          loading={lockLoading}
          onConfirm={handleLock}
          onCancel={() => setShowLockModal(false)}
        />
      )}

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Baseline</h1>
            <p className="text-text-muted text-sm mt-1">
              {isLocked
                ? `🔒 Bloccata il ${lockedAt ? new Date(lockedAt).toLocaleDateString('it-IT') : '—'}`
                : 'Imposta date e contingenza per ogni fase. Il nome fase è modificabile inline.'}
            </p>
          </div>
          <div className="flex gap-3">
            {!isLocked && (
              <>
                <button onClick={handleSave} disabled={saveLoading}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-surface border border-border hover:border-accent/50 text-text-primary transition-all disabled:opacity-50">
                  {saveLoading ? 'Salvataggio…' : saved ? '✓ Salvato' : 'Salva'}
                </button>
                <button onClick={() => setShowLockModal(true)}
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
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                {['Fase', 'Inizio', 'Fine', 'GG Lavorativi *', 'Ore Pianificate', 'Budget £', 'Contingenza %'].map((h) => (
                  <th key={h} className="text-left text-text-muted font-medium px-4 py-3 text-xs uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.phase_id} className="border-b border-border/50 hover:bg-surface-2/40 transition-colors">
                  {/* Fase — inline rename */}
                  <td className="px-4 py-3 font-semibold text-text-primary">
                    {isLocked ? (
                      <span>{row.display_name}</span>
                    ) : editingName[row.phase_id] !== undefined ? (
                      <input
                        autoFocus
                        value={editingName[row.phase_id]}
                        onChange={(e) => setEditingName((prev) => ({ ...prev, [row.phase_id]: e.target.value }))}
                        onBlur={() => commitName(row.phase_id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitName(row.phase_id); if (e.key === 'Escape') setEditingName((prev) => { const n = {...prev}; delete n[row.phase_id]; return n; }); }}
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
                      onChange={(val) => updatePhase(idx, 'planned_start', val)}
                      className={`rounded-lg px-2 py-1 text-sm w-36 ${inputCls}`} />
                  </td>
                  <td className="px-4 py-3">
                    <DateInput value={row.planned_end} disabled={isLocked}
                      onChange={(val) => updatePhase(idx, 'planned_end', val)}
                      className={`rounded-lg px-2 py-1 text-sm w-36 ${inputCls}`} />
                  </td>
                  <td className="px-4 py-3 font-medium text-text-primary">{row.working_days}</td>
                  <td className="px-4 py-3 text-text-muted">{row.planned_hours}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {row.budget > 0 ? fmt(row.budget) : (
                      <span className="text-text-dim text-xs">£0 — definito in Allocation</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={0} max={100}
                        value={row.contingency_pct}
                        disabled={isLocked}
                        onChange={(e) => updateContingency(idx, parseFloat(e.target.value) || 0)}
                        className={`rounded-lg px-2 py-1 text-sm w-20 text-center ${inputCls}`}
                      />
                      <span className="text-text-muted">%</span>
                      {row.contingency_pct > 0 && (
                        <span className="text-text-dim text-xs">+{fmt(row.budget * row.contingency_pct / 100)}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-2">
                <td className="px-4 py-3 font-bold text-text-primary">TOTALE</td>
                <td colSpan={2} className="px-4 py-3" />
                <td className="px-4 py-3 font-bold text-accent">{totalWD}</td>
                <td className="px-4 py-3 font-bold text-accent">{totalHours}</td>
                <td className="px-4 py-3 font-bold text-accent">{fmt(totalBudget)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-text-dim text-xs -mt-2">* I GG mostrati escludono le festività. Il valore definitivo (con festività IT) viene calcolato al salvataggio.</p>

        {/* Forecast summary */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-surface border border-border rounded-2xl px-5 py-4 shadow-card">
            <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-1">Budget Totale</p>
            <p className="text-xl font-bold text-text-primary">{fmt(totalBudget)}</p>
          </div>
          <div className="bg-surface border border-accent/30 rounded-2xl px-5 py-4 shadow-glow-accent">
            <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-1">BASELINE TOTAL FORECAST</p>
            <p className="text-2xl font-bold text-accent">{fmt(totalForecast)}</p>
            {totalForecast > totalBudget && (
              <p className="text-text-dim text-xs mt-1">+{fmt(totalForecast - totalBudget)} contingenza totale</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
