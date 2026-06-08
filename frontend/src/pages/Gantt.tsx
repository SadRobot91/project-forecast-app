import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import AppNav from '../components/AppNav';
import DateInput from '../components/DateInput';
import { fetchGantt, updateTask, createTask, deleteTask, type TaskPayload } from '../api/gantt';
import type { GanttData, GanttPhaseData, GanttTask, TaskStatus } from '../types';

type GanttView = 'phases' | 'full' | 'milestones';

const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: 'Non iniziato',
  in_progress: 'In corso',
  completed:   'Completato',
};

const WEEK_PX  = 60;
const ROW_PX   = 48;
const LABEL_W  = 228;
const TODAY    = new Date().toISOString().split('T')[0];

// ─── Helpers ─────────────────────────────────

function dayDiff(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

function toPx(projectStart: string, date: string): number {
  return Math.max(0, (dayDiff(projectStart, date) / 7) * WEEK_PX);
}

function spanPx(start: string, end: string): number {
  return Math.max((Math.max(1, dayDiff(start, end)) / 7) * WEEK_PX, 6);
}

function fmtShort(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

function getWeeks(start: string, end: string): string[] {
  const weeks: string[] = [];
  const d = new Date(start);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const endD = new Date(end);
  while (d <= endD) {
    weeks.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 7);
  }
  return weeks;
}

function statusBg(status: string): string {
  if (status === 'completed') return 'bg-rag-green';
  if (status === 'in_progress') return 'bg-accent';
  return 'bg-text-dim/30';
}

// ─── Task Modal ───────────────────────────────

interface ModalState {
  mode: 'edit' | 'create';
  phaseId: number;
  phaseName: string;
  phaseStart: string;
  phaseEnd: string;
  taskId?: number;
  name: string;
  owner: string;
  start_date: string;
  end_date: string;
  status: TaskStatus;
  is_milestone: boolean;
  actual_date: string;
}

interface TaskModalProps {
  state: ModalState;
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}

function TaskModal({ state, projectId, onClose, onSaved }: TaskModalProps) {
  const [form, setForm] = useState<ModalState>(state);
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  function set(patch: Partial<ModalState>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      // milestone: force end_date = start_date
      if (patch.is_milestone && next.is_milestone) next.end_date = next.start_date;
      if (patch.start_date && next.is_milestone) next.end_date = patch.start_date;
      return next;
    });
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Il nome è obbligatorio.'); return; }
    if (!form.start_date)  { setError('La data di inizio è obbligatoria.'); return; }
    const effectiveEnd = form.is_milestone ? form.start_date : (form.end_date || form.start_date);
    if (!form.is_milestone && form.end_date && form.end_date < form.start_date) {
      setError('La data di fine deve essere ≥ data di inizio.'); return;
    }
    if (form.phaseStart && form.start_date < form.phaseStart) {
      setError(`La data di inizio non può precedere l'inizio della fase (${fmtShort(form.phaseStart)}).`); return;
    }
    if (form.phaseEnd && effectiveEnd > form.phaseEnd) {
      setError(`La data di fine non può superare la fine della fase (${fmtShort(form.phaseEnd)}).`); return;
    }
    setError('');
    setSaving(true);
    try {
      const payload: TaskPayload = {
        name:         form.name.trim(),
        owner:        form.owner.trim() || null,
        start_date:   form.start_date,
        end_date:     form.is_milestone ? form.start_date : (form.end_date || form.start_date),
        status:       form.status,
        is_milestone: form.is_milestone,
        actual_date:  form.actual_date || null,
      };
      if (form.mode === 'edit' && form.taskId !== undefined) {
        await updateTask(projectId, form.taskId, payload);
      } else {
        await createTask(projectId, { ...payload, phase_id: form.phaseId });
      }
      onSaved();
      onClose();
    } catch {
      setError('Errore durante il salvataggio.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form.taskId) return;
    setDeleting(true);
    try {
      await deleteTask(projectId, form.taskId);
      onSaved();
      onClose();
    } catch {
      setError('Errore durante l\'eliminazione.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-card p-6 w-full max-w-md mx-4 space-y-4">
        <h2 className="text-lg font-bold">
          {form.mode === 'edit' ? 'Modifica task' : `Aggiungi task — ${form.phaseName}`}
        </h2>

        {/* Name */}
        <div>
          <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">Nome *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Nome task…"
            className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </div>

        {/* Owner */}
        <div>
          <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">Owner</label>
          <input
            type="text"
            value={form.owner}
            onChange={(e) => set({ owner: e.target.value })}
            placeholder="Nome responsabile…"
            className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </div>

        {/* Is milestone */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.is_milestone}
            onChange={(e) => set({ is_milestone: e.target.checked })}
            className="accent-accent w-4 h-4"
          />
          <span className="text-sm text-text-muted">È una milestone <span className="text-orange-400">◆</span></span>
        </label>

        {/* Dates */}
        <div className={`grid gap-3 ${form.is_milestone ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <div>
            <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">
              {form.is_milestone ? 'Data pianificata *' : 'Inizio *'}
            </label>
            <DateInput
              value={form.start_date}
              min={form.phaseStart || undefined}
              max={form.phaseEnd || undefined}
              onChange={(val) => set({ start_date: val })}
              className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          {!form.is_milestone && (
            <div>
              <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">Fine *</label>
              <DateInput
                value={form.end_date}
                min={form.start_date || form.phaseStart || undefined}
                max={form.phaseEnd || undefined}
                onChange={(val) => set({ end_date: val })}
                className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
          )}
        </div>
        {(form.phaseStart || form.phaseEnd) && (
          <p className="text-xs text-text-dim -mt-2">
            Fase: {form.phaseStart ? fmtShort(form.phaseStart) : '?'} → {form.phaseEnd ? fmtShort(form.phaseEnd) : '?'}
          </p>
        )}

        {/* Actual date (milestone only) */}
        {form.is_milestone && (
          <div>
            <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">Data effettiva</label>
            <DateInput
              value={form.actual_date}
              onChange={(val) => set({ actual_date: val })}
              className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>
        )}

        {/* Status */}
        <div>
          <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">Stato</label>
          <select
            value={form.status}
            onChange={(e) => set({ status: e.target.value as TaskStatus })}
            className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          >
            {(['not_started', 'in_progress', 'completed'] as TaskStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-rag-red text-xs">{error}</p>}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {form.mode === 'edit' ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-sm text-rag-red border border-rag-red/30 hover:bg-rag-red/10 rounded-lg transition-colors disabled:opacity-50"
            >
              {deleting ? 'Elimino…' : 'Elimina'}
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-text-muted border border-border rounded-lg hover:bg-surface-2 transition-colors">
              Annulla
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-sm font-semibold bg-accent hover:bg-accent/90 disabled:opacity-50 text-white rounded-lg transition-all"
            >
              {saving ? 'Salvo…' : form.mode === 'edit' ? 'Salva' : 'Crea task'}
            </button>
          </div>
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 text-text-dim hover:text-text-muted text-lg">✕</button>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────

function WeekGrid({ weeks, totalWidth, projectStart }: { weeks: string[]; totalWidth: number; projectStart: string }) {
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

function PhaseBar({ phase, projectStart }: { phase: GanttPhaseData; projectStart: string }) {
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
          {fmtShort(phase.planned_start)} → {fmtShort(phase.planned_end)}
        </span>
      )}
    </div>
  );
}

function TaskBar({ task, projectStart }: { task: GanttTask; projectStart: string }) {
  if (task.is_milestone) {
    const left = toPx(projectStart, task.start_date);
    return (
      <div
        className="absolute top-1/2 -translate-y-1/2 text-orange-400 select-none z-10 text-base"
        style={{ left: left - 6 }}
        title={`${task.name} — pianificato: ${fmtShort(task.start_date)}`}
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

// ─── Vista Fasi ───────────────────────────────

function PhasesView({ phases, projectStart, totalWidth, weeks }: {
  phases: GanttPhaseData[]; projectStart: string; totalWidth: number; weeks: string[];
}) {
  return (
    <>
      {phases.map((phase) => (
        <div key={phase.phase_id} className="flex border-b border-border/50 hover:bg-surface-2/20 transition-colors" style={{ height: ROW_PX }}>
          <div className="sticky left-0 z-20 flex items-center gap-2.5 border-r border-border px-4 bg-surface flex-shrink-0" style={{ width: LABEL_W }}>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusBg(phase.status)}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{phase.display_name}</p>
              <p className="text-xs text-text-dim">{fmtShort(phase.planned_start)} → {fmtShort(phase.planned_end)}</p>
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

// ─── Vista Completa ───────────────────────────

function FullView({ phases, projectStart, totalWidth, weeks, collapsed, onToggle, onEditTask, onAddTask, onUpdateMilestone }: {
  phases: GanttPhaseData[]; projectStart: string; totalWidth: number; weeks: string[];
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
              <div className="sticky left-0 z-20 flex items-center gap-2 border-r border-border px-4 bg-surface-2 flex-shrink-0" style={{ width: LABEL_W }}>
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
                      style={{ width: LABEL_W, paddingLeft: 36 }}
                    >
                      {task.is_milestone
                        ? <span className="text-orange-400 flex-shrink-0 text-sm">◆</span>
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
                          title={`Effettiva: ${fmtShort(task.actual_date)}`}
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
                    style={{ width: LABEL_W, paddingLeft: 36 }}
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

// ─── Vista Milestone ──────────────────────────

function MilestoneView({ phases, projectStart, totalWidth, weeks, onUpdateMilestone }: {
  phases: GanttPhaseData[]; projectStart: string; totalWidth: number; weeks: string[];
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
          <div className="sticky left-0 z-20 flex items-center gap-2.5 border-r border-border px-4 bg-surface flex-shrink-0" style={{ width: LABEL_W }}>
            <span className="text-orange-400 flex-shrink-0">◆</span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="text-sm text-text-primary truncate">{task.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-text-dim">P: {fmtShort(task.start_date)}</span>
                {task.actual_date && (
                  <span className="text-xs text-rag-green">E: {fmtShort(task.actual_date)}</span>
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
              className="absolute top-1/2 -translate-y-1/2 text-orange-400 text-base select-none z-10"
              style={{ left: toPx(projectStart, task.start_date) - 6 }}
              title={`Pianificato: ${fmtShort(task.start_date)}`}
            >◆</div>
            {task.actual_date && (
              <div
                className="absolute top-1/2 -translate-y-1/2 text-rag-green text-base select-none z-10"
                style={{ left: toPx(projectStart, task.actual_date) - 6 }}
                title={`Effettiva: ${fmtShort(task.actual_date)}`}
              >◆</div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Main page ────────────────────────────────

const VIEWS: [GanttView, string][] = [
  ['phases',     'Vista Fasi'],
  ['full',       'Vista Completa'],
  ['milestones', 'Vista Milestone'],
];

export default function Gantt() {
  const { id: projectId } = useParams<{ id: string }>();
  const [data, setData]         = useState<GanttData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<GanttView>('phases');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [modal, setModal]       = useState<ModalState | null>(null);

  const load = useCallback(() => {
    if (!projectId) return;
    fetchGantt(projectId).then(setData).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

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
    load();
  }

  if (loading) return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <p className="text-text-muted animate-pulse">Caricamento Gantt…</p>
    </div>
  );

  if (!data) return null;

  const { project_start, project_end, phases } = data;
  const weeks      = getWeeks(project_start, project_end);
  const totalWidth = weeks.length * WEEK_PX;

  return (
    <div className="min-h-screen bg-base text-text-primary">
      <AppNav projectId={projectId} projectName={data.project_name} />

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
          <span className="flex items-center gap-1.5"><span className="text-orange-400">◆</span> Milestone pianificata</span>
          <span className="flex items-center gap-1.5"><span className="text-rag-green">◆</span> Milestone effettiva</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-px h-3 bg-accent/60" /> Oggi ({fmtShort(TODAY)})</span>
          {view === 'full' && (
            <span className="flex items-center gap-1.5 text-accent/70">Clicca su un task per modificarlo</span>
          )}
        </div>

        {/* Chart */}
        <div className="rounded-2xl border border-border overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <div style={{ minWidth: LABEL_W + totalWidth }}>

              {/* Week header */}
              <div className="flex border-b-2 border-border bg-surface-2 sticky top-0 z-30" style={{ height: 40 }}>
                <div className="sticky left-0 z-40 bg-surface-2 border-r border-border flex items-center px-4 flex-shrink-0" style={{ width: LABEL_W }}>
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
                <PhasesView phases={phases} projectStart={project_start} totalWidth={totalWidth} weeks={weeks} />
              )}
              {view === 'full' && (
                <FullView
                  phases={phases} projectStart={project_start} totalWidth={totalWidth} weeks={weeks}
                  collapsed={collapsed} onToggle={togglePhase}
                  onEditTask={openEditModal} onAddTask={openAddModal}
                  onUpdateMilestone={handleUpdateMilestone}
                />
              )}
              {view === 'milestones' && (
                <MilestoneView
                  phases={phases} projectStart={project_start} totalWidth={totalWidth} weeks={weeks}
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
          onSaved={load}
        />
      )}
    </div>
  );
}
