import { useEffect, useState } from 'react';
import Modal from './Modal';
import Alert from './Alert';
import { postRetrospective } from '../api/knowledge';
import { fetchRetroQuestions } from '../api/intelligence';

interface Props {
  projectId: number;
  onClose: () => void;
}

interface RetroQuestion {
  question: string;
  placeholder: string;
}

const STATIC_QUESTIONS: RetroQuestion[] = [
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
  const [questions, setQuestions] = useState<RetroQuestion[]>(STATIC_QUESTIONS);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [answers, setAnswers] = useState<string[]>(STATIC_QUESTIONS.map(() => ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pull tailored AI questions on open. Empty result (NoOp provider / no signal)
  // leaves the static fallback set in place — never breaks the modal. (M-004)
  useEffect(() => {
    let cancelled = false;
    fetchRetroQuestions(projectId)
      .then((res) => {
        if (cancelled || !res.questions || res.questions.length === 0) return;
        const aiQuestions: RetroQuestion[] = res.questions.map((q) => ({
          question: q,
          placeholder: 'La tua risposta…',
        }));
        setQuestions(aiQuestions);
        setAnswers(aiQuestions.map(() => ''));
        setAiGenerated(true);
      })
      .catch(() => { /* keep static fallback */ });
    return () => { cancelled = true; };
  }, [projectId]);

  function updateAnswer(idx: number, value: string) {
    setAnswers((prev) => prev.map((a, i) => (i === idx ? value : a)));
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const entries = questions
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
    <Modal title="Retrospettiva di chiusura" onClose={onClose} size="lg" closeDisabled={loading}>
      <p className="text-sm text-text-muted mt-1 mb-5">
        Dedica 3 minuti a documentare le lezioni apprese.
        {aiGenerated && (
          <span className="ml-2 text-xs text-accent-cyan border border-border rounded-full px-2 py-0.5">
            ✨ Domande generate dall'AI
          </span>
        )}
      </p>

      <div className="space-y-5">
        {questions.map((q, idx) => (
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

      {error && <Alert className="mt-4">{error}</Alert>}

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
    </Modal>
  );
}
