import { Navigate, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header.js';
import { LoginPage } from './pages/LoginPage.js';

export function App() {
  return (
    <div className="layout">
      <Header />

      <main className="contenido contenido--centrado">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </div>
  );
}
