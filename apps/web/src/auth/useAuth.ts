import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './AuthContext.js';

/**
 * Acceso a la sesion actual.
 *
 * Lanza si se usa fuera del proveedor: es un error de programacion, y es
 * preferible que falle de inmediato y de forma explicita a devolver un valor
 * vacio que produzca un fallo lejano y dificil de rastrear.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de un <AuthProvider>.');
  }

  return context;
}
