import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProjects, updateProjectStatus } from '../api/projects';
import { patchProjectScoping } from '../api/knowledge';
import type { ProjectStatus, ProjectSummary } from '../types';
import { useAuth } from '../contexts/AuthContext';
import RAGBadge from '../components/RAGBadge';
import BudgetBar from '../components/BudgetBar';
import AppNav from '../components/AppNav';
import RetrospectiveModal from '../components/RetrospectiveModal';
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

  // scoping state
  const [scopingProjectId, setScopingProjectId] = useState<number | null>(null);
  const [scopingData, setScopingData] = useState<{ description: string; tags: string[] }>({ description: '', tags: [] });
  const [scopingTagInput, setScopingTagInput] = useState('');
  const [scopingSaving, setScopingSaving] = useState(false);

  // retrospective state
  const [retroProjectId, setRetroProjectId] = useState<number | null>(null);

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
      if (next === 'closed') {
        setRetroProjectId(project.id);
      }
    } catch {
      setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, status: project.status } : p));
    }
  }

  function openScoping(e: React.MouseEvent, p: ProjectSummary) {
    e.preventDefault();
    e.stopPropagation();
    setScopingProjectId(p.id);
    setScopingData({ description: p.description ?? '', tags: p.tags ?? [] });
    setScopingTagInput('');
  }

  function addTag() {
    const tag = scopingTagInput.trim();
    if (!tag || scopingData.tags.includes(tag)) return;
    setScopingData((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    setScopingTagInput('');
  }

  function removeTag(tag: string) {
    setScopingData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  }

  async function handleScopingSave() {
    if (scopingProjectId === null) return;
    setScopingSaving(true);
    try {
      const updated = await patchProjectScoping(scopingProjectId, scopingData);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === scopingProjectId
            ? { ...p, description: updated.description, tags: updated.tags }
            : p
        )
      );
      setScopingProjectId(null);
    } finally {
      setScopingSaving(false);
    }
  }

  const filtered = projects.filter((p) => filter === 'all' || p.status === filter);

  return (
    <div className="min-h-screen bg-base text-text-primary">
      <AppNav />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
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
                  className="group relative block bg-surface border border-border hover:border-accent/50 rounded-2xl p-6 shadow-card hover:shadow-glow-accent hover:-translate-y-1 transition-all duration-300"
                >
                  {/* Edit info button — visible on card hover */}
                  <button
                    onClick={(e) => openScoping(e, p)}
                    title="Modifica descrizione e tag"
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-text-dim hover:text-accent flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    Modifica info
                  </button>

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

      {/* Scoping modal */}
      {scopingProjectId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setScopingProjectId(null)} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-card p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-text-primary mb-4">Modifica info progetto</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">Descrizione progetto</label>
                <textarea
                  value={scopingData.description}
                  onChange={(e) => setScopingData((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-1">Tag</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={scopingTagInput}
                    onChange={(e) => setScopingTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="Aggiungi tag…"
                    className="flex-1 bg-base border border-border text-text-primary rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
                  />
                  <button
                    onClick={addTag}
                    className="px-3 py-1.5 rounded-lg text-sm bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30 transition-colors"
                  >
                    +
                  </button>
                </div>
                {scopingData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {scopingData.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-accent/20 text-accent text-xs px-2 py-0.5 flex items-center gap-1">
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="hover:text-white transition-colors leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setScopingProjectId(null)}
                disabled={scopingSaving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted bg-base border border-border hover:border-text-dim transition-colors disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={handleScopingSave}
                disabled={scopingSaving}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent hover:bg-accent/90 text-white shadow-glow-accent transition-all disabled:opacity-50"
              >
                {scopingSaving ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {retroProjectId !== null && (
        <RetrospectiveModal
          projectId={retroProjectId}
          onClose={() => setRetroProjectId(null)}
        />
      )}
    </div>
  );
}
