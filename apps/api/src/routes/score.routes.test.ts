import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { CREDENCIALES, loginAndGetToken } from '../test/helpers.js';

let app: Express;
let tokenJuan: string;
let tokenAdmin: string;

beforeAll(async () => {
  app = createApp();
  tokenJuan = await loginAndGetToken(app, CREDENCIALES.juan);
  tokenAdmin = await loginAndGetToken(app, CREDENCIALES.admin);
});

/** Atajo para consultar un score, con o sin token. */
function consultar(rut: string, token?: string) {
  const req = request(app).get('/score/' + encodeURIComponent(rut));
  return token ? req.set('Authorization', 'Bearer ' + token) : req;
}

describe('GET /score/:rut — autenticacion', () => {
  it('rechaza la peticion sin token', async () => {
    const response = await consultar(CREDENCIALES.juan.rut);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('TOKEN_MISSING');
  });

  it('rechaza un esquema distinto de Bearer', async () => {
    const response = await request(app)
      .get('/score/' + encodeURIComponent(CREDENCIALES.juan.rut))
      .set('Authorization', 'Basic ' + tokenJuan);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('TOKEN_MISSING');
  });

  it('rechaza un token manipulado', async () => {
    const manipulado = tokenJuan.slice(0, -4) + 'AAAA';
    const response = await consultar(CREDENCIALES.juan.rut, manipulado);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('TOKEN_INVALID');
  });
});

describe('GET /score/:rut — autorizacion', () => {
  it('permite a un user consultar su propio RUT', async () => {
    const response = await consultar(CREDENCIALES.juan.rut, tokenJuan);

    expect(response.status).toBe(200);
    expect(response.body.rut).toBe('12.345.678-5');
  });

  it('impide a un user consultar el RUT de otra persona', async () => {
    const response = await consultar(CREDENCIALES.maria.rut, tokenJuan);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RUT_FORBIDDEN');
  });

  it('permite a un admin consultar cualquier RUT', async () => {
    for (const rut of [CREDENCIALES.juan.rut, CREDENCIALES.maria.rut, '7.612.345-4']) {
      const response = await consultar(rut, tokenAdmin);
      expect(response.status).toBe(200);
    }
  });

  it('no filtra dato alguno del RUT ajeno en una respuesta 403', async () => {
    const response = await consultar(CREDENCIALES.maria.rut, tokenJuan);

    // El cuerpo de un 403 solo lleva el error: ni el score, ni la fecha, ni el
    // RUT consultado. Devolver cualquiera de ellos confirmaria informacion
    // sobre un titular que este usuario no tiene derecho a ver.
    expect(Object.keys(response.body)).toEqual(['error']);
    expect(Object.keys(response.body.error).sort()).toEqual(['code', 'message']);
    expect(response.body).not.toHaveProperty('score');
    expect(response.body).not.toHaveProperty('fecha');
  });

  /**
   * Prueba de regresion del vector de evasion mas probable de este ejercicio.
   *
   * Si la autorizacion comparara los RUT como cadenas crudas, estas variantes
   * del propio RUT del usuario devolverian 403, y una implementacion descuidada
   * podria ademas dejar pasar un RUT ajeno escrito de otra forma. Normalizar
   * antes de comparar es lo que cierra esa puerta.
   */
  describe('la autorizacion compara identidad, no formato', () => {
    it.each(['12345678-5', '123456785', '012.345.678-5', '12.345.678-5'])(
      'acepta "%s" como el propio RUT de Juan',
      async (variante) => {
        const response = await consultar(variante, tokenJuan);

        expect(response.status).toBe(200);
        // Sea cual sea el formato de entrada, la salida es siempre canonica.
        expect(response.body.rut).toBe('12.345.678-5');
      },
    );

    it.each(['18765432-7', '187654327', '018.765.432-7'])(
      'sigue bloqueando el RUT ajeno escrito como "%s"',
      async (variante) => {
        const response = await consultar(variante, tokenJuan);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('RUT_FORBIDDEN');
      },
    );
  });
});

describe('GET /score/:rut — validacion del RUT', () => {
  it('rechaza un RUT con digito verificador incorrecto e indica el esperado', async () => {
    // 12.345.678-9 es el RUT de ejemplo del enunciado; su DV correcto es 5.
    const response = await consultar('12.345.678-9', tokenAdmin);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('RUT_INVALID');
    expect(response.body.error.message).toContain('5');
  });

  it.each(['abc', '123', '12.345.678-Z', '99999999999-1'])(
    'rechaza el RUT malformado "%s" con 400',
    async (rut) => {
      const response = await consultar(rut, tokenAdmin);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('RUT_INVALID');
    },
  );

  it('devuelve 400 (no 403) cuando el RUT es invalido, para no confundir la causa', async () => {
    const response = await consultar('12.345.678-9', tokenJuan);

    expect(response.status).toBe(400);
  });
});

describe('GET /score/:rut — respuesta', () => {
  it('devuelve rut, score y fecha con el contrato del enunciado', async () => {
    const response = await consultar(CREDENCIALES.juan.rut, tokenJuan);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(['fecha', 'rut', 'score']);
    expect(response.body.rut).toBe('12.345.678-5');
    expect(Number.isInteger(response.body.score)).toBe(true);
    expect(response.body.score).toBeGreaterThanOrEqual(0);
    expect(response.body.score).toBeLessThanOrEqual(100);
  });

  it('usa el formato ISO 8601 en UTC para la fecha', async () => {
    const response = await consultar(CREDENCIALES.juan.rut, tokenJuan);

    expect(response.body.fecha).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(Number.isNaN(Date.parse(response.body.fecha))).toBe(false);
  });

  it('devuelve el mismo score en peticiones sucesivas para el mismo RUT', async () => {
    const primera = await consultar(CREDENCIALES.juan.rut, tokenJuan);
    const segunda = await consultar('123456785', tokenJuan);

    expect(segunda.body.score).toBe(primera.body.score);
  });

  it('devuelve scores distintos para RUT distintos', async () => {
    const juan = await consultar(CREDENCIALES.juan.rut, tokenAdmin);
    const maria = await consultar(CREDENCIALES.maria.rut, tokenAdmin);

    expect(juan.body.score).not.toBe(maria.body.score);
  });
});
