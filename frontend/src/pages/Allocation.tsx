import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import AppNav from '../components/AppNav';
import FTECell from '../components/FTECell';
import { fetchAllocation, saveAllocationPhase, createResource, fetchResourceRegistry } from '../api/allocation';
import { fetchBaseline } from '../api/baseline';
import { weeksInRange, fmtWeek } from '../utils/networkDays';
import type { AllocationData, AllocationPhaseMatrix, AllocationCell, Resource } from '../types';

function fmt(n: number) {
  return `£${Math.round(n).toLocaleString('en-GB')}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

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
                <span className="text-accent text-sm font-medium">{fmt(r.day_rate)}/gg</span>
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
  const [showAddModal, setShowAddModal] = useState(false);

  // BUG-06: sync local state when fresh data arrives from backend after save + reload
  useEffect(() => {
    setCells(phase.cells);
    setResources(phase.resources);
  }, [phase.cells, phase.resources]);

  const weeks = weeksInRange(phase.planned_start, phase.planned_end);

  function getCell(resourceId: number, weekStart: string): AllocationCell | undefined {
    return cells.find((c) => c.resource_id === resourceId && c.week_start === weekStart);
  }

  // BUG-04: real cross-project total from registry, adjusted for unsaved local edits
  function getCrossProjectTotal(resourceId: number, weekStart: string): number {
    const registryTotal = crossTotals[`${resourceId}:${weekStart}`] ?? 0;
    const savedFte = phase.cells.find(c => c.resource_id === resourceId && c.week_start === weekStart)?.fte ?? 0;
    const localFte = cells.find(c => c.resource_id === resourceId && c.week_start === weekStart)?.fte ?? 0;
    return Math.max(0, registryTotal - savedFte + localFte);
  }

  function updateCell(resourceId: number, weekStart: string, fte: number) {
    const dayRate = resources.find((r) => r.id === resourceId)?.day_rate ?? 0;
    setCells((prev) => {
      const existing = prev.find((c) => c.resource_id === resourceId && c.week_start === weekStart);
      if (existing) {
        const weekly_cost = dayRate * fte * existing.working_days;
        return prev.map((c) =>
          c.resource_id === resourceId && c.week_start === weekStart ? { ...c, fte, weekly_cost } : c
        );
      }
      // New cell: assume 5 working days — server will recalculate the exact value on save
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

  // Phase totals
  const phaseBudget = cells.reduce((s, c) => s + c.weekly_cost, 0);
  const allFTE = cells.map((c) => c.fte).filter((f) => f > 0);
  const avgFTE = allFTE.length > 0 ? allFTE.reduce((s, f) => s + f, 0) / allFTE.length : 0;

  const unavailableIds = new Set(resources.map((r) => r.id));
  const availableToAdd = allResources.filter((r) => !unavailableIds.has(r.id));

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-card">
      {/* Phase header */}
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
          <span>Budget fase: <strong className="text-accent">{fmt(phaseBudget)}</strong></span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="text-left px-4 py-2.5 text-xs text-text-muted font-medium uppercase tracking-wider w-40">Risorsa</th>
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
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary text-sm">{r.name}</p>
                        <p className="text-text-dim text-xs">{r.role}</p>
                      </td>
                      <td className="px-4 py-3 text-text-muted text-sm">{fmt(r.day_rate)}/gg</td>
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
                        {fmt(resourceCost)}
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

          {/* Phase footer actions */}
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
                className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-accent hover:bg-accent/90 disabled:opacity-50 text-white transition-all"
              >
                {saving ? 'Salvataggio…' : saved ? '✓ Salvato' : 'Salva fase'}
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

export default function Allocation() {
  const { id: projectId } = useParams<{ id: string }>();
  const [data, setData] = useState<AllocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [crossTotals, setCrossTotals] = useState<Record<string, number>>({});
  const [isBaselineLocked, setIsBaselineLocked] = useState(false);

  const load = useCallback(() => {
    if (!projectId) return;
    Promise.all([
      fetchAllocation(projectId),
      fetchBaseline(projectId),
    ]).then(([alloc, baseline]) => {
      setData(alloc);
      setIsBaselineLocked(baseline.is_locked);
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

  const handleSaved = useCallback(() => {
    load();
    loadCrossTotals();
  }, [load, loadCrossTotals]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCrossTotals(); }, [loadCrossTotals]);

  if (loading) return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <p className="text-text-muted animate-pulse">Caricamento allocazioni…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-base text-text-primary">
      <AppNav projectId={projectId} projectName={data?.project_name} />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Allocation Matrix</h1>
          <p className="text-text-muted text-sm mt-1">
            Assegna FTE per fase → risorsa → mese. Il semaforo indica l'utilizzo cross-project.
          </p>
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-text-muted">
          <span>🔴 Sovrallocazione &gt;1.0 FTE</span>
          <span>🟡 Sottoutilizzo &lt;0.8 FTE</span>
          <span>✅ Ottimale 0.8–1.0 FTE</span>
        </div>

        {isBaselineLocked && (
          <div className="bg-rag-yellow/10 border border-rag-yellow/30 rounded-xl px-5 py-3 text-rag-yellow text-sm">
            🔒 La baseline è bloccata. Le allocazioni sono in sola lettura.
          </div>
        )}

        {data?.phases.map((phase) => (
          <PhaseBlock
            key={phase.phase_id}
            phase={phase}
            projectId={projectId!}
            allResources={data.all_resources}
            crossTotals={crossTotals}
            isBaselineLocked={isBaselineLocked}
            onSaved={handleSaved}
          />
        ))}
      </main>
    </div>
  );
}
