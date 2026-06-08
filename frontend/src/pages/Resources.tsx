import { useEffect, useState } from 'react';
import AppNav from '../components/AppNav';
import { fetchResourceRegistry } from '../api/allocation';
import { fmtWeek } from '../utils/networkDays';
import type { ResourceRegistryData, ResourceRegistryRow } from '../types';
import { formatCurrency } from '../utils/formatCurrency';

function fteSemaphore(total: number): { icon: string; class: string } {
  if (total === 0)     return { icon: '⚪', class: 'text-text-dim' };
  if (total > 1.0)     return { icon: '🔴', class: 'text-rag-red font-bold' };
  if (total >= 0.8)    return { icon: '✅', class: 'text-rag-green' };
  return               { icon: '🟡', class: 'text-rag-yellow' };
}

function fmtFTE(n: number) {
  return n === 0 ? '—' : `${(n * 100).toFixed(0)}%`;
}

interface ResourceRowProps {
  row: ResourceRegistryRow;
  weeks: string[];
  filterProject: string;
  getTotal: (week: string) => number;
}

function ResourceRow({ row, weeks, filterProject, getTotal }: ResourceRowProps) {
  const [expanded, setExpanded] = useState(true);

  // Group allocations by project then month
  const projects = Array.from(new Set(row.allocations.map((a) => a.project_name)));
  const filteredProjects = filterProject
    ? projects.filter((p) => p === filterProject)
    : projects;

  return (
    <tbody>
      {/* Resource header row */}
      <tr className="bg-surface-2 border-b border-border cursor-pointer hover:bg-surface-3/40 transition-colors" onClick={() => setExpanded((o) => !o)}>
        <td className="sticky left-0 bg-surface-2 z-10 px-4 py-3" colSpan={2}>
          <div className="flex items-center gap-2">
            <span className="text-text-dim text-xs">{expanded ? '▼' : '▶'}</span>
            <div>
              <p className="font-semibold text-text-primary">{row.resource.name}</p>
              <p className="text-text-dim text-xs">{row.resource.role} · {formatCurrency(row.resource.day_rate)}/gg</p>
            </div>
          </div>
        </td>
        {weeks.map((w) => {
          const total = getTotal(w);
          const { icon, class: cls } = fteSemaphore(total);
          return (
            <td key={w} className="px-3 py-3 text-center">
              <div className={`text-sm font-semibold ${cls}`}>
                {fmtFTE(total)}
              </div>
              <div className="text-xs">{icon}</div>
            </td>
          );
        })}
      </tr>

      {/* Project sub-rows */}
      {expanded && filteredProjects.map((projectName) => (
        <tr key={projectName} className="border-b border-border/50 hover:bg-surface-2/30 transition-colors">
          <td className="sticky left-0 bg-surface z-10 px-4 py-2 pl-10 text-text-dim text-xs" />
          <td className="px-4 py-2 text-text-muted text-xs">{projectName}</td>
          {weeks.map((w) => {
            const alloc = row.allocations.find((a) => a.project_name === projectName && a.week_start === w);
            const fte = alloc?.fte ?? 0;
            return (
              <td key={w} className="px-3 py-2 text-center text-xs text-text-muted">
                {fte === 0 ? <span className="text-text-dim">—</span> : `${(fte * 100).toFixed(0)}%`}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );
}

export default function Resources() {
  const [data, setData] = useState<ResourceRegistryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterResource, setFilterResource] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    fetchResourceRegistry().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <p className="text-text-muted animate-pulse">Caricamento registro…</p>
    </div>
  );

  if (!data) return null;

  // Filter allocations by closed status
  const visibleRows = data.rows.map((r) => ({
    ...r,
    allocations: r.allocations.filter((a) =>
      showClosed || (a.project_status !== 'closed' && a.project_status !== 'archived')
    ),
  })).filter((r) => r.allocations.length > 0 || !filterResource);

  // Weeks visible given current showClosed filter
  const visibleWeekSet = new Set(visibleRows.flatMap((r) => r.allocations.map((a) => a.week_start)));
  const visibleWeeks = data.weeks.filter((w) => visibleWeekSet.has(w));

  const allProjects = Array.from(new Set(visibleRows.flatMap((r) => r.allocations.map((a) => a.project_name))));
  const allResourceNames = data.rows.map((r) => r.resource.name);

  // BUG-05: compute visible total from filtered allocations, not pre-computed totals
  function getVisibleTotal(row: typeof visibleRows[number], week: string): number {
    return row.allocations.filter(a => a.week_start === week).reduce((s, a) => s + a.fte, 0);
  }

  const overallocated = visibleRows.filter((r) =>
    visibleWeeks.some((w) => getVisibleTotal(r, w) > 1.0)
  );

  const filteredRows = visibleRows.filter((r) => {
    if (filterResource && r.resource.name !== filterResource) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-base text-text-primary">
      <AppNav />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registro Risorse</h1>
          <p className="text-text-muted text-sm mt-1">
            Vista aggregata delle allocazioni cross-project. Si aggiorna automaticamente quando le allocazioni vengono salvate.
          </p>
        </div>

        {/* Overallocation alerts */}
        {overallocated.length > 0 && (
          <div className="bg-rag-red/10 border border-rag-red/30 rounded-2xl p-4">
            <p className="text-rag-red font-semibold text-sm mb-2">⚠️ Sovrallocazione rilevata</p>
            <ul className="space-y-1">
              {overallocated.map((r) => {
                const badWeeks = visibleWeeks
                  .filter((w) => getVisibleTotal(r, w) > 1.0)
                  .map((w) => fmtWeek(w));
                return (
                  <li key={r.resource.id} className="text-rag-red/80 text-sm">
                    {r.resource.name}: {badWeeks.join(', ')} — FTE &gt; 100%
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={filterResource}
            onChange={(e) => setFilterResource(e.target.value)}
            className="bg-surface border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          >
            <option value="">Tutte le risorse</option>
            {allResourceNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="bg-surface border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          >
            <option value="">Tutti i progetti</option>
            {allProjects.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button
            onClick={() => setShowClosed((v) => !v)}
            className={`px-3 py-2 text-sm border rounded-lg transition-colors ${
              showClosed
                ? 'border-accent/40 text-accent bg-accent/10'
                : 'border-border text-text-muted hover:text-text-primary'
            }`}
          >
            {showClosed ? '✓ Progetti chiusi visibili' : 'Mostra progetti chiusi'}
          </button>
          {(filterResource || filterProject) && (
            <button
              onClick={() => { setFilterResource(''); setFilterProject(''); }}
              className="px-3 py-2 text-sm text-text-muted hover:text-text-primary border border-border rounded-lg transition-colors"
            >
              ✕ Reset filtri
            </button>
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-text-muted">
          <span>⚪ 0% non allocato</span>
          <span>🟡 1–79% sottoutilizzo</span>
          <span>✅ 80–100% ottimale</span>
          <span>🔴 &gt;100% sovrallocazione</span>
        </div>

        {/* Table */}
        <div className="relative rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="sticky left-0 bg-surface-2 z-10 text-left px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider w-40">Risorsa</th>
                  <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider w-40">Progetto</th>
                  {visibleWeeks.map((w) => (
                    <th key={w} className="text-center px-3 py-3 text-xs text-text-muted font-medium uppercase tracking-wider min-w-[72px]">
                      {fmtWeek(w)}
                    </th>
                  ))}
                </tr>
              </thead>
              {filteredRows.map((row) => (
                <ResourceRow
                  key={row.resource.id}
                  row={row}
                  weeks={visibleWeeks}
                  filterProject={filterProject}
                  getTotal={(w) => getVisibleTotal(row, w)}
                />
              ))}
            </table>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent" />
        </div>

        {filteredRows.length === 0 && (
          <p className="text-text-muted text-center py-8">Nessuna risorsa trovata per i filtri selezionati.</p>
        )}
      </main>
    </div>
  );
}
