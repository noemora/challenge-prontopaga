import { apiFetch } from './client.js';
import type { LoginResponse, ScoreResponse } from './types.js';

/** POST /login — autentica y devuelve el access token junto al perfil. */
export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/login', {
    method: 'POST',
    body: { email, password },
  });
}

/**
 * GET /score/:rut — consulta el score de un RUT.
 *
 * El RUT viaja codificado porque su formato de presentacion contiene puntos y
 * guion, y no debe alterar la ruta.
 */
export function fetchScore(
  rut: string,
  token: string,
  signal?: AbortSignal,
): Promise<ScoreResponse> {
  return apiFetch<ScoreResponse>(`/score/${encodeURIComponent(rut)}`, {
    token,
    ...(signal ? { signal } : {}),
  });
}
