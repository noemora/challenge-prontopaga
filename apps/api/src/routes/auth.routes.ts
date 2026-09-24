import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { login } from '../auth/auth.service.js';
import { validateBody } from '../middlewares/validateBody.js';
import { loginSchema, type LoginInput } from '../schemas/login.schema.js';

/**
 * Limitador especifico del login.
 *
 * El endpoint de autenticacion es el objetivo natural de un ataque de fuerza
 * bruta o credential stuffing, y por eso lleva un limite mas estricto que el
 * global (OWASP A07).
 */
const loginRateLimiter = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
      message: 'Demasiados intentos de inicio de sesion. Espera un momento antes de reintentar.',
    },
  },
});

export const authRouter: Router = Router();

authRouter.post(
  '/login',
  loginRateLimiter,
  validateBody(loginSchema),
  async (req: Request, res: Response) => {
    const { email, password } = req.body as LoginInput;
    const result = await login(email, password);
    res.status(200).json(result);
  },
);
