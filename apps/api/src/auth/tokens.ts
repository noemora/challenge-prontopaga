import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized } from '../errors/AppError.js';
import { isRole, type Role } from './roles.js';

/** Algoritmo unico aceptado. Fijarlo evita ataques de confusion de algoritmo (alg: none / RS256->HS256). */
const ALGORITHM = 'HS256' as const;

/** Contenido del access token, tal como lo pide el enunciado. */
export interface AccessTokenPayload {
  /** ID del usuario. */
  sub: string;
  /** Rol del usuario. */
  role: Role;
  /** RUT del usuario. Presente unicamente cuando role === 'user'. */
  rut?: string;
}

export interface TokenSubject {
  id: string;
  role: Role;
  rut?: string | undefined;
}

/** Firma un access token de corta duracion para el usuario dado. */
export function signAccessToken(subject: TokenSubject): string {
  // El RUT se incluye solo para el rol 'user'. Un admin no tiene un RUT propio
  // asociado a la sesion, y omitirlo evita que el front lo interprete como
  // "RUT por defecto" al consultar.
  const payload: Omit<AccessTokenPayload, 'sub'> =
    subject.role === 'user' && subject.rut
      ? { role: subject.role, rut: subject.rut }
      : { role: subject.role };

  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: ALGORITHM,
    subject: subject.id,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<jwt.SignOptions['expiresIn']>,
  });
}

/**
 * Verifica firma, vigencia, emisor y audiencia de un access token.
 *
 * @throws {AppError} 401 con codigo TOKEN_EXPIRED o TOKEN_INVALID.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  let decoded: unknown;

  try {
    decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [ALGORITHM],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw unauthorized('TOKEN_EXPIRED', 'La sesión expiró. Vuelve a iniciar sesión.');
    }
    throw unauthorized('TOKEN_INVALID', 'El token de acceso no es válido.');
  }

  return assertPayloadShape(decoded);
}

/**
 * Valida la forma del payload ya verificado criptograficamente.
 *
 * Aunque la firma garantiza que el token lo emitimos nosotros, un token viejo
 * de una version anterior del esquema podria no tener la forma esperada. Se
 * valida igual antes de confiar en el para decidir permisos.
 */
function assertPayloadShape(decoded: unknown): AccessTokenPayload {
  if (typeof decoded !== 'object' || decoded === null) {
    throw unauthorized('TOKEN_INVALID', 'El token de acceso no es válido.');
  }

  const { sub, role, rut, exp } = decoded as Record<string, unknown>;

  if (typeof sub !== 'string' || sub === '' || !isRole(role)) {
    throw unauthorized('TOKEN_INVALID', 'El token de acceso no es válido.');
  }
  // jsonwebtoken solo comprueba `exp` si viene presente: un token emitido sin
  // expiracion se aceptaria indefinidamente. Se exige de forma explicita para
  // que la vigencia acotada sea una garantia real y no una convencion.
  if (typeof exp !== 'number') {
    throw unauthorized('TOKEN_INVALID', 'El token de acceso debe declarar su expiración.');
  }
  if (role === 'user' && typeof rut !== 'string') {
    throw unauthorized('TOKEN_INVALID', 'El token de un usuario debe incluir su RUT.');
  }
  if (rut !== undefined && typeof rut !== 'string') {
    throw unauthorized('TOKEN_INVALID', 'El token de acceso no es válido.');
  }

  return rut === undefined ? { sub, role } : { sub, role, rut };
}
