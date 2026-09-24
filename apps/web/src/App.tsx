import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute.js';
import { Header } from './components/Header.js';
import { LoginPage } from './pages/LoginPage.js';
import { ScorePage } from './pages/ScorePage.js';

export function App() {
  const { pathname } = useLocation();
  const esLogin = pathname === '/login';

  return (
    <div className="layout">
      <Header />

      <main className={`contenido${esLogin ? ' contenido--centrado' : ''}`}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/consulta" element={<ScorePage />} />
          </Route>

          {/* Cualquier ruta desconocida vuelve al punto de entrada. */}
          <Route path="*" element={<Navigate to="/consulta" replace />} />
        </Routes>
      </main>
    </div>
  );
}
