import { useState } from 'react';
import { postRetrospective } from '../api/knowledge';

interface Props {
  projectId: number;
  onClose: () => void;
}

const QUESTIONS = [
  {
    question: 'Cosa ha funzionato bene?',
    placeholder: 'Team, processi, decisioni tecniche…',
  },
  {
    question: 'Cosa ha sorpreso o causato slittamenti?',
    placeholder: 'Rischi non previsti, dipendenze…',
  },
  {
    question: 'Cosa faresti diversamente?',
    placeholder: 'Miglioramenti per il prossimo progetto…',
  },
];

export default function RetrospectiveModal({ projectId, onClose }: Props) {
  const [answers, setAnswers] = useState<string[]>(QUESTIONS.map(() => ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateAnswer(idx: number, value: string) {
    setAnswers((prev) => prev.map((a, i) => (i === idx ? value : a)));
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const entries = QUESTIONS
        .map((q, i) => ({ question: q.question, answer: answers[i].trim() }))
        .filter((e) => e.answer.length > 0);

      if (entries.length > 0) {
        await Promise.all(
          entries.map((e) =>
            postRetrospective(projectId, { question: e.question, answer: e.answer })
          )
        );
      }
      onClose();
    } catch {
      setError('Errore nel salvataggio. Controlla la connessione e riprova.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-border rounded-2xl shadow-card p-6 w-full max-w-lg mx-4 overflow-y-auto max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-lg font-bold text-text-primary mb-1">Retrospettiva di chiusura</h2>
        <p className="text-sm text-text-muted mb-5">Dedica 3 minuti a documentare le lezioni apprese.</p>

        <div className="space-y-5">
          {QUESTIONS.map((q, idx) => (
            <div key={q.question}>
              <label className="block text-sm font-medium text-text-primary mb-1">{q.question}</label>
              <textarea
                value={answers[idx]}
                onChange={(e) => updateAnswer(idx, e.target.value)}
                placeholder={q.placeholder}
                rows={3}
                className="w-full bg-base border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
              />
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-rag-red mt-4">{error}</p>
        )}

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted bg-base border border-border hover:border-text-dim transition-colors disabled:opacity-50"
          >
            Salta
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent hover:bg-accent/90 text-white shadow-glow-accent transition-all disabled:opacity-50"
          >
            {loading ? 'Salvataggio…' : 'Salva e chiudi'}
          </button>
        </div>
      </div>
    </div>
  );
}
