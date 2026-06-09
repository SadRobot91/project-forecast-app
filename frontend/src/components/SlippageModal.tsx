import { useState } from 'react';
import { postSlippage } from '../api/knowledge';

interface Props {
  projectId: number;
  phaseId?: number;
  phaseName?: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function SlippageModal({ projectId, phaseId, phaseName, onClose, onSaved }: Props) {
  const [expected, setExpected] = useState<boolean | null>(null);
  const [cause, setCause] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (expected === null) return;
    setLoading(true);
    setError(null);
    try {
      await postSlippage(projectId, {
        expected,
        cause: cause.trim() || undefined,
        phase_id: phaseId,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-border rounded-2xl shadow-card p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-lg font-bold text-text-primary mb-1">
          Registra slittamento{phaseName ? ` — ${phaseName}` : ''}
        </h2>

        <div className="mt-4 space-y-4">
          <div>
            <p className="text-sm text-text-muted mb-2">Tipo di slittamento *</p>
            <div className="flex gap-3">
              {[
                { value: true,  label: 'Atteso' },
                { value: false, label: 'Inatteso' },
              ].map(({ value, label }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="expected"
                    checked={expected === value}
                    onChange={() => setExpected(value)}
                    className="accent-[#6c63ff]"
                  />
                  <span className="text-sm text-text-primary">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Causa (opzionale)</label>
            <textarea
              value={cause}
              onChange={(e) => setCause(e.target.value)}
              placeholder="Descrivi brevemente la causa del ritardo…"
              rows={3}
              className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
            />
          </div>

          {error && (
            <p className="text-rag-red text-xs">{error}</p>
          )}
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted bg-base border border-border hover:border-text-dim transition-colors disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={expected === null || loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent hover:bg-accent/90 text-white shadow-glow-accent transition-all disabled:opacity-50"
          >
            {loading ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}
