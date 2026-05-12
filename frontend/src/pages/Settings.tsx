import { useEffect, useState } from 'react';
import AppNav from '../components/AppNav';
import ConfirmModal from '../components/ConfirmModal';
import {
  fetchPhaseTemplates,
  updatePhaseTemplate,
  createPhaseTemplate,
  deletePhaseTemplate,
} from '../api/phaseTemplates';
import type { PhaseTemplate } from '../types';

export default function Settings() {
  const [templates, setTemplates] = useState<PhaseTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // inline edit state
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingContingency, setEditingContingency] = useState('');

  // new phase form
  const [newName, setNewName]     = useState('');
  const [adding, setAdding]       = useState(false);

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState<PhaseTemplate | null>(null);
  const [deleting, setDeleting]         = useState(false);

  function load() {
    fetchPhaseTemplates()
      .then((t) => setTemplates(t.sort((a, b) => a.order - b.order)))
      .catch(() => setError('Errore nel caricamento dei template.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function startEdit(t: PhaseTemplate) {
    setEditingId(t.id);
    setEditingName(t.display_name);
    setEditingContingency(String(t.default_contingency_pct));
  }

  async function commitEdit(id: number) {
    const name = editingName.trim();
    const pct  = parseFloat(editingContingency);
    if (!name) { setEditingId(null); return; }
    try {
      const updated = await updatePhaseTemplate(id, {
        display_name:            name,
        default_contingency_pct: isNaN(pct) ? 0 : pct,
      });
      setTemplates((prev) => prev.map((t) => t.id === id ? updated : t));
    } catch {
      setError('Errore durante il salvataggio.');
    } finally {
      setEditingId(null);
    }
  }

  async function movePhase(id: number, direction: -1 | 1) {
    const sorted = [...templates].sort((a, b) => a.order - b.order);
    const idx    = sorted.findIndex((t) => t.id === id);
    const target = sorted[idx + direction];
    if (!target) return;
    try {
      const [a, b] = await Promise.all([
        updatePhaseTemplate(id,        { order: target.order }),
        updatePhaseTemplate(target.id, { order: sorted[idx].order }),
      ]);
      setTemplates((prev) =>
        prev.map((t) => t.id === a.id ? a : t.id === b.id ? b : t)
            .sort((a, b) => a.order - b.order)
      );
    } catch {
      setError('Errore nel riordino.');
    }
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const maxOrder = templates.reduce((m, t) => Math.max(m, t.order), 0);
      const created  = await createPhaseTemplate(name, maxOrder + 1);
      setTemplates((prev) => [...prev, created].sort((a, b) => a.order - b.order));
      setNewName('');
    } catch {
      setError('Errore durante la creazione.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePhaseTemplate(deleteTarget.id);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setError('Errore durante la cancellazione.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <p className="text-text-muted animate-pulse">Caricamento impostazioni…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-base text-text-primary">
      <AppNav />

      {deleteTarget && (
        <ConfirmModal
          title="Elimina fase"
          message={`Stai per eliminare la fase "${deleteTarget.display_name}" dal template. I progetti esistenti non saranno modificati. Continuare?`}
          confirmLabel="Elimina"
          confirmDanger
          loading={deleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Impostazioni</h1>
          <p className="text-text-muted text-sm mt-1">Configura le fasi di default per i nuovi progetti.</p>
        </div>

        {error && (
          <div className="bg-rag-red/10 border border-rag-red/30 rounded-xl px-5 py-3 text-rag-red text-sm">
            {error}
          </div>
        )}

        {/* Phase template table */}
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-text-primary">Fasi di progetto</h2>
            <p className="text-text-muted text-xs mt-0.5">
              Rinomina, riordina o rimuovi le fasi. Puoi impostare una contingenza di default per fase.
            </p>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="text-left text-text-muted font-medium px-4 py-3 text-xs uppercase tracking-wider w-8">#</th>
                <th className="text-left text-text-muted font-medium px-4 py-3 text-xs uppercase tracking-wider">Nome fase</th>
                <th className="text-left text-text-muted font-medium px-4 py-3 text-xs uppercase tracking-wider w-36">Contingenza %</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {templates.map((t, idx) => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-surface-2/30 transition-colors">
                  <td className="px-4 py-3 text-text-dim text-xs">{t.order}</td>
                  <td className="px-4 py-3">
                    {editingId === t.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => commitEdit(t.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(t.id); if (e.key === 'Escape') setEditingId(null); }}
                        className="bg-base border border-accent/40 text-text-primary rounded px-2 py-1 text-sm w-48 focus:outline-none focus:border-accent"
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(t)}
                        className="group flex items-center gap-1.5 font-medium text-text-primary hover:text-accent transition-colors"
                        title="Clicca per rinominare"
                      >
                        {t.display_name}
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === t.id ? (
                      <input
                        type="number" min={0} max={100}
                        value={editingContingency}
                        onChange={(e) => setEditingContingency(e.target.value)}
                        className="bg-base border border-accent/40 text-text-primary rounded px-2 py-1 text-sm w-20 text-center focus:outline-none focus:border-accent"
                      />
                    ) : (
                      <span className="text-text-muted">{t.default_contingency_pct}%</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => movePhase(t.id, -1)}
                        disabled={idx === 0}
                        className="p-1 text-text-dim hover:text-text-primary disabled:opacity-20 transition-colors"
                        title="Sposta su"
                      >↑</button>
                      <button
                        onClick={() => movePhase(t.id, 1)}
                        disabled={idx === templates.length - 1}
                        className="p-1 text-text-dim hover:text-text-primary disabled:opacity-20 transition-colors"
                        title="Sposta giù"
                      >↓</button>
                      <button
                        onClick={() => setDeleteTarget(t)}
                        className="p-1 text-text-dim hover:text-rag-red transition-colors"
                        title="Elimina fase"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Add new phase */}
          <div className="px-5 py-4 border-t border-border flex items-center gap-3">
            <input
              type="text"
              placeholder="Nome nuova fase…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              className="flex-1 bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent hover:bg-accent/90 disabled:opacity-50 text-white transition-all"
            >
              {adding ? 'Aggiunta…' : '＋ Aggiungi'}
            </button>
          </div>
        </div>

        <p className="text-text-dim text-xs">
          Le modifiche al template si applicano solo ai <strong>nuovi progetti</strong>. I progetti esistenti mantengono le loro fasi — rinominale direttamente in Baseline.
        </p>
      </main>
    </div>
  );
}
