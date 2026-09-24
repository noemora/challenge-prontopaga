import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { env, isTest } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { healthRouter } from './routes/health.routes.js';

/**
 * Limite global de peticiones.
 *
 * Complementa al limite especifico de /login. Protege al resto de la API de
 * un cliente descontrolado o de un escaneo automatizado.
 */
const globalRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Demasiadas peticiones. Intenta nuevamente en unos momentos.',
    },
  },
});

/**
 * Construye la aplicacion Express.
 *
 * Se expone como factory y no como instancia global para que los tests puedan
 * levantar una app limpia por suite, sin estado compartido entre archivos.
 *
 * Nota sobre errores asincronos: Express 5 propaga automaticamente las promesas
 * rechazadas de un handler a la cadena de errores, por lo que no hace falta
 * envolver los handlers async en un wrapper try/catch.
 */
export function createApp(): Express {
  const app = express();

  // Cabeceras de seguridad (CSP, HSTS, X-Content-Type-Options, etc.) y
  // eliminacion de X-Powered-By, que revela la tecnologia del servidor.
  app.use(helmet());

  // CORS con lista blanca explicita. Un "*" permitiria a cualquier origen
  // consumir la API desde el navegador de un usuario autenticado.
  app.use(
    cors({
      origin(origin, callback) {
        // Sin cabecera Origin: peticiones server-to-server, curl o healthchecks.
        if (!origin) {
          callback(null, true);
          return;
        }
        callback(null, env.CORS_ORIGINS.includes(origin));
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );

  // Cota al tamaño del body: sin limite, un POST gigante es una denegacion de
  // servicio trivial contra la memoria del proceso.
  app.use(express.json({ limit: '10kb' }));

  if (!isTest) {
    app.use(pinoHttp({ logger }));
  }

  app.use(globalRateLimiter);

  app.use(healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
