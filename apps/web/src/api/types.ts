export type Role = 'admin' | 'user';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  /** Presente unicamente cuando role === 'user'. */
  rut?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

export interface ScoreResponse {
  rut: string;
  score: number;
  /** Marca temporal ISO 8601 en UTC. */
  fecha: string;
}
