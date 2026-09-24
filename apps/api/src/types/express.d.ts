import type { ParsedRut } from '@riesgo/rut';
import type { AccessTokenPayload } from '../auth/tokens.js';

declare global {
  namespace Express {
    interface Request {
      /** Payload del token verificado. Lo inyecta el middleware `authenticate`. */
      auth?: AccessTokenPayload;
      /** RUT del path ya validado y normalizado. Lo inyecta el middleware `validateRutParam`. */
      rut?: ParsedRut;
    }
  }
}

export {};
