interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmModal({
  title, message, confirmLabel = 'Conferma', confirmDanger = false,
  onConfirm, onCancel, loading = false,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-surface border border-border rounded-2xl shadow-card p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-lg font-bold text-text-primary mb-2">{title}</h2>
        <p className="text-text-muted text-sm leading-relaxed mb-6">{message}</p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted bg-base border border-border hover:border-text-dim transition-colors disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${
              confirmDanger
                ? 'bg-rag-red hover:bg-rag-red/90 text-white'
                : 'bg-accent hover:bg-accent/90 text-white shadow-glow-accent'
            }`}
          >
            {loading ? 'In corso…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
