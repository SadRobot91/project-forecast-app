import { fetchCapacityHeatmap } from '../api/allocation';
import { useFetch } from '../hooks/useFetch';
import { fmtWeek } from '../utils/networkDays';
import type { CapacityBand } from '../types';

const BAND_STYLE: Record<CapacityBand, string> = {
  under: 'bg-rag-yellow/15 text-rag-yellow',
  optimal: 'bg-rag-green/15 text-rag-green',
  over: 'bg-rag-red/20 text-rag-red',
};

/**
 * Demand-vs-supply capacity heatmap. Dense resource × week grid coloured by
 * band: <0.5 sotto-utilizzo, 0.5–1.0 ottimale, >1.0 eccesso. Read-only view
 * over the shared cross-project registry (capacity fixed at 1.0 FTE/week,
 * the invariant enforced by canAllocate). (M-005)
 */
export default function CapacityHeatmap() {
  const { data, loading, error, reload } = useFetch(fetchCapacityHeatmap, []);

  if (loading) {
    return <p className="text-text-muted text-sm animate-pulse">Caricamento heatmap capacità…</p>;
  }

  if (error || !data) {
    return (
      <div className="bg-rag-red/10 border border-rag-red/30 rounded-xl px-4 py-3 text-rag-red text-sm flex items-center justify-between">
        <span>{error ?? 'Heatmap non disponibile.'}</span>
        <button onClick={reload} className="text-xs border border-rag-red/40 rounded-lg px-3 py-1 hover:bg-rag-red/10 transition-colors">
          Riprova
        </button>
      </div>
    );
  }

  if (data.resources.length === 0 || data.weeks.length === 0) {
    return <p className="text-text-muted text-sm">Nessuna allocazione nell'orizzonte selezionato.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">Heatmap capacità (domanda vs offerta)</h2>
        <div className="flex gap-3 text-xs text-text-muted">
          <span><span className="inline-block w-3 h-3 rounded-sm bg-rag-yellow/40 align-middle mr-1" />&lt;50% sotto</span>
          <span><span className="inline-block w-3 h-3 rounded-sm bg-rag-green/40 align-middle mr-1" />50–100% ottimale</span>
          <span><span className="inline-block w-3 h-3 rounded-sm bg-rag-red/50 align-middle mr-1" />&gt;100% eccesso</span>
        </div>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="sticky left-0 bg-surface-2 z-10 text-left px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider w-44">
                  Risorsa
                </th>
                {data.weeks.map((w) => (
                  <th key={w} className="text-center px-3 py-3 text-xs text-text-muted font-medium uppercase tracking-wider min-w-[64px]">
                    {fmtWeek(w)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.resources.map((r) => (
                <tr key={r.resource_id} className="border-b border-border/50">
                  <td className="sticky left-0 bg-surface z-10 px-4 py-2">
                    <p className="font-medium text-text-primary text-sm">{r.name}</p>
                    <p className="text-text-dim text-xs">{r.role}</p>
                  </td>
                  {r.cells.map((c) => (
                    <td key={c.week_start} className="px-2 py-2 text-center">
                      {c.total_fte === 0 ? (
                        <span className="text-text-dim text-xs">—</span>
                      ) : (
                        <span className={`inline-block min-w-[40px] rounded-md px-2 py-1 text-xs font-semibold ${BAND_STYLE[c.band]}`}>
                          {Math.round(c.total_fte * 100)}%
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
