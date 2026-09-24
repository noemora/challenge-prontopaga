import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { badRequest } from '../errors/AppError.js';

/**
 * Valida y tipa `req.body` contra un esquema Zod.
 *
 * Al reemplazar el body por el resultado del parseo se descartan las
 * propiedades no declaradas: el handler nunca ve campos que no espera, lo que
 * cierra la puerta a mass assignment (OWASP A08).
 */
export function validateBody<TSchema extends ZodTypeAny>(schema: TSchema): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body) as z.infer<TSchema>;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          badRequest('VALIDATION_ERROR', 'Los datos enviados no son válidos.', {
            issues: error.issues.map((issue) => ({
              field: issue.path.join('.'),
              message: issue.message,
            })),
          }),
        );
        return;
      }
      next(error);
    }
  };
}
