import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { CREDENCIALES } from '../test/helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('POST /login', () => {
  it('autentica a un usuario valido y devuelve un access token', async () => {
    const response = await request(app).post('/login').send(CREDENCIALES.juan);

    expect(response.status).toBe(200);
    expect(typeof response.body.accessToken).toBe('string');
    expect(response.body.user).toEqual({
      id: 'usr_client_002',
      email: 'juan.perez@example.cl',
      role: 'user',
      rut: '12.345.678-5',
    });
  });

  it('emite un token con sub, role y rut para el rol user', async () => {
    const response = await request(app).post('/login').send(CREDENCIALES.juan);
    const payload = jwt.decode(response.body.accessToken) as jwt.JwtPayload;

    expect(payload.sub).toBe('usr_client_002');
    expect(payload.role).toBe('user');
    expect(payload.rut).toBe('12.345.678-5');
  });

  it('emite un token sin rut para el rol admin', async () => {
    const response = await request(app).post('/login').send(CREDENCIALES.admin);
    const payload = jwt.decode(response.body.accessToken) as jwt.JwtPayload;

    expect(payload.role).toBe('admin');
    expect(payload.rut).toBeUndefined();
    expect(response.body.user.rut).toBeUndefined();
  });

  it('acepta el email sin distinguir mayusculas', async () => {
    const response = await request(app)
      .post('/login')
      .send({ email: 'Juan.Perez@Example.CL', password: CREDENCIALES.juan.password });

    expect(response.status).toBe(200);
  });

  it('nunca devuelve la contraseña ni su hash', async () => {
    const response = await request(app).post('/login').send(CREDENCIALES.juan);
    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('$2a$');
  });

  describe('credenciales incorrectas', () => {
    it('rechaza una contraseña incorrecta con 401', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: CREDENCIALES.juan.email, password: 'contrasena-incorrecta' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('responde identico ante email inexistente y contraseña incorrecta', async () => {
      // Si las respuestas difirieran, un atacante podria enumerar que cuentas
      // existen probando emails (OWASP A07).
      const inexistente = await request(app)
        .post('/login')
        .send({ email: 'nadie@example.cl', password: 'loquesea123' });
      const passwordMala = await request(app)
        .post('/login')
        .send({ email: CREDENCIALES.juan.email, password: 'loquesea123' });

      expect(inexistente.status).toBe(passwordMala.status);
      expect(inexistente.body).toEqual(passwordMala.body);
    });
  });

  describe('validacion del cuerpo', () => {
    it.each([
      [{ email: 'no-es-un-email', password: 'x' }, 'email'],
      [{ email: 'a@b.cl' }, 'password'],
      [{ password: 'x' }, 'email'],
      [{}, 'email'],
    ])('rechaza %j con 400 indicando el campo %s', async (body, campo) => {
      const response = await request(app).post('/login').send(body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(response.body.error.details)).toContain(campo);
    });

    it('descarta campos no declarados en vez de confiar en ellos', async () => {
      const response = await request(app)
        .post('/login')
        .send({ ...CREDENCIALES.juan, role: 'admin', rut: '1-9' });

      expect(response.status).toBe(200);
      // El rol viene del directorio, nunca de lo que el cliente envie.
      expect(response.body.user.role).toBe('user');
    });

    it('rechaza un cuerpo que no es JSON valido', async () => {
      const response = await request(app)
        .post('/login')
        .set('Content-Type', 'application/json')
        .send('{"email": roto}');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_JSON');
    });
  });
});

describe('cabeceras de seguridad', () => {
  it('no revela la tecnologia del servidor', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('aplica las cabeceras de helmet', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('rutas inexistentes', () => {
  it('responde 404 con la forma de error estandar', async () => {
    const response = await request(app).get('/no-existe');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
