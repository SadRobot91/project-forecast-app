import { fmtDate, fmtDateTime } from '../../utils/dates';
import { formatCurrency } from '../../utils/formatCurrency';
import type { OngoingSnapshot } from '../../types';

const DELETE_WINDOW_MS = 24 * 60 * 60 * 1000;

function withinDeletionWindow(snapshot: OngoingSnapshot): boolean {
  return Date.now() - new Date(snapshot.created_at).getTime() < DELETE_WINDOW_MS;
}

interface SnapshotHistoryProps {
  history: OngoingSnapshot[];
  phaseLabel: (phaseId: number | null) => string;
  onDelete: (snapshot: OngoingSnapshot) => void;
}

export default function SnapshotHistory({ history, phaseLabel, onDelete }: SnapshotHistoryProps) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-card">
      <h2 className="font-semibold text-text-primary mb-4">Storico Snapshot</h2>
      {history.length === 0 ? (
        <p className="text-text-muted text-sm">Nessuno snapshot registrato.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {history.map((s) => (
            <div key={s.id} className="flex items-start justify-between py-2 border-b border-border/50 last:border-0">
              <div>
                <p className="text-sm font-medium text-text-primary">{fmtDate(s.reporting_date)}</p>
                <p className="text-xs text-text-dim">
                  {formatCurrency(s.cost_spent_to_date)} · {s.hours_spent_to_date}h · {s.working_days_used} GG usati
                </p>
              </div>
              <div className="text-right flex-shrink-0 ml-3 flex items-start gap-2">
                <div>
                  <div className="flex items-center justify-end gap-1 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      s.source === 'keyedin_api'
                        ? 'bg-accent/15 text-accent'
                        : 'bg-surface-2 text-text-muted'
                    }`}>
                      {s.source === 'keyedin_api' ? 'Keyedin' : 'Manuale'}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-surface-2 text-text-dim">
                      {phaseLabel(s.phase_id)}
                    </span>
                  </div>
                  <p className="text-xs text-text-dim mt-1">{fmtDateTime(s.created_at)}</p>
                </div>
                {withinDeletionWindow(s) && (
                  <button
                    onClick={() => onDelete(s)}
                    title="Elimina snapshot (disponibile entro 24h)"
                    className="mt-0.5 text-text-dim hover:text-rag-red transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
