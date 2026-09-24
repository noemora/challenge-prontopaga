import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

/**
 * Suite aislada del limitador de login.
 *
 * El limite se configura por entorno y queda fijado cuando el router se
 * importa, asi que aqui se ajusta el entorno ANTES de importar la app de forma
 * dinamica. Las demas suites corren con un limite alto para no interferir.
 */
let app: Express;

beforeAll(async () => {
  process.env.LOGIN_RATE_LIMIT_MAX = '3';
  process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '60000';

  const { createApp } = await import('../app.js');
  app = createApp();
});

describe('limite de intentos de login', () => {
  it('bloquea con 429 tras superar el numero de intentos permitidos', async () => {
    const intento = () =>
      request(app).post('/login').send({ email: 'atacante@example.cl', password: 'probando123' });

    const permitidos = [await intento(), await intento(), await intento()];
    const bloqueado = await intento();

    expect(permitidos.every((r) => r.status === 401)).toBe(true);
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.error.code).toBe('TOO_MANY_LOGIN_ATTEMPTS');
  });

  it('expone las cabeceras estandar de rate limiting', async () => {
    const response = await request(app)
      .post('/login')
      .send({ email: 'otro@example.cl', password: 'probando123' });

    const tieneCabecera =
      response.headers['ratelimit'] !== undefined ||
      response.headers['ratelimit-limit'] !== undefined ||
      response.headers['ratelimit-policy'] !== undefined;

    expect(tieneCabecera).toBe(true);
  });
});
