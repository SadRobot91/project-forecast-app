import { ROW_PX, statusBg } from '../config';
import { WeekGrid, PhaseBar, TaskBar } from '../bars';
import { fmtDayMonth } from '../../../utils/dates';
import type { GanttPhaseData } from '../../../types';

export default function PhasesView({ phases, projectStart, totalWidth, weeks, labelW }: {
  phases: GanttPhaseData[]; projectStart: string; totalWidth: number; weeks: string[]; labelW: number;
}) {
  return (
    <>
      {phases.map((phase) => (
        <div key={phase.phase_id} className="flex border-b border-border/50 hover:bg-surface-2/20 transition-colors" style={{ height: ROW_PX }}>
          <div className="sticky left-0 z-20 flex items-center gap-2.5 border-r border-border px-4 bg-surface flex-shrink-0" style={{ width: labelW }}>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusBg(phase.status)}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{phase.display_name}</p>
              <p className="text-xs text-text-dim">{fmtDayMonth(phase.planned_start)} → {fmtDayMonth(phase.planned_end)}</p>
            </div>
          </div>
          <div className="relative flex-shrink-0 bg-surface" style={{ width: totalWidth, height: ROW_PX }}>
            <WeekGrid weeks={weeks} totalWidth={totalWidth} projectStart={projectStart} />
            <PhaseBar phase={phase} projectStart={projectStart} />
            {phase.tasks.filter((t) => t.is_milestone).map((t) => (
              <TaskBar key={t.id} task={t} projectStart={projectStart} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
