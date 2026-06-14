import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import RequireAuth from './components/RequireAuth';
import ProjectLayout from './components/ProjectLayout';

const Login          = lazy(() => import('./pages/Login'));
const Projects       = lazy(() => import('./pages/Projects'));
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const Pianificazione = lazy(() => import('./pages/pianificazione'));
const Resources      = lazy(() => import('./pages/Resources'));
const Gantt          = lazy(() => import('./pages/gantt'));
const Avanzamento    = lazy(() => import('./pages/avanzamento'));
const Settings       = lazy(() => import('./pages/Settings'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <p className="text-text-muted animate-pulse">Caricamento…</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Layout route pathless: auth check una volta per tutte le figlie */}
          <Route element={<RequireAuth />}>
            <Route path="/projects" element={<Projects />} />

            {/* Layout di progetto: AppNav montata una volta, nome progetto condiviso */}
            <Route path="/projects/:id" element={<ProjectLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard"      element={<Dashboard />} />
              <Route path="pianificazione" element={<Pianificazione />} />
              <Route path="gantt"          element={<Gantt />} />
              <Route path="avanzamento"    element={<Avanzamento />} />
              {/* Legacy redirects: ".." risale alla route padre /projects/:id,
                  quindi il progetto viene preservato */}
              <Route path="baseline"   element={<Navigate to="../pianificazione" replace />} />
              <Route path="allocation" element={<Navigate to="../pianificazione" replace />} />
              <Route path="ongoing"    element={<Navigate to="../avanzamento" replace />} />
            </Route>

            <Route path="/resources" element={<Resources />} />
            <Route path="/settings"  element={<Settings />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
