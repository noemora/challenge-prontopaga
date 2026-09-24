import 'dotenv/config';
import { z } from 'zod';

/**
 * Configuracion validada al arranque (fail-fast).
 *
 * Si falta o es invalida una variable critica —el secreto JWT, por ejemplo— el
 * proceso no levanta. Es preferible no arrancar a arrancar inseguro: un default
 * silencioso para JWT_SECRET seria una vulnerabilidad, no una comodidad.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),

  JWT_SECRET: z
    .string({ required_error: 'JWT_SECRET es obligatorio. Ver .env.example.' })
    .min(32, 'JWT_SECRET debe tener al menos 32 caracteres para una firma HS256 robusta.'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_ISSUER: z.string().min(1).default('prontopaga-riesgo-api'),
  JWT_AUDIENCE: z.string().min(1).default('prontopaga-riesgo-web'),

  /**
   * Lista blanca de origenes CORS. Sin comodines: en fintech el "*" no es aceptable.
   *
   * Se incluyen por defecto localhost y 127.0.0.1 porque el navegador los trata
   * como origenes distintos. Omitir el segundo hace que la SPA falle con un
   * "no se pudo conectar" indistinguible de un servidor caido si quien la abre
   * escribe la IP en vez del nombre.
   */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  /**
   * Valor para `trust proxy` de Express. Vacio = desactivado.
   *
   * Solo debe activarse cuando hay un proxy de confianza por delante (ALB,
   * nginx, ingress). Activarlo sin proxy permitiria a cualquiera falsificar su
   * IP con X-Forwarded-For y evadir el rate limiting; no activarlo detras de un
   * proxy hace que todas las peticiones compartan la IP del balanceador y que
   * el limite se vuelva global para todos los usuarios.
   */
  TRUST_PROXY: z.string().default(''),

  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    // Se escribe a stderr y se aborta: el logger todavia no existe en este punto.
    console.error(`\nConfiguración inválida. Revisa tu archivo .env:\n${detail}\n`);
    process.exit(1);
  }

  return parsed.data;
}

export const env: Env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
