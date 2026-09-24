import { pino } from 'pino';
import { env, isProduction, isTest } from './env.js';

/**
 * Logger estructurado.
 *
 * `redact` es deliberado: en fintech los logs suelen ser el canal por el que se
 * filtran credenciales. Se enmascaran las cabeceras de autorizacion y cookies
 * antes de que lleguen a cualquier transporte.
 */
export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      '*.password',
      'token',
      '*.token',
    ],
    censor: '[REDACTADO]',
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        },
      }),
});
