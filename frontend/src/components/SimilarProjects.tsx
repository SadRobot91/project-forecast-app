import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SimilarProject } from '../types';
import { fetchSimilarProjects } from '../api/knowledge';

interface SimilarProjectsProps {
  projectId: number;
  tags: string[];
}

export default function SimilarProjects({ projectId, tags }: SimilarProjectsProps) {
  const [expanded, setExpanded] = useState(false);
  const [projects, setProjects] = useState<SimilarProject[]>([]);
  const [loading, setLoading] = useState(false);

  if (tags.length === 0) return null;

  function handleExpand() {
    if (!expanded && projects.length === 0 && tags.length > 0) {
      setLoading(true);
      fetchSimilarProjects(tags, projectId)
        .then(setProjects)
        .catch(() => setProjects([]))
        .finally(() => setLoading(false));
    }
    setExpanded(prev => !prev);
  }

  if (!expanded) {
    return (
      <button
        onClick={handleExpand}
        className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <span>&#9656; Progetti simili</span>
        <span className="bg-surface-2 border border-border rounded-full text-xs px-2 py-0.5">
          {tags.length}
        </span>
      </button>
    );
  }

  return (
    <div className="border border-border rounded-xl p-4 bg-surface">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-text-primary">&#9662; Progetti simili</span>
        <button
          onClick={() => setExpanded(false)}
          className="text-text-dim hover:text-text-primary transition-colors text-sm leading-none"
          aria-label="Chiudi"
        >
          &times;
        </button>
      </div>

      {loading && (
        <p className="text-text-muted text-sm">Ricerca in corso&hellip;</p>
      )}

      {!loading && projects.length === 0 && (
        <p className="text-text-muted text-sm">Nessun progetto simile trovato.</p>
      )}

      {!loading && projects.length > 0 && (
        <div className="flex flex-col gap-3">
          {projects.map(p => {
            const commonTags = p.tags.filter(t => tags.includes(t));
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border bg-surface-2"
              >
                <Link
                  to={`/projects/${p.id}/dashboard`}
                  className="font-medium text-sm text-accent hover:underline"
                >
                  {p.name}
                </Link>
                <span className="rounded-full text-xs border border-border px-2 py-0.5 text-text-muted">
                  {p.status}
                </span>
                <div className="flex flex-wrap gap-1">
                  {commonTags.map(t => (
                    <span
                      key={t}
                      className="bg-accent/20 text-accent text-xs rounded-full px-1.5 py-0.5"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <span className="text-text-dim text-xs ml-auto">{p.matching_tag_count} tag in comune</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
