import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError.js';
import { signAccessToken, verifyAccessToken } from './tokens.js';

const SECRET = process.env.JWT_SECRET as string;
const ISSUER = process.env.JWT_ISSUER as string;
const AUDIENCE = process.env.JWT_AUDIENCE as string;

/** Extrae el codigo de error de un AppError lanzado por la funcion bajo prueba. */
function codeOfThrown(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppError) return error.code;
    throw error;
  }
  throw new Error('Se esperaba que la funcion lanzara un error y no lo hizo.');
}

describe('signAccessToken', () => {
  it('incluye sub, role y rut para un usuario con rol user', () => {
    const token = signAccessToken({ id: 'usr_1', role: 'user', rut: '12.345.678-5' });
    expect(verifyAccessToken(token)).toEqual({
      sub: 'usr_1',
      role: 'user',
      rut: '12.345.678-5',
    });
  });

  it('omite el rut para un admin, tal como exige el enunciado', () => {
    const payload = verifyAccessToken(signAccessToken({ id: 'usr_admin', role: 'admin' }));
    expect(payload).toEqual({ sub: 'usr_admin', role: 'admin' });
    expect(payload).not.toHaveProperty('rut');
  });

  it('firma con HS256 y emite iss, aud y exp', () => {
    const token = signAccessToken({ id: 'usr_1', role: 'admin' });
    const decoded = jwt.decode(token, { complete: true });
    expect(decoded?.header.alg).toBe('HS256');
    const payload = decoded?.payload as jwt.JwtPayload;
    expect(payload.iss).toBe(ISSUER);
    expect(payload.aud).toBe(AUDIENCE);
    expect(typeof payload.exp).toBe('number');
  });
});

describe('verifyAccessToken', () => {
  it('rechaza un token expirado con codigo TOKEN_EXPIRED', () => {
    const expired = jwt.sign({ role: 'admin' }, SECRET, {
      algorithm: 'HS256',
      subject: 'usr_1',
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: '-10s',
    });
    expect(codeOfThrown(() => verifyAccessToken(expired))).toBe('TOKEN_EXPIRED');
  });

  it('rechaza un token firmado con otro secreto', () => {
    const foreign = jwt.sign({ role: 'admin' }, 'otro-secreto-completamente-distinto-12345', {
      algorithm: 'HS256',
      subject: 'usr_1',
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: '15m',
    });
    expect(codeOfThrown(() => verifyAccessToken(foreign))).toBe('TOKEN_INVALID');
  });

  it('rechaza un token sin firma (ataque alg: none)', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({ sub: 'usr_1', role: 'admin', iss: ISSUER, aud: AUDIENCE }),
    ).toString('base64url');
    expect(codeOfThrown(() => verifyAccessToken(`${header}.${body}.`))).toBe('TOKEN_INVALID');
  });

  it('rechaza un token emitido para otra audiencia', () => {
    const otherAudience = jwt.sign({ role: 'admin' }, SECRET, {
      algorithm: 'HS256',
      subject: 'usr_1',
      issuer: ISSUER,
      audience: 'otra-app',
      expiresIn: '15m',
    });
    expect(codeOfThrown(() => verifyAccessToken(otherAudience))).toBe('TOKEN_INVALID');
  });

  it('rechaza un token de rol user que no trae rut', () => {
    const sinRut = jwt.sign({ role: 'user' }, SECRET, {
      algorithm: 'HS256',
      subject: 'usr_1',
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: '15m',
    });
    expect(codeOfThrown(() => verifyAccessToken(sinRut))).toBe('TOKEN_INVALID');
  });

  it('rechaza un token con un rol desconocido', () => {
    const rolRaro = jwt.sign({ role: 'superadmin' }, SECRET, {
      algorithm: 'HS256',
      subject: 'usr_1',
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: '15m',
    });
    expect(codeOfThrown(() => verifyAccessToken(rolRaro))).toBe('TOKEN_INVALID');
  });

  it('rechaza basura que no es un JWT', () => {
    expect(codeOfThrown(() => verifyAccessToken('esto-no-es-un-token'))).toBe('TOKEN_INVALID');
  });
});
