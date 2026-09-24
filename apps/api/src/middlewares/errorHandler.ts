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
 * Errores que body-parser expone como fallos del cliente.
 *
 * Todos llegan con `status`, `expose: true` y un `type` estable. Sin este mapeo
 * caian al ramal generico y se respondian como 500, lo que tiene tres efectos
 * indeseables: se atribuye al servidor un error que es del cliente, se registra
 * un stack completo por cada peticion malformada —sin autenticacion previa— y,
 * fuera de produccion, el mensaje interno viaja al cliente.
 */
const ERRORES_DE_CUERPO: Record<string, { status: number; code: string; message: string }> = {
  'entity.parse.failed': {
    status: 400,
    code: 'INVALID_JSON',
    message: 'El cuerpo de la petición no es JSON válido.',
  },
  'entity.too.large': {
    status: 413,
    code: 'PAYLOAD_TOO_LARGE',
    message: 'El cuerpo de la petición supera el tamaño máximo permitido.',
  },
  'encoding.unsupported': {
    status: 415,
    code: 'UNSUPPORTED_ENCODING',
    message: 'La codificación del cuerpo no está soportada.',
  },
  'charset.unsupported': {
    status: 415,
    code: 'UNSUPPORTED_CHARSET',
    message: 'El juego de caracteres del cuerpo no está soportado.',
  },
  'request.aborted': {
    status: 400,
    code: 'REQUEST_ABORTED',
    message: 'La petición se interrumpió antes de completarse.',
  },
};

/** True si el error proviene de body-parser y esta pensado para exponerse al cliente. */
function esErrorDeCuerpo(error: unknown): error is { type: string } {
  // El operador `in` ya estrecha el tipo, asi que no hacen falta aserciones.
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    typeof error.type === 'string' &&
    error.type in ERRORES_DE_CUERPO
  );
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

  if (esErrorDeCuerpo(error)) {
    const mapeado = ERRORES_DE_CUERPO[error.type];
    if (mapeado) {
      // Se registra a nivel debug, no error: es un fallo del cliente y no
      // deberia ensuciar las alertas ni permitir que un tercero inunde el log.
      logger.debug({ tipo: error.type, path: req.path }, 'Cuerpo de peticion rechazado');
      res.status(mapeado.status).json({
        error: { code: mapeado.code, message: mapeado.message },
      });
      return;
    }
  }

  logger.error({ err: error, path: req.path, method: req.method }, 'Error no controlado');

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction
        ? 'Ocurrió un error inesperado. Intenta nuevamente en unos momentos.'
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
