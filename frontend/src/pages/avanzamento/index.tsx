import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import ConfirmModal from '../../components/ConfirmModal';
import KPICard from '../../components/KPICard';
import { useSetProjectName } from '../../components/ProjectLayout';
import SnapshotForm, { type SnapshotFormState } from './SnapshotForm';
import SnapshotHistory from './SnapshotHistory';
import { fetchOngoing, fetchOngoingHistory, saveOngoing, deleteSnapshot, syncKeyedin } from '../../api/ongoing';
import { fmtDate } from '../../utils/dates';
import { formatCurrency } from '../../utils/formatCurrency';
import type { OngoingData, OngoingSnapshot, OngoingPhaseOption } from '../../types';

function getEmptyForm(): SnapshotFormState {
  return {
    reporting_date:         new Date().toISOString().slice(0, 10),
    cost_spent_to_date:     '',
    hours_spent_to_date:    '',
    working_days_used:      '',
    working_days_remaining: '',
  };
}

export default function Avanzamento() {
  const { id: projectId } = useParams<{ id: string }>();
  const setProjectName = useSetProjectName();
  const [data, setData]       = useState<OngoingData | null>(null);
  const [history, setHistory] = useState<OngoingSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(getEmptyForm);
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget]       = useState<OngoingSnapshot | null>(null);
  const [deleting, setDeleting]               = useState(false);

  const load = useCallback((phaseId?: number | null) => {
    if (!projectId) return;
    const pid = phaseId !== undefined ? phaseId : selectedPhaseId;
    Promise.all([
      fetchOngoing(projectId, pid),
      fetchOngoingHistory(projectId, pid),
    ]).then(([d, h]) => {
      setData(d);
      setHistory(h);
      setProjectName(d.project_name);
      if (d.snapshot) {
        setForm({
          reporting_date:         new Date().toISOString().slice(0, 10),
          cost_spent_to_date:     String(d.snapshot.cost_spent_to_date),
          hours_spent_to_date:    String(d.snapshot.hours_spent_to_date),
          working_days_used:      String(d.snapshot.working_days_used),
          working_days_remaining: String(d.snapshot.working_days_remaining),
        });
      }
    }).catch(() => {
      setError('Errore nel caricamento dei dati di avanzamento. Riprova.');
    }).finally(() => setLoading(false));
  }, [projectId, selectedPhaseId, setProjectName]);

  useEffect(() => { load(); }, [load]);

  function handleSaveClick() {
    if (!projectId) return;
    const cost  = parseFloat(form.cost_spent_to_date);
    const hours = parseFloat(form.hours_spent_to_date);
    const wdUsed = parseFloat(form.working_days_used);

    if (!form.reporting_date) { setError('Data di riferimento obbligatoria.'); return; }
    if (isNaN(cost)  || cost  < 0) { setError('Costo speso non valido.'); return; }
    if (isNaN(hours) || hours < 0) { setError('Ore spese non valide.'); return; }
    if (isNaN(wdUsed) || wdUsed < 0) { setError('Giorni lavorativi usati non validi.'); return; }

    setError(null);
    setShowSaveConfirm(true);
  }

  async function handleSaveConfirmed() {
    if (!projectId) return;
    const cost   = parseFloat(form.cost_spent_to_date);
    const hours  = parseFloat(form.hours_spent_to_date);
    const wdUsed = parseFloat(form.working_days_used);
    const wdRem  = parseFloat(form.working_days_remaining);

    setShowSaveConfirm(false);
    setSaving(true);
    try {
      await saveOngoing(projectId, {
        reporting_date:         form.reporting_date,
        cost_spent_to_date:     cost,
        hours_spent_to_date:    hours,
        working_days_used:      wdUsed,
        working_days_remaining: isNaN(wdRem) ? 0 : wdRem,
        phase_id:               selectedPhaseId,
      });
      load();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Errore durante il salvataggio. Riprova.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!projectId || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSnapshot(projectId, deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      setDeleteTarget(null);
      setError(e?.message ?? 'Errore durante la cancellazione.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleSync() {
    if (!projectId) return;
    setSyncing(true);
    setError(null);
    try {
      await syncKeyedin(projectId);
      load();
    } catch (e: any) {
      setError(e?.message ?? 'Errore sincronizzazione Keyedin.');
    } finally {
      setSyncing(false);
    }
  }

  const phases: OngoingPhaseOption[] = data?.phases ?? [];

  useEffect(() => {
    if (selectedPhaseId === null && phases.length > 0) {
      setSelectedPhaseId(phases[0].id);
    }
  }, [phases, selectedPhaseId]);

  function phaseLabel(phaseId: number | null): string {
    if (phaseId === null) return 'Progetto';
    const found = phases.find((p) => p.id === phaseId);
    return found ? found.display_name : `Fase ${phaseId}`;
  }

  // Derived metrics from latest snapshot + baseline context
  const snap = data?.snapshot;
  const budgetTotal = data?.budget_total ?? 0;
  const totalWD     = data?.total_working_days ?? 0;

  const completionPct = totalWD > 0 && snap
    ? Math.min(100, Math.round((snap.working_days_used / totalWD) * 100))
    : null;
  const costPerHour = snap && snap.hours_spent_to_date > 0
    ? snap.cost_spent_to_date / snap.hours_spent_to_date
    : null;
  const burnRateHistoric = snap && snap.working_days_used > 0
    ? snap.cost_spent_to_date / snap.working_days_used
    : null;
  const budgetPct = budgetTotal > 0 && snap
    ? Math.round((snap.cost_spent_to_date / budgetTotal) * 100)
    : null;

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <p className="text-text-muted animate-pulse">Caricamento avanzamento…</p>
    </div>
  );

  return (
    <>
      {showSaveConfirm && (
        <ConfirmModal
          title="Salva Snapshot"
          message={`Stai per salvare uno snapshot alla data ${fmtDate(form.reporting_date)} con ${form.hours_spent_to_date}h e ${formatCurrency(parseFloat(form.cost_spent_to_date))} di costo. Confermi?`}
          confirmLabel="Salva"
          loading={saving}
          onConfirm={handleSaveConfirmed}
          onCancel={() => setShowSaveConfirm(false)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Elimina Snapshot"
          message={`Stai per eliminare lo snapshot del ${fmtDate(deleteTarget.reporting_date)}. Questa azione è irreversibile. Continuare?`}
          confirmLabel="Elimina"
          confirmDanger
          loading={deleting}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Avanzamento Progetto</h1>
            <p className="text-text-muted text-sm mt-1">
              {snap
                ? `Ultimo aggiornamento: ${fmtDate(snap.reporting_date)} · via ${snap.source === 'manual' ? 'inserimento manuale' : 'Keyedin API'}`
                : 'Nessun dato inserito. Inserisci il primo snapshot.'}
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-surface border border-border hover:border-accent/50 text-text-muted transition-all disabled:opacity-50"
          >
            {syncing ? '⟳ Sincronizzazione…' : '⟳ Sync da Keyedin'}
          </button>
        </div>

        {error && (
          <div className="bg-rag-red/10 border border-rag-red/30 rounded-xl px-5 py-3 text-rag-red text-sm">
            {error}
          </div>
        )}

        {/* KPI cards — solo se c'è uno snapshot */}
        {snap && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="% Completamento"
              value={`${completionPct ?? '—'}%`}
              accent
              sub={`${snap.working_days_used} GG / ${totalWD} GG totali`}
            />
            <KPICard
              label="Costo Speso"
              value={formatCurrency(snap.cost_spent_to_date)}
              sub={`${budgetPct ?? '—'}% del budget ${formatCurrency(budgetTotal)}`}
            />
            <KPICard
              label="Costo / Ora"
              value={costPerHour != null ? formatCurrency(Math.round(costPerHour)) : '—'}
              sub={`${snap.hours_spent_to_date}h registrate`}
            />
            <KPICard
              label="Burn Rate Storico"
              value={burnRateHistoric != null ? `${formatCurrency(Math.round(burnRateHistoric))}/gg` : '—'}
              sub={`${snap.working_days_remaining} GG rimanenti`}
            />
          </div>
        )}

        {/* Budget progress bar */}
        {snap && budgetPct !== null && (
          <div className="bg-surface border border-border rounded-2xl px-5 py-4 shadow-card">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-muted">Utilizzo Budget</span>
              <span className={`font-semibold ${budgetPct > 90 ? 'text-rag-red' : budgetPct > 70 ? 'text-rag-yellow' : 'text-rag-green'}`}>
                {budgetPct}%
              </span>
            </div>
            <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${budgetPct > 90 ? 'bg-rag-red' : budgetPct > 70 ? 'bg-rag-yellow' : 'bg-rag-green'}`}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-text-dim mt-1">
              <span>{formatCurrency(snap.cost_spent_to_date)} speso</span>
              <span>{formatCurrency(budgetTotal)} budget</span>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <SnapshotForm
            form={form}
            phases={phases}
            selectedPhaseId={selectedPhaseId}
            totalWD={totalWD}
            saving={saving}
            saved={saved}
            onSelectPhase={setSelectedPhaseId}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            onSave={handleSaveClick}
          />
          <SnapshotHistory
            history={history}
            phaseLabel={phaseLabel}
            onDelete={setDeleteTarget}
          />
        </div>

      </main>
    </>
  );
}
