import bcrypt from 'bcryptjs';

/**
 * Hash señuelo con el mismo coste que los reales.
 *
 * Cuando el email no existe se compara la contraseña contra este hash para que
 * el tiempo de respuesta sea equivalente al de un email valido con contraseña
 * incorrecta. Sin esto, la diferencia de latencia permite enumerar usuarios
 * (OWASP A07: Identification and Authentication Failures).
 */
const DECOY_HASH = '$2a$10$xpJ.zFidGWYadFDe.VlPoOvhg/EWyFYvXAK/loY/ctD42OZur/.jW';

/** Verifica una contraseña en claro contra su hash bcrypt. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Consume el mismo tiempo que una verificacion real, sin revelar nada.
 * Se invoca cuando el usuario no existe, para igualar los tiempos de respuesta.
 */
export async function burnPasswordComparison(plain: string): Promise<void> {
  await bcrypt.compare(plain, DECOY_HASH);
}
