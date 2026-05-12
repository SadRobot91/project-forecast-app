import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import AppNav from '../components/AppNav';
import { fetchOngoing, fetchOngoingHistory, saveOngoing, syncKeyedin } from '../api/ongoing';
import type { OngoingData, OngoingSnapshot } from '../types';

function fmt(n: number) {
  return `£${Math.round(n).toLocaleString('en-GB')}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

const today = new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  reporting_date:        today,
  cost_spent_to_date:    '',
  hours_spent_to_date:   '',
  working_days_used:     '',
  working_days_remaining: '',
};

export default function Ongoing() {
  const { id: projectId } = useParams<{ id: string }>();
  const [data, setData]       = useState<OngoingData | null>(null);
  const [history, setHistory] = useState<OngoingSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(() => {
    if (!projectId) return;
    Promise.all([
      fetchOngoing(projectId),
      fetchOngoingHistory(projectId),
    ]).then(([d, h]) => {
      setData(d);
      setHistory(h);
      if (d.snapshot) {
        setForm({
          reporting_date:        today,
          cost_spent_to_date:    String(d.snapshot.cost_spent_to_date),
          hours_spent_to_date:   String(d.snapshot.hours_spent_to_date),
          working_days_used:     String(d.snapshot.working_days_used),
          working_days_remaining: String(d.snapshot.working_days_remaining),
        });
      }
    }).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!projectId) return;
    const cost  = parseFloat(form.cost_spent_to_date);
    const hours = parseFloat(form.hours_spent_to_date);
    const wdUsed = parseFloat(form.working_days_used);
    const wdRem  = parseFloat(form.working_days_remaining);

    if (!form.reporting_date) { setError('Data di riferimento obbligatoria.'); return; }
    if (isNaN(cost)  || cost  < 0) { setError('Costo speso non valido.'); return; }
    if (isNaN(hours) || hours < 0) { setError('Ore spese non valide.'); return; }
    if (isNaN(wdUsed) || wdUsed < 0) { setError('Giorni lavorativi usati non validi.'); return; }

    setSaving(true);
    setError(null);
    try {
      await saveOngoing(projectId, {
        reporting_date:        form.reporting_date,
        cost_spent_to_date:    cost,
        hours_spent_to_date:   hours,
        working_days_used:     wdUsed,
        working_days_remaining: isNaN(wdRem) ? 0 : wdRem,
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
    <div className="min-h-screen bg-base flex items-center justify-center">
      <p className="text-text-muted animate-pulse">Caricamento avanzamento…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-base text-text-primary">
      <AppNav projectId={projectId} projectName={data?.project_name} />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
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
            <div className="bg-surface border border-border rounded-2xl px-5 py-4 shadow-card">
              <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-1">% Completamento</p>
              <p className="text-xl font-bold text-accent">{completionPct ?? '—'}%</p>
              <p className="text-text-dim text-xs mt-1">{snap.working_days_used} GG / {totalWD} GG totali</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl px-5 py-4 shadow-card">
              <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-1">Costo Speso</p>
              <p className="text-xl font-bold text-text-primary">{fmt(snap.cost_spent_to_date)}</p>
              <p className="text-text-dim text-xs mt-1">{budgetPct ?? '—'}% del budget {fmt(budgetTotal)}</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl px-5 py-4 shadow-card">
              <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-1">Costo / Ora</p>
              <p className="text-xl font-bold text-text-primary">
                {costPerHour != null ? `£${costPerHour.toFixed(0)}` : '—'}
              </p>
              <p className="text-text-dim text-xs mt-1">{snap.hours_spent_to_date}h registrate</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl px-5 py-4 shadow-card">
              <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-1">Burn Rate Storico</p>
              <p className="text-xl font-bold text-text-primary">
                {burnRateHistoric != null ? `${fmt(burnRateHistoric)}/gg` : '—'}
              </p>
              <p className="text-text-dim text-xs mt-1">{snap.working_days_remaining} GG rimanenti</p>
            </div>
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
              <span>{fmt(snap.cost_spent_to_date)} speso</span>
              <span>{fmt(budgetTotal)} budget</span>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Form inserimento manuale */}
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-card space-y-4">
            <h2 className="font-semibold text-text-primary">Inserisci Snapshot Manuale</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-text-muted mb-1">Data di riferimento *</label>
                <input
                  type="date"
                  value={form.reporting_date}
                  onChange={(e) => setForm((f) => ({ ...f, reporting_date: e.target.value }))}
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
                  onChange={(e) => setForm((f) => ({ ...f, cost_spent_to_date: e.target.value }))}
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
                  onChange={(e) => setForm((f) => ({ ...f, hours_spent_to_date: e.target.value }))}
                  className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">GG lavorativi usati</label>
                <input
                  type="number"
                  min={0}
                  placeholder="es. 58"
                  value={form.working_days_used}
                  onChange={(e) => setForm((f) => ({ ...f, working_days_used: e.target.value }))}
                  className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">GG lavorativi rimanenti</label>
                <input
                  type="number"
                  min={0}
                  placeholder="es. 83"
                  value={form.working_days_remaining}
                  onChange={(e) => setForm((f) => ({ ...f, working_days_remaining: e.target.value }))}
                  className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-accent hover:bg-accent/90 disabled:opacity-50 text-white transition-all"
            >
              {saving ? 'Salvataggio…' : saved ? '✓ Salvato' : 'Salva Snapshot'}
            </button>
          </div>

          {/* Storico */}
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-card">
            <h2 className="font-semibold text-text-primary mb-4">Storico Snapshot</h2>
            {history.length === 0 ? (
              <p className="text-text-muted text-sm">Nessuno snapshot registrato.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {history.map((s) => (
                  <div key={s.id} className="flex items-start justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{fmtDate(s.reporting_date)}</p>
                      <p className="text-xs text-text-dim">
                        {fmt(s.cost_spent_to_date)} · {s.hours_spent_to_date}h · {s.working_days_used} GG usati
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        s.source === 'keyedin_api'
                          ? 'bg-accent/15 text-accent'
                          : 'bg-surface-2 text-text-muted'
                      }`}>
                        {s.source === 'keyedin_api' ? 'Keyedin' : 'Manuale'}
                      </span>
                      <p className="text-xs text-text-dim mt-1">{fmtDateTime(s.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
