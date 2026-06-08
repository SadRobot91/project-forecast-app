import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import AppNav from '../components/AppNav';
import ConfirmModal from '../components/ConfirmModal';
import DateInput from '../components/DateInput';
import FTECell from '../components/FTECell';
import { fetchBaseline, saveBaseline, lockBaseline } from '../api/baseline';
import { fetchAllocation, saveAllocationPhase, createResource, fetchResourceRegistry } from '../api/allocation';
import { networkDays, weeksInRange, fmtWeek } from '../utils/networkDays';
import { formatCurrency } from '../utils/formatCurrency';
import type {
  BaselineData,
  AllocationData,
  AllocationPhaseMatrix,
  AllocationCell,
  Resource,
} from '../types';

type Tab = 'fasi' | 'risorse';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ─── Baseline (Fasi & Date) tab ───────────────────────────────────────────

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
}

function FasiTab({
  phases, isLocked, lockedAt, saveLoading, saveError, saved,
  onUpdatePhase, onUpdateContingency, onUpdateName, onSave, onShowLockModal,
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
      <div className="flex items-start justify-between">
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
      <div className="relative rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="sticky left-0 bg-surface-2 z-10 text-left text-text-muted font-medium px-4 py-3 text-xs uppercase tracking-wider whitespace-nowrap">
                  Fase
                </th>
                {['Inizio', 'Fine', 'GG Lavorativi *', 'Ore Pianificate', 'Budget £', 'Contingenza %'].map((h) => (
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

// ─── Allocation (Risorse & Budget) tab ────────────────────────────────────

interface AddResourceModalProps {
  available: Resource[];
  onAdd: (r: Resource) => void;
  onClose: () => void;
  onCreateNew: (name: string, role: string, dayRate: number) => Promise<void>;
}

function AddResourceModal({ available, onAdd, onClose, onCreateNew }: AddResourceModalProps) {
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newRate, setNewRate] = useState('');
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'existing' | 'new'>('existing');

  async function handleCreate() {
    if (!newName || !newRate) return;
    setCreating(true);
    try { await onCreateNew(newName, newRole, parseFloat(newRate)); onClose(); }
    finally { setCreating(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-card p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-bold mb-4">Aggiungi Risorsa</h2>
        <div className="flex gap-2 mb-4">
          {(['existing', 'new'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t ? 'bg-accent/20 text-accent border border-accent/30' : 'text-text-muted hover:bg-surface-2'}`}>
              {t === 'existing' ? 'Dal registro' : 'Nuova risorsa'}
            </button>
          ))}
        </div>
        {tab === 'existing' ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {available.length === 0 && <p className="text-text-muted text-sm">Tutte le risorse sono già allocate in questa fase.</p>}
            {available.map((r) => (
              <button key={r.id} onClick={() => { onAdd(r); onClose(); }}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:border-accent/50 hover:bg-surface-2 transition-all text-left">
                <div>
                  <p className="font-medium text-text-primary text-sm">{r.name}</p>
                  <p className="text-text-dim text-xs">{r.role}</p>
                </div>
                <span className="text-accent text-sm font-medium">{formatCurrency(r.day_rate)}/gg</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <input type="text" placeholder="Nome *" value={newName} onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent" />
            <input type="text" placeholder="Ruolo" value={newRole} onChange={(e) => setNewRole(e.target.value)}
              className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent" />
            <input type="number" placeholder="Day Rate £ *" value={newRate} onChange={(e) => setNewRate(e.target.value)}
              className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent" />
            <button onClick={handleCreate} disabled={creating || !newName || !newRate}
              className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-all">
              {creating ? 'Creazione…' : 'Crea e aggiungi'}
            </button>
          </div>
        )}
        <button onClick={onClose} className="absolute top-4 right-4 text-text-dim hover:text-text-muted text-lg">✕</button>
      </div>
    </div>
  );
}

interface PhaseBlockProps {
  phase: AllocationPhaseMatrix;
  projectId: string;
  allResources: Resource[];
  crossTotals: Record<string, number>;
  isBaselineLocked: boolean;
  onSaved: () => void;
}

function PhaseBlock({ phase, projectId, allResources, crossTotals, isBaselineLocked, onSaved }: PhaseBlockProps) {
  const [open, setOpen] = useState(true);
  const [resources, setResources] = useState<Resource[]>(phase.resources);
  const [cells, setCells] = useState<AllocationCell[]>(phase.cells);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    setCells(phase.cells);
    setResources(phase.resources);
  }, [phase.cells, phase.resources]);

  const weeks = weeksInRange(phase.planned_start, phase.planned_end);

  function getCell(resourceId: number, weekStart: string): AllocationCell | undefined {
    return cells.find((c) => c.resource_id === resourceId && c.week_start === weekStart);
  }

  function getCrossProjectTotal(resourceId: number, weekStart: string): number {
    const registryTotal = crossTotals[`${resourceId}:${weekStart}`] ?? 0;
    const savedFte = phase.cells.find(c => c.resource_id === resourceId && c.week_start === weekStart)?.fte ?? 0;
    const localFte = cells.find(c => c.resource_id === resourceId && c.week_start === weekStart)?.fte ?? 0;
    return Math.max(0, registryTotal - savedFte + localFte);
  }

  function updateCell(resourceId: number, weekStart: string, fte: number) {
    setDirty(true);
    const dayRate = resources.find((r) => r.id === resourceId)?.day_rate ?? 0;
    setCells((prev) => {
      const existing = prev.find((c) => c.resource_id === resourceId && c.week_start === weekStart);
      if (existing) {
        const weekly_cost = dayRate * fte * existing.working_days;
        return prev.map((c) =>
          c.resource_id === resourceId && c.week_start === weekStart ? { ...c, fte, weekly_cost } : c
        );
      }
      const weekly_cost = dayRate * fte * 5;
      return [...prev, { resource_id: resourceId, phase_id: phase.phase_id, week_start: weekStart, fte, working_days: 5, weekly_cost }];
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = cells.filter((c) => c.fte > 0).map((c) => ({
        resource_id: c.resource_id,
        week_start: c.week_start,
        fte: c.fte,
      }));
      await saveAllocationPhase(projectId, phase.phase_id, payload);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  function handleAddResource(r: Resource) {
    if (!resources.find((x) => x.id === r.id)) setResources((prev) => [...prev, r]);
  }

  async function handleCreateNew(name: string, role: string, dayRate: number) {
    const r = await createResource({ name, role, day_rate: dayRate });
    handleAddResource(r);
  }

  function handleRemove(resourceId: number) {
    setResources((prev) => prev.filter((r) => r.id !== resourceId));
    setCells((prev) => prev.filter((c) => c.resource_id !== resourceId));
  }

  const phaseBudget = cells.reduce((s, c) => s + c.weekly_cost, 0);
  const allFTE = cells.map((c) => c.fte).filter((f) => f > 0);
  const avgFTE = allFTE.length > 0 ? allFTE.reduce((s, f) => s + f, 0) / allFTE.length : 0;

  const unavailableIds = new Set(resources.map((r) => r.id));
  const availableToAdd = allResources.filter((r) => !unavailableIds.has(r.id));

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-text-dim text-sm">{open ? '▼' : '▶'}</span>
          <span className="font-semibold text-text-primary">{phase.display_name}</span>
          <span className="text-text-dim text-xs">{fmtDate(phase.planned_start)} → {fmtDate(phase.planned_end)}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span>FTE medio: <strong className="text-text-primary">{avgFTE.toFixed(2)}</strong></span>
          <span>Budget fase: <strong className="text-accent">{formatCurrency(phaseBudget)}</strong></span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="relative overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2">
                    <th className="sticky left-0 bg-surface-2 z-10 text-left px-4 py-2.5 text-xs text-text-muted font-medium uppercase tracking-wider w-40">Risorsa</th>
                    <th className="text-left px-4 py-2.5 text-xs text-text-muted font-medium uppercase tracking-wider w-24">Day Rate</th>
                    {weeks.map((w) => (
                      <th key={w} className="text-center px-3 py-2.5 text-xs text-text-muted font-medium uppercase tracking-wider min-w-[72px]">
                        {fmtWeek(w)}
                      </th>
                    ))}
                    <th className="text-center px-3 py-2.5 text-xs text-text-muted font-medium uppercase tracking-wider">Costo Totale</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r) => {
                    const resourceCost = cells.filter((c) => c.resource_id === r.id).reduce((s, c) => s + c.weekly_cost, 0);
                    return (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-surface-2/40 transition-colors">
                        <td className="sticky left-0 bg-surface z-10 px-4 py-3">
                          <p className="font-medium text-text-primary text-sm">{r.name}</p>
                          <p className="text-text-dim text-xs">{r.role}</p>
                        </td>
                        <td className="px-4 py-3 text-text-muted text-sm">{formatCurrency(r.day_rate)}/gg</td>
                        {weeks.map((w) => {
                          const cell = getCell(r.id, w);
                          const total = getCrossProjectTotal(r.id, w);
                          return (
                            <td key={w} className="px-2 py-2 text-center">
                              <FTECell
                                value={cell?.fte ?? 0}
                                crossProjectTotal={total}
                                onChange={(val) => updateCell(r.id, w, val)}
                              />
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-center font-medium text-text-primary text-sm whitespace-nowrap">
                          {formatCurrency(resourceCost)}
                        </td>
                        <td className="px-2 py-3">
                          <button
                            onClick={() => handleRemove(r.id)}
                            className="text-text-dim hover:text-rag-red transition-colors text-xs"
                            title="Rimuovi risorsa da questa fase"
                          >✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent" />
          </div>

          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <button
              onClick={() => setShowAddModal(true)}
              disabled={isBaselineLocked}
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>＋</span> Aggiungi risorsa
            </button>
            {isBaselineLocked ? (
              <span className="text-xs text-rag-yellow">🔒 Baseline bloccata — allocazioni in sola lettura</span>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 text-white transition-all ${dirty ? 'bg-rag-yellow/80 hover:bg-rag-yellow' : 'bg-accent hover:bg-accent/90'}`}
              >
                {saving ? 'Salvataggio…' : saved ? '✓ Salvato' : dirty ? '● Salva fase' : 'Salva fase'}
              </button>
            )}
          </div>
        </div>
      )}

      {showAddModal && (
        <AddResourceModal
          available={availableToAdd}
          onAdd={handleAddResource}
          onClose={() => setShowAddModal(false)}
          onCreateNew={handleCreateNew}
        />
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function Pianificazione() {
  const { id: projectId } = useParams<{ id: string }>();

  // shared state
  const [projectName, setProjectName] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('fasi');

  // baseline state
  const [, setBaselineData] = useState<BaselineData | null>(null);
  const [phases, setPhases]     = useState<PhaseState[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // allocation state
  const [allocData, setAllocData] = useState<AllocationData | null>(null);
  const [crossTotals, setCrossTotals] = useState<Record<string, number>>({});

  const loadAll = useCallback(() => {
    if (!projectId) return;
    Promise.all([
      fetchBaseline(projectId),
      fetchAllocation(projectId),
    ]).then(([bl, alloc]) => {
      setBaselineData(bl);
      setProjectName(bl.project_name);
      setIsLocked(bl.is_locked);
      setLockedAt(bl.locked_at);
      const sorted = [...bl.phases].sort((a, b) => a.order - b.order);
      setPhases(sorted.map((p) => ({
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
      setAllocData(alloc);
    }).finally(() => setLoading(false));
  }, [projectId]);

  const loadCrossTotals = useCallback(() => {
    fetchResourceRegistry().then((reg) => {
      const map: Record<string, number> = {};
      for (const row of reg.rows) {
        for (const [week, total] of Object.entries(row.totals)) {
          map[`${row.resource.id}:${week}`] = total as number;
        }
      }
      setCrossTotals(map);
    }).catch(() => {});
  }, []);

  const handleAllocationSaved = useCallback(() => {
    loadAll();
    loadCrossTotals();
  }, [loadAll, loadCrossTotals]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadCrossTotals(); }, [loadCrossTotals]);

  const updatePhase = useCallback((idx: number, field: 'planned_start' | 'planned_end', val: string) => {
    setPhases((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  }, []);

  const updateContingency = useCallback((idx: number, val: number) => {
    setPhases((prev) => prev.map((p, i) => i === idx ? { ...p, contingency_pct: val } : p));
  }, []);

  const updateName = useCallback((phaseId: number, val: string) => {
    setPhases((prev) => prev.map((p) => p.phase_id === phaseId ? { ...p, display_name: val } : p));
  }, []);

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
      await loadAll();
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
      <p className="text-text-muted animate-pulse">Caricamento pianificazione…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-base text-text-primary">
      <AppNav projectId={projectId} projectName={projectName} />

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
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pianificazione</h1>
          <p className="text-text-muted text-sm mt-1">
            Definisci le fasi, le date e le risorse del progetto.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {([
            { key: 'fasi',    label: 'Fasi & Date' },
            { key: 'risorse', label: 'Risorse & Budget' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'fasi' ? (
          <FasiTab
            phases={phases}
            isLocked={isLocked}
            lockedAt={lockedAt}
            saveLoading={saveLoading}
            saveError={saveError}
            saved={saved}
            onUpdatePhase={updatePhase}
            onUpdateContingency={updateContingency}
            onUpdateName={updateName}
            onSave={handleSave}
            onShowLockModal={() => setShowLockModal(true)}
          />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-text-muted text-sm">
                Assegna FTE per fase → risorsa → settimana. Il semaforo indica l'utilizzo cross-project.
              </p>
              <div className="flex gap-4 text-xs text-text-muted">
                <span>🔴 Sovrallocazione &gt;1.0 FTE</span>
                <span>🟡 Sottoutilizzo &lt;0.8 FTE</span>
                <span>✅ Ottimale 0.8–1.0 FTE</span>
              </div>
            </div>

            {isLocked && (
              <div className="bg-rag-yellow/10 border border-rag-yellow/30 rounded-xl px-5 py-3 text-rag-yellow text-sm">
                🔒 La baseline è bloccata. Le allocazioni sono in sola lettura.
              </div>
            )}

            {allocData?.phases.map((phase) => (
              <PhaseBlock
                key={phase.phase_id}
                phase={phase}
                projectId={projectId!}
                allResources={allocData.all_resources}
                crossTotals={crossTotals}
                isBaselineLocked={isLocked}
                onSaved={handleAllocationSaved}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
