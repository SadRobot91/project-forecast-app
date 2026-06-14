import { fmtDayMonth } from '../../utils/dates';
import { WEEK_PX, TODAY, toPx, spanPx, statusBg } from './config';
import type { GanttPhaseData, GanttTask } from '../../types';

export function WeekGrid({ weeks, totalWidth, projectStart }: { weeks: string[]; totalWidth: number; projectStart: string }) {
  const todayPx = toPx(projectStart, TODAY);
  return (
    <>
      {weeks.map((w, i) => (
        <div key={w} className="absolute top-0 bottom-0 border-r border-border/20" style={{ left: i * WEEK_PX, width: WEEK_PX }} />
      ))}
      {TODAY >= projectStart && todayPx <= totalWidth && (
        <div className="absolute top-0 bottom-0 w-px bg-accent/60 z-10" style={{ left: todayPx }} />
      )}
    </>
  );
}

export function PhaseBar({ phase, projectStart }: { phase: GanttPhaseData; projectStart: string }) {
  if (!phase.planned_start || !phase.planned_end) return null;
  const left = toPx(projectStart, phase.planned_start);
  const width = spanPx(phase.planned_start, phase.planned_end);
  return (
    <div
      className={`absolute top-3.5 h-5 rounded-md ${statusBg(phase.status)} opacity-80 flex items-center px-2 overflow-hidden`}
      style={{ left, width }}
    >
      {width > 60 && (
        <span className="text-white text-xs font-medium truncate">
          {fmtDayMonth(phase.planned_start)} → {fmtDayMonth(phase.planned_end)}
        </span>
      )}
    </div>
  );
}

export function TaskBar({ task, projectStart }: { task: GanttTask; projectStart: string }) {
  if (task.is_milestone) {
    const left = toPx(projectStart, task.start_date);
    return (
      <div
        className="absolute top-1/2 -translate-y-1/2 text-milestone select-none z-10 text-base"
        style={{ left: left - 6 }}
        title={`${task.name} — pianificato: ${fmtDayMonth(task.start_date)}`}
      >◆</div>
    );
  }
  const left = toPx(projectStart, task.start_date);
  const width = spanPx(task.start_date, task.end_date);
  return (
    <div
      className={`absolute top-3 h-5 rounded ${statusBg(task.status)} opacity-80 flex items-center px-1.5 overflow-hidden`}
      style={{ left, width }}
    >
      {width > 50 && <span className="text-white text-xs truncate">{task.name}</span>}
    </div>
  );
}
