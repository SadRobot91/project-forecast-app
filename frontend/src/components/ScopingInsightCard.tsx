import { useState } from 'react';
import { fetchScopingInsight } from '../api/intelligence';

interface ScopingInsightCardProps {
  projectId: number;
}

/**
 * On-demand AI scoping risk brief. Loads only when the PM clicks "Genera",
 * avoiding a Claude call (latency/cost) on every Dashboard render. Degrades
 * gracefully: an empty brief (NoOp provider / <3 similar projects) renders a
 * placeholder, never an error. (M-003)
 */
export default function ScopingInsightCard({ projectId }: ScopingInsightCardProps) {
  const [brief, setBrief] = useState<string | null>(null);
  const [similarCount, setSimilarCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  function handleGenerate() {
    setLoading(true);
    setError(false);
    fetchScopingInsight(projectId)
      .then(res => {
        setBrief(res.brief);
        setSimilarCount(res.similar_count);
        setLoaded(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  return (
    <div className="border border-border rounded-xl p-4 bg-surface">
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <span aria-hidden="true">&#10024;</span> Scoping Insight
          <span className="text-xs font-normal text-text-dim border border-border rounded-full px-2 py-0.5">
            AI
          </span>
        </span>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="text-xs px-3 py-1 rounded-lg border border-border text-text-muted hover:text-text-primary hover:border-accent transition-colors disabled:opacity-50"
        >
          {loading ? 'Analisi…' : loaded ? 'Rigenera' : 'Genera'}
        </button>
      </div>

      {!loaded && !loading && !error && (
        <p className="text-text-muted text-sm">
          Genera un riassunto dei rischi tipici basato sui progetti simili nello storico.
        </p>
      )}

      {error && (
        <p className="text-rag-red text-sm">Errore durante la generazione. Riprova.</p>
      )}

      {loaded && brief && brief.trim().length > 0 && (
        <div className="space-y-2">
          <p className="text-text-primary text-sm whitespace-pre-line leading-relaxed">{brief}</p>
          <p className="text-text-dim text-xs">Basato su {similarCount} progetti simili.</p>
        </div>
      )}

      {loaded && (!brief || brief.trim().length === 0) && (
        <p className="text-text-muted text-sm">
          Nessun insight disponibile: servono almeno 3 progetti simili e una chiave
          AI configurata (ANTHROPIC_API_KEY). Lo storico verrà arricchito a ogni
          progetto chiuso.
        </p>
      )}
    </div>
  );
}
