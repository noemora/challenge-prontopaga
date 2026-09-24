import { unauthorized } from '../errors/AppError.js';
import { burnPasswordComparison, verifyPassword } from './passwords.js';
import { signAccessToken } from './tokens.js';
import { findUserByEmail } from './users.js';
import type { Role } from './roles.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  rut?: string;
}

export interface LoginResult {
  accessToken: string;
  user: AuthenticatedUser;
}

/**
 * Autentica al usuario y emite un access token.
 *
 * Decisiones de seguridad:
 *
 * - Respuesta unica ante cualquier fallo. Da igual si el email no existe o si
 *   la contraseña es incorrecta: el codigo y el mensaje son identicos. Revelar
 *   cual de los dos fallo permite enumerar cuentas validas.
 * - Tiempo de respuesta equiparado. Si el email no existe igual se ejecuta una
 *   comparacion bcrypt contra un hash señuelo, de modo que la latencia no
 *   delate la existencia de la cuenta.
 *
 * @throws {AppError} 401 INVALID_CREDENTIALS
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const user = findUserByEmail(email);

  if (!user) {
    await burnPasswordComparison(password);
    throw unauthorized('INVALID_CREDENTIALS', 'Email o contraseña incorrectos.');
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw unauthorized('INVALID_CREDENTIALS', 'Email o contraseña incorrectos.');
  }

  const accessToken = signAccessToken({ id: user.id, role: user.role, rut: user.rut });

  // Se devuelve tambien el perfil para que la SPA no tenga que decodificar el
  // JWT por su cuenta. Decodificar un token en el cliente invita a confiar en
  // su contenido sin verificar la firma, que es un antipatron frecuente.
  const authenticatedUser: AuthenticatedUser =
    user.rut === undefined
      ? { id: user.id, email: user.email, role: user.role }
      : { id: user.id, email: user.email, role: user.role, rut: user.rut };

  return { accessToken, user: authenticatedUser };
}
