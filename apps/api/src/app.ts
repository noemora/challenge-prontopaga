import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { env, isTest } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { authRouter } from './routes/auth.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { scoreRouter } from './routes/score.routes.js';

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
 * Impide que las respuestas se almacenen en cache.
 *
 * Tanto el score como el token son datos sensibles: el primero es informacion
 * financiera de una persona y el segundo es una credencial. Sin `no-store`, el
 * navegador y cualquier intermediario pueden cachearlas de forma heuristica, y
 * quedarian accesibles para quien use el equipo despues.
 */
function sinCache(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

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

  // Un ETag sobre una respuesta autenticada la vuelve revalidable por
  // intermediarios. Para una API que devuelve datos personales no aporta nada.
  app.set('etag', false);

  // Sin proxy de por medio, Express usa la IP de la conexion, que es lo seguro:
  // nadie puede evadir el rate limiting falsificando X-Forwarded-For. Detras de
  // un balanceador hay que declararlo, o todas las peticiones compartirian la IP
  // del proxy y el limite pasaria a ser global para todos los usuarios.
  if (env.TRUST_PROXY) {
    app.set('trust proxy', env.TRUST_PROXY);
  }

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

  if (!isTest) {
    app.use(
      pinoHttp({
        logger,
        // La sonda de vida se consulta cada pocos segundos; registrarla ahogaria
        // el resto de los eventos sin aportar informacion.
        autoLogging: { ignore: (req) => req.url === '/health' },
      }),
    );
  }

  // La sonda va ANTES del limitador: si la API queda saturada, el orquestador
  // necesita seguir distinguiendo "proceso vivo" de "proceso caido". Un 429 en
  // el healthcheck provocaria un reinicio justo cuando menos conviene.
  app.use(healthRouter);

  app.use(globalRateLimiter);

  // El parseo del cuerpo va DESPUES del limitador. Al reves, un cuerpo enorme
  // consumia memoria y generaba un error antes de que ningun limite pudiera
  // frenarlo, lo que convertia la propia proteccion en un vector de abuso.
  app.use(express.json({ limit: '10kb' }));

  app.use(sinCache);

  app.use(authRouter);
  app.use(scoreRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
