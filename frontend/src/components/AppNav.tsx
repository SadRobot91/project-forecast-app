import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  projectId?: string;
  projectName?: string;
}

interface NavItem {
  label: string;
  to: string;
  end?: boolean;
}

export default function AppNav({ projectId, projectName }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const projectLinks: NavItem[] = projectId ? [
    { label: 'Dashboard',      to: `/projects/${projectId}/dashboard` },
    { label: 'Pianificazione', to: `/projects/${projectId}/pianificazione` },
    { label: 'Gantt',          to: `/projects/${projectId}/gantt` },
    { label: 'Avanzamento',    to: `/projects/${projectId}/avanzamento` },
  ] : [];

  const globalLinks: NavItem[] = [
    { label: 'Portfolio', to: '/projects', end: true },
    { label: 'Registro Risorse', to: '/resources' },
    { label: 'Impostazioni', to: '/settings' },
  ];

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-accent/20 text-accent border border-accent/30'
        : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
    }`;

  const drawerLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block py-2 px-4 text-sm font-medium transition-colors border-b border-border ${
      isActive
        ? 'text-accent bg-accent/10'
        : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
    }`;

  return (
    <nav className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-10 overflow-x-clip" ref={drawerRef}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: logo + breadcrumb */}
        <div className="flex items-center gap-1 min-w-0">
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <span className="font-semibold text-sm hidden sm:block">Forecast</span>
          </button>

          {projectName && (
            <>
              <span className="text-border mx-1">/</span>
              <span className="text-text-muted text-sm truncate max-w-32">{projectName}</span>
            </>
          )}
        </div>

        {/* Center: project-specific tabs — hidden on mobile */}
        <div className="hidden md:flex items-center gap-1 overflow-x-auto min-w-0">
          {projectLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </div>

        {/* Right: global nav + user info */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Global links — hidden on mobile */}
          <div className="hidden md:flex items-center gap-1">
            {projectLinks.length > 0 && <div className="w-px h-4 bg-border mx-1" />}
            {globalLinks.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
            <div className="w-px h-4 bg-border mx-2" />
            <span className="text-text-muted text-xs">
              {user?.name}
              <span className="ml-1 uppercase tracking-widest text-xs text-text-dim bg-surface-3 rounded px-1.5 py-0.5">{user?.role}</span>
            </span>
          </div>

          {/* Esci — always visible */}
          <button onClick={logout} className="text-text-dim hover:text-text-muted text-xs transition-colors ml-2">
            Esci
          </button>

          {/* Hamburger — visible only on mobile */}
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex md:hidden items-center justify-center w-8 h-8 ml-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
            aria-label={menuOpen ? 'Chiudi menu' : 'Apri menu'}
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden absolute left-0 right-0 top-14 bg-surface border-b border-border z-50 shadow-card">
          {projectLinks.length > 0 && (
            <>
              <p className="text-xs uppercase tracking-widest text-text-dim px-4 pt-3 pb-1">
                Progetto
              </p>
              {projectLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={drawerLinkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </NavLink>
              ))}
            </>
          )}
          <p className="text-xs uppercase tracking-widest text-text-dim px-4 pt-3 pb-1">
            Navigazione
          </p>
          {globalLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={drawerLinkClass}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}
          <div className="px-4 py-3 flex items-center gap-2 border-t border-border mt-1">
            <span className="text-text-muted text-xs">{user?.name}</span>
            {user?.role && (
              <span className="uppercase tracking-widest text-xs text-text-dim bg-surface-3 rounded px-1.5 py-0.5">{user.role}</span>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
