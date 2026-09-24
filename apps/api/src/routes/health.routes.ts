import { Router, type Request, type Response } from 'express';

export const healthRouter: Router = Router();

/**
 * Sonda de vida.
 *
 * No la pide el enunciado, pero cualquier despliegue real (contenedor,
 * balanceador, orquestador) necesita un endpoint barato y sin autenticacion
 * para saber si el proceso responde.
 */
healthRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', uptime: Math.round(process.uptime()) });
});
