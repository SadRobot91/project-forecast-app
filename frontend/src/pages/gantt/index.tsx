import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSetProjectName } from '../../components/ProjectLayout';
import { useFetch } from '../../hooks/useFetch';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { fetchGantt, updateTask } from '../../api/gantt';
import { fmtDayMonth } from '../../utils/dates';
import { WEEK_PX, LABEL_W, TODAY, toPx, getWeeks } from './config';
import TaskModal, { type ModalState } from './TaskModal';
import PhasesView from './views/PhasesView';
import FullView from './views/FullView';
import MilestoneView from './views/MilestoneView';
import type { GanttData, GanttTask } from '../../types';

type GanttView = 'phases' | 'full' | 'milestones';

const VIEWS: [GanttView, string][] = [
  ['phases',     'Vista Fasi'],
  ['full',       'Vista Completa'],
  ['milestones', 'Vista Milestone'],
];

export default function Gantt() {
  const { id: projectId } = useParams<{ id: string }>();
  const setProjectName = useSetProjectName();
  const [view, setView]         = useState<GanttView>('phases');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [modal, setModal]       = useState<ModalState | null>(null);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const { data, loading, error, reload } = useFetch<GanttData>(
    () => fetchGantt(projectId!),
    [projectId],
  );

  useEffect(() => {
    if (data) setProjectName(data.project_name);
  }, [data, setProjectName]);

  function togglePhase(phaseId: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(phaseId) ? next.delete(phaseId) : next.add(phaseId);
      return next;
    });
  }

  function openEditModal(task: GanttTask, phaseName: string) {
    const phase = data?.phases.find((p) => p.phase_id === task.phase_id);
    setModal({
      mode: 'edit',
      phaseId: task.phase_id,
      phaseName,
      phaseStart: phase?.planned_start ?? '',
      phaseEnd:   phase?.planned_end   ?? '',
      taskId: task.id,
      name: task.name,
      owner: task.owner ?? '',
      start_date: task.start_date,
      end_date: task.end_date,
      status: task.status,
      is_milestone: task.is_milestone,
      actual_date: task.actual_date ?? '',
    });
  }

  function openAddModal(phaseId: number, phaseName: string) {
    const phase = data?.phases.find((p) => p.phase_id === phaseId);
    setModal({
      mode: 'create',
      phaseId,
      phaseName,
      phaseStart: phase?.planned_start ?? '',
      phaseEnd:   phase?.planned_end   ?? '',
      name: '',
      owner: '',
      start_date: phase?.planned_start ?? '',
      end_date: '',
      status: 'not_started',
      is_milestone: false,
      actual_date: '',
    });
  }

  async function handleUpdateMilestone(taskId: number, val: string) {
    if (!projectId) return;
    await updateTask(projectId, taskId, { actual_date: val || null });
    reload();
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <p className="text-text-muted animate-pulse">Caricamento Gantt…</p>
    </div>
  );

  if (error) return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="bg-rag-red/10 border border-rag-red/30 rounded-xl px-5 py-4 text-rag-red text-sm flex items-center justify-between">
        <span>{error}</span>
        <button onClick={reload} className="text-xs border border-rag-red/40 rounded-lg px-3 py-1.5 hover:bg-rag-red/10 transition-colors">
          Riprova
        </button>
      </div>
    </div>
  );

  if (!data) return null;

  const { project_start, project_end, phases } = data;
  const weeks      = getWeeks(project_start, project_end);
  const totalWidth = weeks.length * WEEK_PX;
  const labelW     = isDesktop ? LABEL_W : 140;

  return (
    <>
      <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gantt</h1>
            <p className="text-text-muted text-sm mt-1">Pianificazione fasi e task del progetto.</p>
          </div>
          <div className="flex gap-1 bg-surface border border-border rounded-xl p-1">
            {VIEWS.map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  view === v
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
                }`}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-5 text-xs text-text-muted">
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-rag-green" /> Completato</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-accent" /> In corso</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-text-dim/30" /> Non iniziato</span>
          <span className="flex items-center gap-1.5"><span className="text-milestone">◆</span> Milestone pianificata</span>
          <span className="flex items-center gap-1.5"><span className="text-rag-green">◆</span> Milestone effettiva</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-px h-3 bg-accent/60" /> Oggi ({fmtDayMonth(TODAY)})</span>
          {view === 'full' && (
            <span className="flex items-center gap-1.5 text-accent/70">Clicca su un task per modificarlo</span>
          )}
        </div>

        {/* Chart */}
        <div className="rounded-2xl border border-border overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <div style={{ minWidth: labelW + totalWidth }}>

              {/* Week header */}
              <div className="flex border-b-2 border-border bg-surface-2 sticky top-0 z-30" style={{ height: 40 }}>
                <div className="sticky left-0 z-40 bg-surface-2 border-r border-border flex items-center px-4 flex-shrink-0" style={{ width: labelW }}>
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Fase / Task</span>
                </div>
                <div className="relative flex-shrink-0" style={{ width: totalWidth }}>
                  {weeks.map((w, i) => (
                    <div
                      key={w}
                      className="absolute top-0 bottom-0 flex items-center border-r border-border/30"
                      style={{ left: i * WEEK_PX, width: WEEK_PX }}
                    >
                      <span className="text-xs text-text-dim px-1.5 truncate">
                        {new Date(w).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  ))}
                  {TODAY >= project_start && toPx(project_start, TODAY) <= totalWidth && (
                    <div className="absolute top-0 bottom-0 w-px bg-accent/60" style={{ left: toPx(project_start, TODAY) }} />
                  )}
                </div>
              </div>

              {/* Body */}
              {view === 'phases' && (
                <PhasesView phases={phases} projectStart={project_start} totalWidth={totalWidth} weeks={weeks} labelW={labelW} />
              )}
              {view === 'full' && (
                <FullView
                  phases={phases} projectStart={project_start} totalWidth={totalWidth} weeks={weeks} labelW={labelW}
                  collapsed={collapsed} onToggle={togglePhase}
                  onEditTask={openEditModal} onAddTask={openAddModal}
                  onUpdateMilestone={handleUpdateMilestone}
                />
              )}
              {view === 'milestones' && (
                <MilestoneView
                  phases={phases} projectStart={project_start} totalWidth={totalWidth} weeks={weeks} labelW={labelW}
                  onUpdateMilestone={handleUpdateMilestone}
                />
              )}

            </div>
          </div>
        </div>

      </main>

      {modal && projectId && (
        <TaskModal
          state={modal}
          projectId={projectId}
          onClose={() => setModal(null)}
          onSaved={reload}
        />
      )}
    </>
  );
}
