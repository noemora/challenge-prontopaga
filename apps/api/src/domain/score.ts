import { createHash } from 'node:crypto';
import { parseRut } from '@riesgo/rut';

export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

/** Cantidad de valores posibles en el rango cerrado [0, 100]. */
const SCORE_BUCKETS = SCORE_MAX - SCORE_MIN + 1; // 101

/**
 * Calcula el score crediticio de un RUT.
 *
 * Requisito del desafio: el resultado debe ser DETERMINISTA por RUT y variar
 * entre RUT distintos. Se resuelve con una funcion hash en vez de un PRNG con
 * semilla porque el hash no necesita estado, es estable entre procesos,
 * reinicios y maquinas, y distribuye de forma uniforme.
 *
 * Detalles de implementacion relevantes:
 *
 * 1. Se hashea la forma CANONICA del RUT, no la entrada cruda. Asi
 *    "12.345.678-5", "12345678-5" y "123456785" producen el mismo score, que es
 *    lo que un usuario espera de una consulta por identidad.
 * 2. No se usa sal ni secreto. El score es un dato publico del dominio, no una
 *    credencial; ademas mantenerlo sin secreto hace la solucion reproducible
 *    por quien la evalue.
 * 3. El modulo 101 introduce un sesgo despreciable (2^32 no es multiplo exacto
 *    de 101): del orden de 1e-8 en la frecuencia relativa de los primeros
 *    valores. Irrelevante para un MVP, y se documenta para dejarlo explicito.
 *
 * @param rut RUT en cualquier formato valido.
 * @returns Entero en el rango [0, 100].
 * @throws {InvalidRutError} Si el RUT no es valido.
 */
export function calculateScore(rut: string): number {
  const { canonical } = parseRut(rut);
  const digest = createHash('sha256').update(canonical, 'utf8').digest();
  return digest.readUInt32BE(0) % SCORE_BUCKETS;
}
