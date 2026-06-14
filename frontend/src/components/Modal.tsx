import { useEffect, useId, useRef, type ReactNode } from 'react';

type ModalSize = 'md' | 'lg';

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  size?: ModalSize;
  closeDisabled?: boolean;
  showCloseButton?: boolean;
}

const SIZE_CLS: Record<ModalSize, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export default function Modal({
  title, onClose, children, size = 'md', closeDisabled = false, showCloseButton = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !closeDisabled) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, closeDisabled]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => { if (!closeDisabled) onClose(); }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative bg-surface border border-border rounded-2xl shadow-card p-6 w-full ${SIZE_CLS[size]} mx-4 animate-modal-in focus:outline-none max-h-[85vh] overflow-y-auto`}
      >
        <h2 id={titleId} className="text-lg font-bold text-text-primary">{title}</h2>
        {showCloseButton && (
          <button
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Chiudi"
            className="absolute top-4 right-4 text-text-dim hover:text-text-muted text-lg disabled:opacity-40 transition-colors"
          >
            ✕
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
