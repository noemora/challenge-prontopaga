import { describe, it, expect } from 'vitest';
import {
  areSameRut,
  computeDv,
  formatRut,
  InvalidRutError,
  isValidRut,
  normalizeRut,
  parseRut,
  safeParseRut,
} from './index.js';

describe('computeDv (modulo 11)', () => {
  it.each([
    ['12345678', '5'],
    ['1234567', '4'],
    ['7612345', '4'],
    ['11111111', '1'],
    ['18765432', '7'],
    ['10000013', 'K'], // caso borde: resto 10 -> K
    ['10000004', '0'], // caso borde: resto 11 -> 0
  ])('cuerpo %s -> DV %s', (body, expected) => {
    expect(computeDv(body)).toBe(expected);
  });
});

describe('parseRut', () => {
  it('acepta el formato chileno con puntos y guion', () => {
    const rut = parseRut('12.345.678-5');
    expect(rut).toEqual({
      body: '12345678',
      dv: '5',
      canonical: '123456785',
      formatted: '12.345.678-5',
    });
  });

  it.each([
    '12.345.678-5',
    '12345678-5',
    '123456785',
    '12.345.678 - 5',
    '  12.345.678-5  ',
    '012.345.678-5', // ceros a la izquierda
  ])('colapsa "%s" a la misma forma canonica', (input) => {
    expect(parseRut(input).canonical).toBe('123456785');
  });

  it('normaliza el DV "k" minuscula a mayuscula', () => {
    expect(parseRut('10.000.013-k').dv).toBe('K');
    expect(parseRut('10.000.013-k').formatted).toBe('10.000.013-K');
  });

  it('acepta un cuerpo de 7 digitos', () => {
    expect(parseRut('1.234.567-4').formatted).toBe('1.234.567-4');
  });

  it('rechaza un DV que no corresponde e informa el esperado', () => {
    // Nota: 12.345.678-9 es el RUT de ejemplo del enunciado y su DV es incorrecto.
    expect.assertions(3);
    try {
      parseRut('12.345.678-9');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidRutError);
      expect((error as InvalidRutError).code).toBe('RUT_INVALID_DV');
      expect((error as InvalidRutError).expectedDv).toBe('5');
    }
  });

  it.each([
    ['', 'RUT_EMPTY'],
    ['   ', 'RUT_EMPTY'],
    ['5', 'RUT_MALFORMED'],
    ['12.34a.678-5', 'RUT_MALFORMED'],
    ['12345678-Z', 'RUT_MALFORMED'],
    ['123456-4', 'RUT_OUT_OF_RANGE'],
    ['1234567890-1', 'RUT_OUT_OF_RANGE'],
  ])('rechaza "%s" con codigo %s', (input, code) => {
    const result = safeParseRut(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(code);
  });
});

describe('helpers', () => {
  it('isValidRut discrimina validos de invalidos', () => {
    expect(isValidRut('12.345.678-5')).toBe(true);
    expect(isValidRut('12.345.678-9')).toBe(false);
  });

  it('normalizeRut devuelve la forma canonica', () => {
    expect(normalizeRut('12.345.678-5')).toBe('123456785');
  });

  it('formatRut devuelve la forma de presentacion', () => {
    expect(formatRut('123456785')).toBe('12.345.678-5');
    expect(formatRut('1234567-4')).toBe('1.234.567-4');
  });
});

describe('areSameRut (primitiva de autorizacion)', () => {
  it.each([
    ['12.345.678-5', '123456785'],
    ['12.345.678-5', '12345678-5'],
    ['12.345.678-5', '012.345.678-5'],
    ['10.000.013-K', '10000013k'],
  ])('reconoce "%s" y "%s" como el mismo RUT', (a, b) => {
    expect(areSameRut(a, b)).toBe(true);
  });

  it('distingue RUT realmente distintos', () => {
    expect(areSameRut('12.345.678-5', '18.765.432-7')).toBe(false);
  });

  it('falla cerrado ante entradas invalidas en vez de lanzar', () => {
    expect(areSameRut('12.345.678-9', '12.345.678-9')).toBe(false);
    expect(areSameRut('', '')).toBe(false);
    expect(areSameRut('basura', '12.345.678-5')).toBe(false);
  });
});
