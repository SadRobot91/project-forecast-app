import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Projects from './pages/Projects';
import Dashboard from './pages/Dashboard';
import Pianificazione from './pages/Pianificazione';
import Resources from './pages/Resources';
import Gantt from './pages/Gantt';
import Avanzamento from './pages/Avanzamento';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <Projects />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id/pianificazione"
            element={
              <ProtectedRoute>
                <Pianificazione />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id/gantt"
            element={
              <ProtectedRoute>
                <Gantt />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id/avanzamento"
            element={
              <ProtectedRoute>
                <Avanzamento />
              </ProtectedRoute>
            }
          />
          {/* Legacy redirects */}
          <Route path="/projects/:id/baseline"   element={<Navigate to="../pianificazione" replace />} />
          <Route path="/projects/:id/allocation"  element={<Navigate to="../pianificazione" replace />} />
          <Route path="/projects/:id/ongoing"     element={<Navigate to="../avanzamento" replace />} />
          <Route
            path="/resources"
            element={
              <ProtectedRoute>
                <Resources />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
