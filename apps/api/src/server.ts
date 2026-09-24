import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, corsOrigins: env.CORS_ORIGINS },
    'API de Riesgo Financiero escuchando',
  );
});

/**
 * Apagado ordenado.
 *
 * Ante SIGTERM/SIGINT se deja de aceptar conexiones nuevas y se esperan las en
 * curso. Sin esto, un redespliegue corta peticiones a medio responder.
 */
function shutdown(signal: string): void {
  logger.info({ signal }, 'Cerrando servidor');
  server.close(() => process.exit(0));
  // Red de seguridad por si alguna conexion queda colgada.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
