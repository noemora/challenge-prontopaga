import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../auth/tokens.js';
import { unauthorized } from '../errors/AppError.js';

const BEARER_PREFIX = 'Bearer ';

/**
 * Middleware de AUTENTICACION.
 *
 * Extrae el access token del header `Authorization`, valida su firma y su
 * vigencia, y expone el payload en `req.auth`. No decide permisos: de eso se
 * encarga `authorizeRutAccess`. Separar ambas responsabilidades permite testear
 * la autorizacion sin tocar criptografia.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (typeof header !== 'string' || !header.startsWith(BEARER_PREFIX)) {
    next(
      unauthorized(
        'TOKEN_MISSING',
        'Falta el token de acceso. Envia el header Authorization: Bearer <token>.',
      ),
    );
    return;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (token === '') {
    next(unauthorized('TOKEN_MISSING', 'El token de acceso esta vacio.'));
    return;
  }

  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
}
