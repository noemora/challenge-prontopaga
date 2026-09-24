import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { login as loginRequest } from '../api/endpoints.js';
import { AuthContext, type AuthState, type AuthContextValue } from './AuthContext.js';

/**
 * Clave de sesion en sessionStorage.
 *
 * Decision deliberada, documentada en el README: el token se guarda en
 * sessionStorage y no en localStorage para que muera al cerrar la pestana. En
 * produccion la opcion correcta seria una cookie httpOnly + SameSite emitida
 * por el backend, que el JavaScript de la pagina no puede leer y por tanto no
 * queda expuesta ante un XSS. Se mantiene sessionStorage aqui porque el
 * enunciado pide una API sin estado que devuelve el JWT en el cuerpo, y montar
 * el flujo de cookies excederia el alcance del MVP.
 */
const STORAGE_KEY = 'riesgo.session';

/** Lee la sesion persistida. Ante cualquier dato corrupto, empieza de cero. */
function leerSesionPersistida(): AuthState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthState>;
    if (typeof parsed.token !== 'string' || !parsed.user) return null;

    return parsed as AuthState;
  } catch {
    // sessionStorage puede fallar (modo privado, almacenamiento bloqueado) y el
    // JSON puede estar corrupto. En ambos casos la app debe seguir funcionando.
    return null;
  }
}

function persistirSesion(session: AuthState | null): void {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Si no se puede persistir, la sesion sigue viva en memoria durante la
    // navegacion actual. Degradar es preferible a romper.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthState | null>(leerSesionPersistida);
  const [logoutReason, setLogoutReason] = useState<string | null>(null);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const { accessToken, user } = await loginRequest(email, password);
    const nueva: AuthState = { token: accessToken, user };

    setSession(nueva);
    setLogoutReason(null);
    persistirSesion(nueva);
  }, []);

  const cerrarSesion = useCallback((motivo?: string) => {
    setSession(null);
    setLogoutReason(motivo ?? null);
    persistirSesion(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, logoutReason, iniciarSesion, cerrarSesion }),
    [session, logoutReason, iniciarSesion, cerrarSesion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
