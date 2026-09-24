import { describe, expect, it } from 'vitest';
import { computeDv, InvalidRutError } from '@riesgo/rut';
import { calculateScore, SCORE_MAX, SCORE_MIN } from './score.js';

/** Genera RUT validos para las pruebas de distribucion, sin datos inventados. */
function validRutsFrom(start: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const body = String(start + i);
    return `${body}-${computeDv(body)}`;
  });
}

describe('calculateScore', () => {
  it('es determinista: el mismo RUT devuelve siempre el mismo score', () => {
    const scores = new Set(Array.from({ length: 50 }, () => calculateScore('12.345.678-5')));
    expect(scores.size).toBe(1);
  });

  it('ignora el formato de entrada: distintas escrituras del mismo RUT dan el mismo score', () => {
    const expected = calculateScore('12.345.678-5');
    for (const variant of ['12345678-5', '123456785', '012.345.678-5', ' 12.345.678-5 ']) {
      expect(calculateScore(variant)).toBe(expected);
    }
  });

  it('siempre devuelve un entero dentro del rango [0, 100]', () => {
    for (const rut of validRutsFrom(15_000_000, 500)) {
      const score = calculateScore(rut);
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(SCORE_MIN);
      expect(score).toBeLessThanOrEqual(SCORE_MAX);
    }
  });

  it('varia entre RUT distintos y cubre buena parte del rango', () => {
    const scores = validRutsFrom(20_000_000, 400).map(calculateScore);
    const distintos = new Set(scores);
    // Con 400 muestras sobre 101 valores posibles, esperamos alta dispersion.
    // El umbral es holgado a proposito: comprueba que hay variacion real sin
    // volver el test fragil ante un cambio de hash.
    expect(distintos.size).toBeGreaterThan(80);
  });

  it('cubre los extremos del rango en una muestra amplia', () => {
    const scores = validRutsFrom(5_000_000, 5_000).map(calculateScore);
    expect(Math.min(...scores)).toBe(SCORE_MIN);
    expect(Math.max(...scores)).toBe(SCORE_MAX);
  });

  it('rechaza un RUT invalido en lugar de devolver un score cualquiera', () => {
    expect(() => calculateScore('12.345.678-9')).toThrow(InvalidRutError);
  });
});
