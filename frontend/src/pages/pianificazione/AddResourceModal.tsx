import { useState } from 'react';
import Modal from '../../components/Modal';
import { formatCurrency } from '../../utils/formatCurrency';
import type { Resource } from '../../types';

interface AddResourceModalProps {
  available: Resource[];
  onAdd: (r: Resource) => void;
  onClose: () => void;
  onCreateNew: (name: string, role: string, dayRate: number) => Promise<void>;
}

export default function AddResourceModal({ available, onAdd, onClose, onCreateNew }: AddResourceModalProps) {
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newRate, setNewRate] = useState('');
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'existing' | 'new'>('existing');

  async function handleCreate() {
    if (!newName || !newRate) return;
    setCreating(true);
    try { await onCreateNew(newName, newRole, parseFloat(newRate)); onClose(); }
    finally { setCreating(false); }
  }

  return (
    <Modal title="Aggiungi Risorsa" onClose={onClose} closeDisabled={creating}>
      <div className="mt-4">
        <div className="flex gap-2 mb-4">
          {(['existing', 'new'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t ? 'bg-accent/20 text-accent border border-accent/30' : 'text-text-muted hover:bg-surface-2'}`}>
              {t === 'existing' ? 'Dal registro' : 'Nuova risorsa'}
            </button>
          ))}
        </div>
        {tab === 'existing' ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {available.length === 0 && <p className="text-text-muted text-sm">Tutte le risorse sono già allocate in questa fase.</p>}
            {available.map((r) => (
              <button key={r.id} onClick={() => { onAdd(r); onClose(); }}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:border-accent/50 hover:bg-surface-2 transition-all text-left">
                <div>
                  <p className="font-medium text-text-primary text-sm">{r.name}</p>
                  <p className="text-text-dim text-xs">{r.role}</p>
                </div>
                <span className="text-accent text-sm font-medium">{formatCurrency(r.day_rate)}/gg</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <input type="text" placeholder="Nome *" value={newName} onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent" />
            <input type="text" placeholder="Ruolo" value={newRole} onChange={(e) => setNewRole(e.target.value)}
              className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent" />
            <input type="number" placeholder="Day Rate £ *" value={newRate} onChange={(e) => setNewRate(e.target.value)}
              className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent" />
            <button onClick={handleCreate} disabled={creating || !newName || !newRate}
              className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-all">
              {creating ? 'Creazione…' : 'Crea e aggiungi'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
