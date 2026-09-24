import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth.js';

/**
 * Guarda de rutas privadas.
 *
 * Es una barrera de experiencia de usuario, NO un control de seguridad: quien
 * autoriza de verdad es la API, que valida el token en cada peticion. Cualquier
 * comprobacion en el cliente puede saltarse desde las herramientas del
 * navegador, y por eso el backend nunca confia en ella.
 */
export function ProtectedRoute() {
  const { session } = useAuth();
  const location = useLocation();

  if (!session) {
    // `replace` evita que el boton "atras" devuelva a la ruta protegida.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
