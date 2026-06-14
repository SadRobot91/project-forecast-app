import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import FTECell from '../../components/FTECell';
import AddResourceModal from './AddResourceModal';
import { saveAllocationPhase, createResource } from '../../api/allocation';
import { weeksInRange, fmtWeek } from '../../utils/networkDays';
import { formatCurrency } from '../../utils/formatCurrency';
import { fmtDateShort } from '../../utils/dates';
import type { AllocationPhaseMatrix, AllocationCell, Resource } from '../../types';

interface AllocCellProps {
  resourceId: number;
  weekStart: string;
  fte: number;
  crossProjectTotal: number;
  onUpdate: (resourceId: number, weekStart: string, fte: number) => void;
}

const AllocCell = memo(function AllocCell({ resourceId, weekStart, fte, crossProjectTotal, onUpdate }: AllocCellProps) {
  return (
    <FTECell
      value={fte}
      crossProjectTotal={crossProjectTotal}
      onChange={(val) => onUpdate(resourceId, weekStart, val)}
    />
  );
});

interface PhaseBlockProps {
  phase: AllocationPhaseMatrix;
  projectId: string;
  allResources: Resource[];
  crossTotals: Record<string, number>;
  isBaselineLocked: boolean;
  onSaved: () => void;
}

export default function PhaseBlock({ phase, projectId, allResources, crossTotals, isBaselineLocked, onSaved }: PhaseBlockProps) {
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
    if (dirty) return;
    setCells(phase.cells);
    setResources(phase.resources);
  }, [phase.cells, phase.resources, dirty]);

  const weeks = weeksInRange(phase.planned_start, phase.planned_end);

  const cellMap = useMemo(() => {
    const m = new Map<string, AllocationCell>();
    for (const c of cells) m.set(`${c.resource_id}:${c.week_start}`, c);
    return m;
  }, [cells]);

  const savedFteMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of phase.cells) m.set(`${c.resource_id}:${c.week_start}`, c.fte);
    return m;
  }, [phase.cells]);

  function getCrossProjectTotal(resourceId: number, weekStart: string): number {
    const key = `${resourceId}:${weekStart}`;
    const registryTotal = crossTotals[key] ?? 0;
    const savedFte = savedFteMap.get(key) ?? 0;
    const localFte = cellMap.get(key)?.fte ?? 0;
    return Math.max(0, registryTotal - savedFte + localFte);
  }

  const updateCell = useCallback((resourceId: number, weekStart: string, fte: number) => {
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
  }, [resources, phase.phase_id]);

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
          <span className="text-text-dim text-xs">{fmtDateShort(phase.planned_start)} → {fmtDateShort(phase.planned_end)}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span>FTE medio: <strong className="text-text-primary">{avgFTE.toFixed(2)}</strong></span>
          <span>Budget fase: <strong className="text-accent">{formatCurrency(phaseBudget)}</strong></span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border">
          <p className="md:hidden px-5 py-2 text-xs text-rag-yellow bg-rag-yellow/10 border-b border-border">
            ↔ Matrice ottimizzata per desktop — ruota il dispositivo o scorri per vedere tutte le settimane.
          </p>
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
                        {weeks.map((w) => (
                          <td key={w} className="px-2 py-2 text-center">
                            <AllocCell
                              resourceId={r.id}
                              weekStart={w}
                              fte={cellMap.get(`${r.id}:${w}`)?.fte ?? 0}
                              crossProjectTotal={getCrossProjectTotal(r.id, w)}
                              onUpdate={updateCell}
                            />
                          </td>
                        ))}
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
