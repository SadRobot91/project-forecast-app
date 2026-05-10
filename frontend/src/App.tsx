import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Projects from './pages/Projects';
import Dashboard from './pages/Dashboard';
import Baseline from './pages/Baseline';
import Allocation from './pages/Allocation';
import Resources from './pages/Resources';
import Gantt from './pages/Gantt';

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
            path="/projects/:id/baseline"
            element={
              <ProtectedRoute>
                <Baseline />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id/allocation"
            element={
              <ProtectedRoute>
                <Allocation />
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
            path="/resources"
            element={
              <ProtectedRoute>
                <Resources />
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
