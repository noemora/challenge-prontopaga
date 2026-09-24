import type { NextFunction, Request, Response } from 'express';
import { InvalidRutError } from '@riesgo/rut';
import { logger } from '../config/logger.js';
import { isProduction } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

/** Forma unica de error que consume el frontend. */
interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Manejador de errores central.
 *
 * Todo error termina aqui con una forma estable `{ error: { code, message } }`.
 * Los errores inesperados se registran completos en el log pero se responden
 * con un mensaje generico: filtrar stack traces o mensajes internos al cliente
 * es fuga de informacion (OWASP A05: Security Misconfiguration).
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    const body: ErrorBody = { error: { code: error.code, message: error.message } };
    if (error.details !== undefined) body.error.details = error.details;
    res.status(error.status).json(body);
    return;
  }

  if (error instanceof InvalidRutError) {
    res.status(400).json({ error: { code: 'RUT_INVALID', message: error.message } });
    return;
  }

  // JSON malformado en el body: body-parser lanza un SyntaxError con `status`.
  if (
    error instanceof SyntaxError &&
    'status' in error &&
    (error as { status: number }).status === 400
  ) {
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'El cuerpo de la peticion no es JSON valido.' },
    });
    return;
  }

  logger.error({ err: error, path: req.path, method: req.method }, 'Error no controlado');

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction
        ? 'Ocurrio un error inesperado. Intenta nuevamente en unos momentos.'
        : `Error interno: ${error instanceof Error ? error.message : String(error)}`,
    },
  });
}

/** Responde 404 con la misma forma de error que el resto de la API. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'ROUTE_NOT_FOUND', message: 'El recurso solicitado no existe.' },
  });
}
