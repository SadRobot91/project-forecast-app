import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = "Inserisci l'indirizzo email";
    if (!password) errors.password = 'Inserisci la password';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setLoading(true);
    try {
      const res = await login(email, password);
      setAuth(res.token, res.user);
      navigate('/projects');
    } catch {
      setError('Credenziali non valide. Riprova.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4">
      {/* Decorative glow blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-accent opacity-10 rounded-full blur-3xl spointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent-cyan opacity-10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/20 border border-accent/30 mb-4">
            <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Project Forecast</h1>
          <p className="text-text-muted text-sm mt-1">Accedi per continuare</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-white/8 rounded-2xl p-8 shadow-[0_8px_40px_rgba(108,99,255,0.12)] space-y-5"
        >
          {error && (
            <div className="bg-rag-red/10 border border-rag-red/30 text-rag-red text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-text-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
              onInvalid={(e) => e.preventDefault()}
              placeholder="giuseppe@company.com"
              className={`w-full bg-base border ${fieldErrors.email ? 'border-rag-red focus:border-rag-red focus:ring-rag-red/30' : 'border-border focus:border-accent focus:ring-accent'} text-text-primary placeholder-text-dim rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-colors`}
            />
            {fieldErrors.email && (
              <p className="text-rag-red text-sm mt-1">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-text-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              onInvalid={(e) => e.preventDefault()}
              placeholder="••••••••"
              className={`w-full bg-base border ${fieldErrors.password ? 'border-rag-red focus:border-rag-red focus:ring-rag-red/30' : 'border-border focus:border-accent focus:ring-accent'} text-text-primary placeholder-text-dim rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-colors`}
            />
            {fieldErrors.password && (
              <p className="text-rag-red text-sm mt-1">{fieldErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-all duration-200 shadow-[0_4px_20px_rgba(108,99,255,0.4)] hover:shadow-[0_6px_28px_rgba(108,99,255,0.55)] hover:-translate-y-px"
          >
            {loading ? 'Accesso in corso…' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  );
}
