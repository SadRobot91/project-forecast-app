import DateInput from '../../../components/DateInput';
import { ROW_PX, toPx, statusBg } from '../config';
import { WeekGrid, PhaseBar, TaskBar } from '../bars';
import { fmtDayMonth } from '../../../utils/dates';
import type { GanttPhaseData, GanttTask } from '../../../types';

export default function FullView({ phases, projectStart, totalWidth, weeks, labelW, collapsed, onToggle, onEditTask, onAddTask, onUpdateMilestone }: {
  phases: GanttPhaseData[]; projectStart: string; totalWidth: number; weeks: string[]; labelW: number;
  collapsed: Set<number>; onToggle: (id: number) => void;
  onEditTask: (task: GanttTask, phaseName: string) => void;
  onAddTask: (phaseId: number, phaseName: string) => void;
  onUpdateMilestone: (taskId: number, val: string) => Promise<void>;
}) {
  return (
    <>
      {phases.map((phase) => {
        const isCollapsed = collapsed.has(phase.phase_id);
        return (
          <div key={phase.phase_id}>
            {/* Phase header */}
            <div
              className="flex border-b border-border bg-surface-2 cursor-pointer hover:bg-surface-3/20 transition-colors"
              style={{ height: ROW_PX }}
              onClick={() => onToggle(phase.phase_id)}
            >
              <div className="sticky left-0 z-20 flex items-center gap-2 border-r border-border px-4 bg-surface-2 flex-shrink-0" style={{ width: labelW }}>
                <span className="text-text-dim text-xs flex-shrink-0">{isCollapsed ? '▶' : '▼'}</span>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusBg(phase.status)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary truncate">{phase.display_name}</p>
                  <p className="text-xs text-text-dim">{phase.tasks.length} task</p>
                </div>
              </div>
              <div className="relative flex-shrink-0 bg-surface-2" style={{ width: totalWidth, height: ROW_PX }}>
                <WeekGrid weeks={weeks} totalWidth={totalWidth} projectStart={projectStart} />
                <PhaseBar phase={phase} projectStart={projectStart} />
              </div>
            </div>

            {/* Task rows */}
            {!isCollapsed && (
              <>
                {phase.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex border-b border-border/40 bg-surface hover:bg-surface-2/30 transition-colors cursor-pointer"
                    style={{ height: ROW_PX }}
                    onClick={() => onEditTask(task, phase.display_name)}
                  >
                    <div
                      className="sticky left-0 z-20 flex items-center gap-2 border-r border-border/60 bg-surface flex-shrink-0 pr-2"
                      style={{ width: labelW, paddingLeft: 36 }}
                    >
                      {task.is_milestone
                        ? <span className="text-milestone flex-shrink-0 text-sm">◆</span>
                        : <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusBg(task.status)}`} />
                      }
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="text-xs text-text-muted truncate">{task.name}</p>
                        {task.owner && <p className="text-xs text-text-dim truncate">{task.owner}</p>}
                      </div>
                      {task.is_milestone && (
                        <DateInput
                          value={task.actual_date ?? ''}
                          title="Data effettiva"
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          onChange={(val) => onUpdateMilestone(task.id, val)}
                          className="w-24 flex-shrink-0 text-xs bg-base border border-border rounded px-1 py-0.5 text-text-muted focus:outline-none focus:border-accent"
                        />
                      )}
                    </div>
                    <div className="relative flex-shrink-0 bg-surface" style={{ width: totalWidth, height: ROW_PX }}>
                      <WeekGrid weeks={weeks} totalWidth={totalWidth} projectStart={projectStart} />
                      <TaskBar task={task} projectStart={projectStart} />
                      {task.is_milestone && task.actual_date && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 text-rag-green text-base select-none"
                          style={{ left: toPx(projectStart, task.actual_date) - 6 }}
                          title={`Effettiva: ${fmtDayMonth(task.actual_date)}`}
                        >◆</div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add task row */}
                <div
                  className="flex border-b border-border/30 bg-surface/60 hover:bg-surface-2/20 transition-colors cursor-pointer"
                  style={{ height: 36 }}
                  onClick={(e) => { e.stopPropagation(); onAddTask(phase.phase_id, phase.display_name); }}
                >
                  <div
                    className="sticky left-0 z-20 flex items-center gap-1.5 border-r border-border/40 bg-surface/60 flex-shrink-0 text-text-dim hover:text-accent transition-colors"
                    style={{ width: labelW, paddingLeft: 36 }}
                  >
                    <span className="text-sm">＋</span>
                    <span className="text-xs">Aggiungi task</span>
                  </div>
                  <div className="flex-shrink-0" style={{ width: totalWidth }} />
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
