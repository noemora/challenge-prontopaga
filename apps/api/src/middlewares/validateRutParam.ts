import type { NextFunction, Request, Response } from 'express';
import { InvalidRutError, parseRut } from '@riesgo/rut';
import { badRequest } from '../errors/AppError.js';

/**
 * Valida el parametro `:rut` del path y lo deja normalizado en `req.rut`.
 *
 * Corre ANTES de la autorizacion para que un RUT malformado devuelva 400
 * (error del cliente) y no 403 (falta de permisos), que seria un mensaje
 * enganoso. Tambien garantiza que el middleware de autorizacion y el handler
 * trabajen sobre la misma forma canonica, sin volver a parsear.
 */
export function validateRutParam(req: Request, _res: Response, next: NextFunction): void {
  // Express tipa los parametros como `string | string[]` porque una ruta puede
  // declarar el mismo nombre mas de una vez. Aqui no es el caso, y cualquier
  // forma inesperada se trata como entrada invalida en vez de coaccionarla.
  const raw = typeof req.params.rut === 'string' ? req.params.rut : '';

  try {
    req.rut = parseRut(raw);
    next();
  } catch (error) {
    if (error instanceof InvalidRutError) {
      next(badRequest('RUT_INVALID', buildMessage(error), { reason: error.code }));
      return;
    }
    next(error);
  }
}

/**
 * Traduce el error de dominio a un mensaje accionable.
 *
 * En el caso del digito verificador se informa cual era el esperado: es
 * informacion publica (se deriva del propio cuerpo del RUT con modulo 11), no
 * filtra nada, y evita que el usuario quede adivinando.
 */
function buildMessage(error: InvalidRutError): string {
  if (error.code === 'RUT_INVALID_DV' && error.expectedDv) {
    return `El RUT ingresado no es valido: el digito verificador no corresponde al cuerpo (el esperado es "${error.expectedDv}").`;
  }
  return `El RUT ingresado no es valido: ${error.message}`;
}
