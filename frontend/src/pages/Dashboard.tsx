import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchDashboard } from '../api/projects';
import type { DashboardData, PhaseBudgetRow, MilestoneItem } from '../types';
import RAGBadge from '../components/RAGBadge';
import BudgetBar from '../components/BudgetBar';
import AppNav from '../components/AppNav';

const PHASE_LABEL: Record<string, string> = {
  feasibility: 'Feasibility',
  planning_design: 'Planning & Design',
  build: 'Build',
  deployment: 'Deployment',
  closure: 'Closure',
};

function fmt(n: number) {
  return `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Sub-components ───────────────────────────

function KPICard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`bg-surface border rounded-2xl px-5 py-4 shadow-card ${accent ? 'border-accent/40' : 'border-border'}`}>
      <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-text-dim text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function PhaseBudgetTable({ rows, total }: { rows: PhaseBudgetRow[]; total: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2">
            {['Fase', 'Periodo', 'GG', 'Ore', 'Burn Rate/gg', 'Budget £', '% Totale'].map((h) => (
              <th key={h} className="text-left text-text-muted font-medium px-4 py-3 text-xs uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.phase_id} className={`border-b border-border/50 hover:bg-surface-2/60 transition-colors ${i % 2 === 0 ? 'bg-surface' : 'bg-surface/50'}`}>
              <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">{PHASE_LABEL[r.phase_type]}</td>
              <td className="px-4 py-3 text-text-muted whitespace-nowrap text-xs">
                {fmtDate(r.planned_start)} → {fmtDate(r.planned_end)}
              </td>
              <td className="px-4 py-3 text-text-primary">{r.working_days}</td>
              <td className="px-4 py-3 text-text-primary">{r.planned_hours}</td>
              <td className="px-4 py-3 text-text-muted">{fmt(r.burn_rate_per_day)}</td>
              <td className="px-4 py-3 font-medium text-text-primary">{fmt(r.budget)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-base rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${r.budget_pct_of_total}%` }} />
                  </div>
                  <span className="text-text-muted text-xs">{r.budget_pct_of_total.toFixed(1)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-surface-2">
            <td colSpan={5} className="px-4 py-3 font-bold text-text-primary">TOTALE</td>
            <td className="px-4 py-3 font-bold text-accent">{fmt(total)}</td>
            <td className="px-4 py-3 text-text-muted text-xs">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const MILESTONE_STATUS_CONFIG = {
  completed:   { dot: 'bg-rag-green', label: 'Completata' },
  in_progress: { dot: 'bg-rag-yellow animate-pulse', label: 'In corso' },
  not_started: { dot: 'bg-text-dim', label: 'Non iniziata' },
};

function MilestoneTracker({ milestones }: { milestones: MilestoneItem[] }) {
  const last5 = milestones.slice(-5);
  return (
    <div className="space-y-3">
      {last5.map((m) => {
        const cfg = MILESTONE_STATUS_CONFIG[m.status];
        const isLate = m.actual_date && m.actual_date > m.planned_date;
        return (
          <div key={m.id} className="flex items-center gap-4 p-3 rounded-xl border border-border bg-surface hover:bg-surface-2 transition-colors">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
            <div className="flex-1 min-w-0">
              <p className="text-text-primary text-sm font-medium truncate">◆ {m.name}</p>
              <p className="text-text-dim text-xs mt-0.5">Pianificata: {fmtDate(m.planned_date)}</p>
            </div>
            <div className="text-right flex-shrink-0">
              {m.actual_date ? (
                <p className={`text-xs font-medium ${isLate ? 'text-rag-yellow' : 'text-rag-green'}`}>
                  Effettiva: {fmtDate(m.actual_date)}
                </p>
              ) : (
                <p className="text-xs text-text-dim">{cfg.label}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ───────────────────────────────

export default function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchDashboard(id)
      .then(setData)
      .catch(() => setError('Errore nel caricamento della dashboard.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <p className="text-text-muted animate-pulse">Caricamento dashboard…</p>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <p className="text-rag-red">{error ?? 'Progetto non trovato.'}</p>
    </div>
  );

  const { kpis, phase_budgets, milestones } = data;
  const totalBudget = phase_budgets.reduce((s, r) => s + r.budget, 0);

  const ragBannerClass: Record<string, string> = {
    IN_LINEA:     'from-rag-green/20 to-rag-green/5 border-rag-green/30',
    A_RISCHIO:    'from-rag-yellow/20 to-rag-yellow/5 border-rag-yellow/30',
    FUORI_BUDGET: 'from-rag-red/20 to-rag-red/5 border-rag-red/30',
  };

  return (
    <div className="min-h-screen bg-base text-text-primary">
      <AppNav projectId={id} projectName={data.project_name} />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* RAG Banner */}
        <div className={`rounded-2xl border bg-gradient-to-r p-5 flex items-center justify-between ${ragBannerClass[kpis.rag_status]}`}>
          <div>
            <h1 className="text-xl font-bold text-text-primary">{data.project_name}</h1>
            <p className="text-text-muted text-sm mt-0.5">Dashboard di progetto</p>
          </div>
          <RAGBadge status={kpis.rag_status} size="md" />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard label="Speso" value={fmt(kpis.cost_spent)} sub={`${kpis.budget_pct}% del budget`} />
          <KPICard label="Budget" value={fmt(kpis.budget_total)} />
          <KPICard label="Previsione" value={fmt(kpis.revised_forecast)} accent sub={`Scostamento: ${fmt(kpis.variance)}`} />
          <KPICard label="Costo/gg" value={fmt(kpis.daily_burn_rate)} sub="burn rate giornaliero" />
          <KPICard label="Scostamento" value={fmt(kpis.variance)} sub={kpis.variance > 0 ? 'sopra budget' : 'sotto budget'} />
          <KPICard label="Giorni rimasti" value={`${kpis.days_remaining}`} sub="giorni lavorativi" />
        </div>

        {/* Budget progress */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-card">
          <div className="flex justify-between items-center mb-3">
            <p className="font-semibold text-sm">Avanzamento Budget</p>
            <p className="text-text-muted text-sm">{fmt(kpis.cost_spent)} / {fmt(kpis.budget_total)}</p>
          </div>
          <BudgetBar pct={kpis.budget_pct} />
          <div className="flex justify-between text-xs text-text-dim mt-2">
            <span>0%</span>
            <span className="font-medium text-text-muted">{kpis.budget_pct}% consumato</span>
            <span>100%</span>
          </div>
        </div>

        {/* Phase budget table */}
        <div className="space-y-3">
          <h2 className="font-semibold text-base">Budget per Fase</h2>
          <PhaseBudgetTable rows={phase_budgets} total={totalBudget} />
        </div>

        {/* Bottom row: Milestones + Sync info */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="font-semibold text-base">Milestone Tracker</h2>
            <MilestoneTracker milestones={milestones} />
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-base">Ultimo Aggiornamento Ongoing</h2>
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-card space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${kpis.last_sync_at ? 'bg-rag-green' : 'bg-text-dim'}`} />
                <span className="text-sm font-medium text-text-primary">
                  {kpis.last_sync_source === 'keyedin_api' ? 'Keyedin API' : 'Inserimento Manuale'}
                </span>
              </div>
              {kpis.last_sync_at ? (
                <p className="text-text-muted text-sm">
                  {new Date(kpis.last_sync_at).toLocaleString('it-IT', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              ) : (
                <p className="text-text-dim text-sm">Nessun dato disponibile</p>
              )}
              <div className="pt-1 border-t border-border space-y-1 text-xs text-text-muted">
                <div className="flex justify-between">
                  <span>Ore spese</span>
                  <span className="text-text-primary font-medium">—</span>
                </div>
                <div className="flex justify-between">
                  <span>Costo speso</span>
                  <span className="text-text-primary font-medium">{fmt(kpis.cost_spent)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Giorni usati</span>
                  <span className="text-text-primary font-medium">—</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
