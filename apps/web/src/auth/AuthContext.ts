import { createContext } from 'react';
import type { AuthenticatedUser } from '../api/types.js';

export interface AuthState {
  token: string;
  user: AuthenticatedUser;
}

export interface AuthContextValue {
  /** Sesion activa, o null si no hay nadie autenticado. */
  session: AuthState | null;
  /** Motivo por el que se cerro la ultima sesion, para explicarlo en el login. */
  logoutReason: string | null;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: (motivo?: string) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
