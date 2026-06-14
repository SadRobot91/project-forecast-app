import { useState } from 'react';
import Modal from '../../components/Modal';
import DateInput from '../../components/DateInput';
import { updateTask, createTask, deleteTask, type TaskPayload } from '../../api/gantt';
import { fmtDayMonth } from '../../utils/dates';
import { STATUS_LABEL } from './config';
import type { TaskStatus } from '../../types';

export interface ModalState {
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

export default function TaskModal({ state, projectId, onClose, onSaved }: TaskModalProps) {
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
      setError(`La data di inizio non può precedere l'inizio della fase (${fmtDayMonth(form.phaseStart)}).`); return;
    }
    if (form.phaseEnd && effectiveEnd > form.phaseEnd) {
      setError(`La data di fine non può superare la fine della fase (${fmtDayMonth(form.phaseEnd)}).`); return;
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
    <Modal
      title={form.mode === 'edit' ? 'Modifica task' : `Aggiungi task — ${form.phaseName}`}
      onClose={onClose}
      closeDisabled={saving || deleting}
    >
      <div className="space-y-4 mt-4">
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
          <span className="text-sm text-text-muted">È una milestone <span className="text-milestone">◆</span></span>
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
            Fase: {form.phaseStart ? fmtDayMonth(form.phaseStart) : '?'} → {form.phaseEnd ? fmtDayMonth(form.phaseEnd) : '?'}
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

      </div>
    </Modal>
  );
}
