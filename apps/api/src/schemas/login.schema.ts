import { z } from 'zod';

/**
 * Esquema del cuerpo de POST /login.
 *
 * El limite de 200 caracteres en la contraseña no es cosmetico: bcrypt tiene un
 * coste computacional por invocacion y aceptar cadenas arbitrariamente largas
 * abre un vector de denegacion de servicio barato para el atacante.
 *
 * Tampoco se validan aqui reglas de complejidad: en el login solo interesa si
 * la credencial coincide. Exigir un formato revelaria la politica de
 * contraseñas a quien todavia no se ha autenticado.
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'El email es obligatorio.' })
    .trim()
    .min(1, 'El email es obligatorio.')
    .max(254, 'El email es demasiado largo.')
    .email('El email no tiene un formato válido.'),
  password: z
    .string({ required_error: 'La contraseña es obligatoria.' })
    .min(1, 'La contraseña es obligatoria.')
    .max(200, 'La contraseña es demasiado larga.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
