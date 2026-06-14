import DateInput from '../../../components/DateInput';
import { ROW_PX, toPx } from '../config';
import { WeekGrid } from '../bars';
import { fmtDayMonth } from '../../../utils/dates';
import type { GanttPhaseData } from '../../../types';

export default function MilestoneView({ phases, projectStart, totalWidth, weeks, labelW, onUpdateMilestone }: {
  phases: GanttPhaseData[]; projectStart: string; totalWidth: number; weeks: string[]; labelW: number;
  onUpdateMilestone: (taskId: number, val: string) => Promise<void>;
}) {
  const milestones = phases.flatMap((p) =>
    p.tasks.filter((t) => t.is_milestone).map((t) => ({ ...t, _phaseName: p.display_name }))
  );

  if (milestones.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-text-muted text-sm">
        Nessuna milestone definita.
      </div>
    );
  }

  return (
    <>
      {milestones.map((task) => (
        <div key={task.id} className="flex border-b border-border/50 hover:bg-surface-2/20 transition-colors" style={{ height: ROW_PX }}>
          <div className="sticky left-0 z-20 flex items-center gap-2.5 border-r border-border px-4 bg-surface flex-shrink-0" style={{ width: labelW }}>
            <span className="text-milestone flex-shrink-0">◆</span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="text-sm text-text-primary truncate">{task.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-text-dim">P: {fmtDayMonth(task.start_date)}</span>
                {task.actual_date && (
                  <span className="text-xs text-rag-green">E: {fmtDayMonth(task.actual_date)}</span>
                )}
              </div>
            </div>
            <DateInput
              value={task.actual_date ?? ''}
              title="Data effettiva"
              onChange={(val) => onUpdateMilestone(task.id, val)}
              className="w-24 flex-shrink-0 text-xs bg-base border border-border rounded px-1 py-0.5 text-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          <div className="relative flex-shrink-0 bg-surface" style={{ width: totalWidth, height: ROW_PX }}>
            <WeekGrid weeks={weeks} totalWidth={totalWidth} projectStart={projectStart} />
            <div
              className="absolute top-1/2 -translate-y-1/2 text-milestone text-base select-none z-10"
              style={{ left: toPx(projectStart, task.start_date) - 6 }}
              title={`Pianificato: ${fmtDayMonth(task.start_date)}`}
            >◆</div>
            {task.actual_date && (
              <div
                className="absolute top-1/2 -translate-y-1/2 text-rag-green text-base select-none z-10"
                style={{ left: toPx(projectStart, task.actual_date) - 6 }}
                title={`Effettiva: ${fmtDayMonth(task.actual_date)}`}
              >◆</div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
