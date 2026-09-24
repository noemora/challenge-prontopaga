/**
 * Entorno de pruebas.
 *
 * Se fija ANTES de que cualquier modulo importe la configuracion, porque
 * `config/env.ts` valida y congela el entorno en el momento de la importacion.
 * El limite de login se eleva para que las suites funcionales no choquen con el
 * rate limiter; el limitador tiene su propia suite con valores bajos.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secreto-de-pruebas-suficientemente-largo-1234567890';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_ISSUER = 'prontopaga-riesgo-api';
process.env.JWT_AUDIENCE = 'prontopaga-riesgo-web';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.LOGIN_RATE_LIMIT_MAX = '1000';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '60000';
process.env.LOG_LEVEL = 'silent';
