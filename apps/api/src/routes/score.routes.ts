import { Router, type Request, type Response } from 'express';
import { calculateScore } from '../domain/score.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRutAccess } from '../middlewares/authorizeRut.js';
import { validateRutParam } from '../middlewares/validateRutParam.js';

export const scoreRouter: Router = Router();

/**
 * GET /score/:rut
 *
 * Cadena de middlewares, en este orden deliberado:
 *   1. authenticate      -> quien eres (401 si el token falta, expiro o no valida).
 *   2. validateRutParam  -> el dato pedido tiene sentido (400 si el RUT es invalido).
 *   3. authorizeRutAccess-> puedes verlo (403 si un 'user' pide un RUT ajeno).
 *
 * Validar antes de autorizar evita responder 403 a un RUT que en realidad
 * estaba mal escrito, que confundiria al usuario sobre la causa real.
 */
scoreRouter.get(
  '/score/:rut',
  authenticate,
  validateRutParam,
  authorizeRutAccess,
  (req: Request, res: Response) => {
    // `validateRutParam` garantiza que req.rut existe al llegar aqui.
    const rut = req.rut!;

    res.status(200).json({
      rut: rut.formatted,
      score: calculateScore(rut.canonical),
      fecha: nowIso(),
    });
  },
);

/** Marca temporal ISO 8601 en UTC, sin milisegundos, como en el ejemplo del enunciado. */
function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
