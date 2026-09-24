import type { NextFunction, Request, Response } from 'express';
import { areSameRut } from '@riesgo/rut';
import { forbidden, unauthorized } from '../errors/AppError.js';

/**
 * Middleware de AUTORIZACION sobre el RUT consultado.
 *
 * Reglas del enunciado:
 *   - rol `admin`: puede consultar cualquier RUT.
 *   - rol `user` : solo puede consultar el RUT de su propio token.
 *
 * La comparacion usa `areSameRut`, que normaliza ambos lados antes de comparar.
 * Es el punto mas delicado del ejercicio: una comparacion de strings crudos
 * (`req.params.rut === req.auth.rut`) dejaria pasar variantes de formato del
 * mismo RUT y, peor aun, fallaria de forma inconsistente segun como el cliente
 * escriba el dato. Normalizar es lo que hace que la regla sea realmente una
 * regla de identidad y no de presentacion.
 */
export function authorizeRutAccess(req: Request, _res: Response, next: NextFunction): void {
  const auth = req.auth;

  if (!auth) {
    // Defensa en profundidad: no deberia ocurrir si `authenticate` corrio antes.
    next(unauthorized('TOKEN_MISSING', 'Se requiere autenticacion.'));
    return;
  }

  if (auth.role === 'admin') {
    next();
    return;
  }

  // `validateRutParam` ya normalizo el RUT del path; se usa su forma canonica
  // en lugar de volver a leer el parametro crudo, para que la comparacion de
  // permisos y el dato que se devuelve provengan de la misma fuente.
  const requestedRut = req.rut?.canonical ?? '';

  if (!auth.rut || !areSameRut(auth.rut, requestedRut)) {
    next(
      forbidden(
        'RUT_FORBIDDEN',
        'No tienes permiso para consultar el score de otro RUT. Tu perfil solo permite consultar el RUT asociado a tu cuenta.',
      ),
    );
    return;
  }

  next();
}
