import Modal from './Modal';

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
    <Modal title={title} onClose={onCancel} closeDisabled={loading} showCloseButton={false}>
      <p className="text-text-muted text-sm leading-relaxed mt-2 mb-6">{message}</p>

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
    </Modal>
  );
}
