import request from 'supertest';
import type { Express } from 'express';

/** Credenciales del directorio mock, tal como se documentan en el README. */
export const CREDENCIALES = {
  admin: { email: 'admin@prontopaga.cl', password: 'Admin123!' },
  juan: { email: 'juan.perez@example.cl', password: 'User123!', rut: '12.345.678-5' },
  maria: { email: 'maria.soto@example.cl', password: 'User123!', rut: '18.765.432-7' },
} as const;

/** Inicia sesion y devuelve el access token. Falla ruidosamente si el login no da 200. */
export async function loginAndGetToken(
  app: Express,
  credenciales: { email: string; password: string },
): Promise<string> {
  const response = await request(app).post('/login').send(credenciales);
  if (response.status !== 200) {
    throw new Error(`Login fallido (${response.status}): ${JSON.stringify(response.body)}`);
  }
  return response.body.accessToken as string;
}
