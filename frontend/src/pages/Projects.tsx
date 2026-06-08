import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProjects, updateProjectStatus } from '../api/projects';
import type { ProjectStatus, ProjectSummary } from '../types';
import { useAuth } from '../contexts/AuthContext';
import RAGBadge from '../components/RAGBadge';
import BudgetBar from '../components/BudgetBar';
import AppNav from '../components/AppNav';
import { formatCurrency } from '../utils/formatCurrency';

const STATUS_CYCLE: ProjectStatus[] = ['active', 'on_hold', 'closed'];
const STATUS_LABEL: Record<ProjectStatus, string> = {
  active:   'Attivo',
  on_hold:  'In pausa',
  closed:   'Chiuso',
  archived: 'Archiviato',
};
const STATUS_CLS: Record<ProjectStatus, string> = {
  active:   'border-rag-green/40 text-rag-green   bg-rag-green/10',
  on_hold:  'border-yellow-400/40 text-yellow-400  bg-yellow-400/10',
  closed:   'border-text-dim/30  text-text-dim    bg-base',
  archived: 'border-text-dim/20  text-text-dim    bg-base',
};

type FilterStatus = 'all' | 'active' | 'on_hold' | 'closed';

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState<FilterStatus>('all');

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch(() => setError('Errore nel caricamento dei progetti.'))
      .finally(() => setLoading(false));
  }, []);

  async function cycleStatus(e: React.MouseEvent, project: ProjectSummary) {
    e.preventDefault();
    e.stopPropagation();
    const idx  = STATUS_CYCLE.indexOf(project.status as ProjectStatus);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, status: next } : p));
    try {
      await updateProjectStatus(project.id, next);
    } catch {
      setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, status: project.status } : p));
    }
  }

  const filtered = projects.filter((p) => filter === 'all' || p.status === filter);

  return (
    <div className="min-h-screen bg-base text-text-primary">
      <AppNav />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {user?.role === 'dm' ? 'Portfolio — Tutti i Progetti' : 'I Tuoi Progetti'}
            </h1>
            <p className="text-text-muted text-sm mt-1">
              {user?.role === 'dm'
                ? 'Vista aggregata di tutti i progetti. Clicca lo stato per cambiarlo.'
                : 'Clicca su un progetto per accedere alla dashboard.'}
            </p>
          </div>

          {/* Status filter */}
          <div className="flex gap-1 bg-surface border border-border rounded-xl p-1">
            {(['all', 'active', 'on_hold', 'closed'] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  filter === f
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
                }`}
              >
                {f === 'all' ? 'Tutti' : STATUS_LABEL[f as ProjectStatus]}
              </button>
            ))}
          </div>
        </div>

        {loading && <div className="text-text-muted text-sm animate-pulse">Caricamento progetti…</div>}
        {error   && <div className="bg-rag-red/10 border border-rag-red/30 text-rag-red text-sm rounded-lg px-4 py-3">{error}</div>}

        {!loading && !error && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}/dashboard`}
                  className="group block bg-surface border border-border hover:border-accent/50 rounded-2xl p-6 shadow-card hover:shadow-glow-accent transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="font-semibold text-text-primary group-hover:text-accent transition-colors">
                        {p.name}
                      </h2>
                      <p className="text-text-dim text-xs mt-0.5">
                        Fase: <span className="text-text-muted">{p.current_phase_display_name ?? p.current_phase ?? '—'}</span>
                      </p>
                    </div>
                    <RAGBadge status={p.rag_status} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Budget consumato</span>
                      <span className="font-medium text-text-primary">{p.budget_pct}%</span>
                    </div>
                    <BudgetBar pct={p.budget_pct} />
                    <div className="flex justify-between text-xs text-text-dim pt-1">
                      <span>{formatCurrency(p.budget_spent)} spesi</span>
                      <span>{formatCurrency(p.budget_total)} budget</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-text-muted">
                    <span>{p.days_remaining > 0 ? `${p.days_remaining} gg al termine` : 'Concluso'}</span>

                    {/* Status badge — click cycles through active → on_hold → closed */}
                    <button
                      onClick={(e) => cycleStatus(e, p)}
                      title="Clicca per cambiare stato"
                      className={`px-2 py-0.5 rounded-full text-xs border transition-all hover:scale-105 ${STATUS_CLS[p.status as ProjectStatus] ?? STATUS_CLS.closed}`}
                    >
                      {STATUS_LABEL[p.status as ProjectStatus] ?? p.status}
                    </button>
                  </div>
                </Link>
              ))}
            </div>

            {filtered.length === 0 && (
              <p className="text-text-muted text-center py-16 text-sm">
                Nessun progetto con stato "{filter === 'on_hold' ? 'In pausa' : filter}".
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
