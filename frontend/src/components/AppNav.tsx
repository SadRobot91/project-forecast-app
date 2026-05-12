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

  const projectLinks: NavItem[] = projectId ? [
    { label: 'Dashboard',  to: `/projects/${projectId}/dashboard` },
    { label: 'Baseline',   to: `/projects/${projectId}/baseline` },
    { label: 'Allocation', to: `/projects/${projectId}/allocation` },
    { label: 'Gantt',      to: `/projects/${projectId}/gantt` },
    { label: 'Ongoing',    to: `/projects/${projectId}/ongoing` },
  ] : [];

  const globalLinks: NavItem[] = [
    { label: 'Portfolio', to: '/projects', end: true },
    { label: 'Registro Risorse', to: '/resources' },
    { label: 'Impostazioni', to: '/settings' },
  ];

  return (
    <nav className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
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

        {/* Center: project-specific tabs (scrollable se tanti) */}
        <div className="flex items-center gap-1 overflow-x-auto min-w-0">
          {projectLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        {/* Right: global nav + user info — sempre visibili */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {projectLinks.length > 0 && <div className="w-px h-4 bg-border mx-1" />}
          {globalLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <div className="w-px h-4 bg-border mx-2" />
          <span className="text-text-muted text-xs hidden md:block">
            {user?.name}
            <span className="ml-1 uppercase tracking-widest text-xs text-text-dim bg-surface-3 rounded px-1.5 py-0.5">{user?.role}</span>
          </span>
          <button onClick={logout} className="text-text-dim hover:text-text-muted text-xs transition-colors ml-2">
            Esci
          </button>
        </div>
      </div>
    </nav>
  );
}
