import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import ConfirmModal from '../../components/ConfirmModal';
import SlippageModal from '../../components/SlippageModal';
import { useSetProjectName } from '../../components/ProjectLayout';
import FasiTab, { type PhaseState } from './FasiTab';
import PhaseBlock from './PhaseBlock';
import { fetchBaseline, saveBaseline, lockBaseline } from '../../api/baseline';
import { fetchAllocation, fetchResourceRegistry } from '../../api/allocation';
import type { AllocationData } from '../../types';

type Tab = 'fasi' | 'risorse';

export default function Pianificazione() {
  const { id: projectId } = useParams<{ id: string }>();
  const setProjectName = useSetProjectName();

  // shared state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('fasi');

  // baseline state
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

  // slippage state
  const [slippagePhase, setSlippagePhase] = useState<{ id: number; name: string } | null>(null);

  const loadAll = useCallback(() => {
    if (!projectId) return Promise.resolve();
    setLoadError(null);
    return Promise.all([
      fetchBaseline(projectId),
      fetchAllocation(projectId),
    ]).then(([bl, alloc]) => {
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
    }).catch(() => {
      setLoadError('Errore nel caricamento della pianificazione. Riprova.');
    }).finally(() => setLoading(false));
  }, [projectId, setProjectName]);

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

  const handleSave = useCallback(async () => {
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
  }, [projectId, phases, loadAll]);

  const openLockModal = useCallback(() => setShowLockModal(true), []);

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
    <div className="flex items-center justify-center py-32">
      <p className="text-text-muted animate-pulse">Caricamento pianificazione…</p>
    </div>
  );

  if (loadError) return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="bg-rag-red/10 border border-rag-red/30 rounded-xl px-5 py-4 text-rag-red text-sm flex items-center justify-between">
        <span>{loadError}</span>
        <button
          onClick={() => { setLoading(true); loadAll(); }}
          className="text-xs border border-rag-red/40 rounded-lg px-3 py-1.5 hover:bg-rag-red/10 transition-colors"
        >
          Riprova
        </button>
      </div>
    </div>
  );

  return (
    <>
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
            onShowLockModal={openLockModal}
            onRegisterSlippage={setSlippagePhase}
          />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-text-muted text-sm">
                Assegna FTE per fase → risorsa → settimana. Il semaforo indica l'utilizzo cross-project.
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-text-muted">
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

      {slippagePhase !== null && (
        <SlippageModal
          projectId={parseInt(projectId ?? '0', 10)}
          phaseId={slippagePhase.id}
          phaseName={slippagePhase.name}
          onClose={() => setSlippagePhase(null)}
        />
      )}
    </>
  );
}
