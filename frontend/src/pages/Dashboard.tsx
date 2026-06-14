import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchDashboard } from '../api/projects';
import type { DashboardData, PhaseBudgetRow, MilestoneItem, PhaseFinancial } from '../types';
import RAGBadge from '../components/RAGBadge';
import BudgetBar from '../components/BudgetBar';
import KPICard from '../components/KPICard';
import SimilarProjects from '../components/SimilarProjects';
import ScopingInsightCard from '../components/ScopingInsightCard';
import ProjectMemoryTab from '../components/ProjectMemoryTab';
import { useSetProjectName } from '../components/ProjectLayout';
import { useFetch } from '../hooks/useFetch';
import { formatCurrency } from '../utils/formatCurrency';
import { fmtDate } from '../utils/dates';

function fmtPct(n: number) { return (n * 100).toFixed(0) + '%'; }

// ─── Sub-components ───────────────────────────

function PhaseBudgetTable({ rows, total }: { rows: PhaseBudgetRow[]; total: number }) {
  return (
    <>
      {/* Mobile card view */}
      <div className="block md:hidden space-y-3">
        {rows.map((r) => (
          <div key={r.phase_id} className="bg-surface border border-border rounded-2xl p-4 space-y-3">
            <p className="font-semibold text-text-primary">{r.display_name ?? r.phase_type}</p>
            <p className="text-text-dim text-xs">{fmtDate(r.planned_start)} → {fmtDate(r.planned_end)}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-text-dim text-xs uppercase tracking-wider mb-0.5">Budget</p>
                <p className="font-medium text-text-primary">{formatCurrency(r.budget)}</p>
              </div>
              <div>
                <p className="text-text-dim text-xs uppercase tracking-wider mb-0.5">Burn Rate/gg</p>
                <p className="text-text-muted">{formatCurrency(r.burn_rate_per_day)}</p>
              </div>
              <div>
                <p className="text-text-dim text-xs uppercase tracking-wider mb-0.5">GG</p>
                <p className="text-text-primary">{r.working_days}</p>
              </div>
              <div>
                <p className="text-text-dim text-xs uppercase tracking-wider mb-0.5">% Totale</p>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-1.5 bg-base rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${r.budget_pct_of_total}%` }} />
                  </div>
                  <span className="text-text-muted text-xs">{r.budget_pct_of_total.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div className="bg-surface-2 border border-border rounded-2xl px-4 py-3 flex justify-between items-center">
          <span className="font-bold text-text-primary">TOTALE</span>
          <span className="font-bold text-accent">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block relative rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="sticky left-0 bg-surface-2 z-10 text-left text-text-muted font-medium px-4 py-3 text-xs uppercase tracking-wider whitespace-nowrap">
                  Fase
                </th>
                {['Periodo', 'GG', 'Ore', 'Burn Rate/gg', 'Budget £', '% Totale'].map((h) => (
                  <th key={h} className="text-left text-text-muted font-medium px-4 py-3 text-xs uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.phase_id} className={`border-b border-border/50 hover:bg-surface-2/60 transition-colors ${i % 2 === 0 ? 'bg-surface' : 'bg-surface/50'}`}>
                  <td className={`sticky left-0 z-10 px-4 py-3 font-medium text-text-primary whitespace-nowrap ${i % 2 === 0 ? 'bg-surface' : 'bg-surface/50'}`}>
                    {r.display_name ?? r.phase_type}
                  </td>
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap text-xs">
                    {fmtDate(r.planned_start)} → {fmtDate(r.planned_end)}
                  </td>
                  <td className="px-4 py-3 text-text-primary">{r.working_days}</td>
                  <td className="px-4 py-3 text-text-primary">{r.planned_hours}</td>
                  <td className="px-4 py-3 text-text-muted">{formatCurrency(r.burn_rate_per_day)}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{formatCurrency(r.budget)}</td>
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
                <td className="sticky left-0 bg-surface-2 z-10 px-4 py-3 font-bold text-text-primary">TOTALE</td>
                <td colSpan={4} className="px-4 py-3" />
                <td className="px-4 py-3 font-bold text-accent">{formatCurrency(total)}</td>
                <td className="px-4 py-3 text-text-muted text-xs">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent" />
      </div>
    </>
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
              <p className="text-text-primary text-sm font-medium truncate"><span className="text-milestone">◆</span> {m.name}</p>
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

function PhaseFinancialsTable({ rows }: { rows: PhaseFinancial[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2">
            {['Fase', 'Budget', 'Speso', 'Forecast EAC', 'Variance', '% Complet.', 'RAG'].map((h) => (
              <th key={h} className="text-left text-text-muted font-medium px-4 py-3 text-xs uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.phase_id} className={`border-b border-border/50 hover:bg-surface-2/60 transition-colors ${i % 2 === 0 ? 'bg-surface' : 'bg-surface/50'}`}>
              <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">{r.display_name}</td>
              <td className="px-4 py-3 text-text-primary">{formatCurrency(r.budget)}</td>
              <td className="px-4 py-3 text-text-primary">{formatCurrency(r.cost_spent)}</td>
              <td className="px-4 py-3 font-medium text-text-primary">{formatCurrency(r.revised_forecast)}</td>
              <td className={`px-4 py-3 font-medium ${r.variance > 0 ? 'text-rag-red' : 'text-rag-green'}`}>
                {r.variance > 0 ? '+' : ''}{formatCurrency(r.variance)}
              </td>
              <td className="px-4 py-3 text-text-muted">{fmtPct(r.pct_complete)}</td>
              <td className="px-4 py-3">
                <RAGBadge status={r.rag_status} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type DashboardTab = 'overview' | 'memory';

// ─── Main Page ───────────────────────────────

export default function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const setProjectName = useSetProjectName();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  const { data, loading, error } = useFetch<DashboardData>(
    () => fetchDashboard(id!),
    [id],
  );

  useEffect(() => {
    if (data) setProjectName(data.project_name);
  }, [data, setProjectName]);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <p className="text-text-muted animate-pulse">Caricamento dashboard…</p>
    </div>
  );

  if (error || !data) return (
    <div className="flex items-center justify-center py-32">
      <p className="text-rag-red">{error ?? 'Progetto non trovato.'}</p>
    </div>
  );

  const { kpis, phase_budgets, milestones } = data;
  const totalBudget = phase_budgets.reduce((s, r) => s + r.budget, 0);

  const eacPctOfBac = kpis.budget_total > 0
    ? Math.round((kpis.revised_forecast / kpis.budget_total) * 100)
    : 0;

  // Contextual state detection
  const hasBudget   = totalBudget > 0;
  const hasSnapshot = !!kpis.last_sync_at;

  const ragBannerClass: Record<string, string> = {
    IN_LINEA:     'from-rag-green/20 to-rag-green/5 border-rag-green/30',
    A_RISCHIO:    'from-rag-yellow/20 to-rag-yellow/5 border-rag-yellow/30',
    FUORI_BUDGET: 'from-rag-red/20 to-rag-red/5 border-rag-red/30',
  };

  // ─── State A: no budget configured ───────────────────────────────────────
  if (!hasBudget) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{data.project_name}</h1>
          <p className="text-text-muted text-sm mt-1">Il progetto non è ancora pianificato. Completa la configurazione per vedere la dashboard.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <button
            onClick={() => navigate(`/projects/${id}/pianificazione`)}
            className="bg-surface border border-accent/30 rounded-2xl p-6 text-left hover:border-accent/60 hover:bg-surface-2 transition-all shadow-card group"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="font-semibold text-text-primary group-hover:text-accent transition-colors">1. Pianificazione</p>
            <p className="text-text-muted text-sm mt-1">Definisci fasi, date e alloca le risorse per calcolare il budget.</p>
          </button>
          <button
            onClick={() => navigate(`/projects/${id}/gantt`)}
            className="bg-surface border border-border rounded-2xl p-6 text-left hover:border-accent/40 hover:bg-surface-2 transition-all shadow-card group"
          >
            <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="font-semibold text-text-primary group-hover:text-accent transition-colors">2. Gantt</p>
            <p className="text-text-muted text-sm mt-1">Aggiungi task e milestone per il piano di progetto visuale.</p>
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

      {/* RAG Banner */}
      <div className={`rounded-2xl border bg-gradient-to-r p-5 flex items-center justify-between ${ragBannerClass[kpis.rag_status]}`}>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{data.project_name}</h1>
          <p className="text-text-muted text-sm mt-0.5">Dashboard di progetto</p>
        </div>
        <RAGBadge status={kpis.rag_status} size="md" />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-border pb-0">
        {(['overview', 'memory'] as DashboardTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-accent text-accent bg-accent/5'
                : 'border-transparent text-text-muted hover:text-text-primary hover:bg-surface-2'
            }`}
          >
            {tab === 'overview' ? 'Overview' : 'Memoria Progetto'}
          </button>
        ))}
      </div>

      {/* Memory tab */}
      {activeTab === 'memory' && (
        <div className="space-y-3">
          <p className="text-text-muted text-sm">Timeline cronologica di decisioni, rischi, slippage e retrospettive.</p>
          <ProjectMemoryTab projectId={parseInt(id ?? '0', 10)} />
        </div>
      )}

      {/* Overview tab content */}
      {activeTab === 'overview' && (<>

      {/* State B: budget configured but no snapshot yet */}
      {!hasSnapshot && (
        <div className="bg-surface-2 border border-border rounded-xl px-5 py-3 flex items-center justify-between gap-4">
          <p className="text-text-muted text-sm">
            Il budget è configurato. Inserisci il primo snapshot in <strong>Avanzamento</strong> per attivare i KPI di costo e previsione.
          </p>
          <button
            onClick={() => navigate(`/projects/${id}/avanzamento`)}
            className="flex-shrink-0 text-xs text-accent hover:text-accent/80 border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/10 transition-colors"
          >
            Vai ad Avanzamento →
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard label="Speso" value={formatCurrency(kpis.cost_spent)} sub={`${kpis.budget_pct}% del budget`} />
        <KPICard label="Budget (BAC)" value={formatCurrency(kpis.budget_total)} sub="budget di riferimento" />
        <KPICard label="Previsione (EAC)" value={formatCurrency(kpis.revised_forecast)} accent sub={`${eacPctOfBac}% del BAC`} />
        <KPICard label="Costo/gg" value={formatCurrency(kpis.daily_burn_rate)} sub="burn rate giornaliero" />
        <KPICard label="Scostamento" value={formatCurrency(kpis.variance)} sub={kpis.variance > 0 ? 'sopra budget' : 'sotto budget'} danger={kpis.variance > 0} positive={kpis.variance <= 0} />
        <KPICard label="Giorni rimasti" value={`${kpis.days_remaining}`} sub="giorni lavorativi" />
      </div>

      {/* Budget progress */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-card">
        <div className="flex justify-between items-center mb-3">
          <p className="font-semibold text-sm">Avanzamento Budget</p>
          <p className="text-text-muted text-sm">{formatCurrency(kpis.cost_spent)} / {formatCurrency(kpis.budget_total)}</p>
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

      {/* Phase financials detail */}
      {data.phase_financials && data.phase_financials.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-base">Forecast per Fase (EAC)</h2>
          <PhaseFinancialsTable rows={data.phase_financials} />
        </div>
      )}

      {/* Bottom row: Milestones + Sync info */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold text-base">Milestone Tracker</h2>
          <MilestoneTracker milestones={milestones} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Avanzamento</h2>
            <button
              onClick={() => navigate(`/projects/${id}/avanzamento`)}
              className="text-xs text-accent hover:text-accent/80 border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/10 transition-colors"
            >
              {hasSnapshot ? 'Inserimento Manuale' : 'Inserisci primo snapshot →'}
            </button>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-card space-y-3">
            {!hasSnapshot ? (
              <div className="text-center py-4 space-y-2">
                <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center mx-auto">
                  <svg className="w-4 h-4 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-text-muted text-sm">Nessuno snapshot registrato.</p>
                <p className="text-text-dim text-xs">Vai in Avanzamento per inserire costi e ore a consuntivo.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rag-green" />
                  <span className="text-sm font-medium text-text-primary">
                    {kpis.last_sync_source === 'keyedin_api' ? 'Keyedin API' : 'Inserimento Manuale'}
                  </span>
                </div>
                <p className="text-text-muted text-sm">
                  {new Date(kpis.last_sync_at!).toLocaleString('it-IT', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
                <div className="pt-1 border-t border-border space-y-1 text-xs text-text-muted">
                  <div className="flex justify-between">
                    <span>Ore spese</span>
                    <span className="text-text-primary font-medium">
                      {kpis.hours_spent_to_date > 0 ? `${kpis.hours_spent_to_date}h` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Costo speso</span>
                    <span className="text-text-primary font-medium">{formatCurrency(kpis.cost_spent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Giorni usati</span>
                    <span className="text-text-primary font-medium">
                      {kpis.working_days_used > 0 ? kpis.working_days_used : '—'}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KG-2: Progetti simili */}
      <div className="mt-6">
        <SimilarProjects
          projectId={parseInt(id ?? '0', 10)}
          tags={data.tags ?? []}
        />
      </div>

      {/* KG-3: Scoping Insight (AI) */}
      <div className="mt-6">
        <ScopingInsightCard projectId={parseInt(id ?? '0', 10)} />
      </div>

      </>)}

    </main>
  );
}
