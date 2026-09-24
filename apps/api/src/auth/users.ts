import type { Role } from './roles.js';

/**
 * Usuario del directorio simulado.
 *
 * El enunciado indica credenciales mock y sin persistencia. Aun asi las
 * contraseñas se guardan hasheadas con bcrypt (coste 10) y nunca en claro:
 * el objetivo es que el codigo refleje como se haria en produccion, donde la
 * unica diferencia seria el origen de los datos.
 */
export interface MockUser {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly role: Role;
  /** Solo para el rol 'user'. Un admin no tiene un RUT asociado a su sesion. */
  readonly rut?: string;
}

/**
 * Directorio en memoria.
 *
 * Las contraseñas en claro estan documentadas en el README para poder probar
 * la aplicacion; en un sistema real jamas se publicarian, pero aqui son datos
 * de demostracion sin valor fuera del entorno local.
 */
const USERS: readonly MockUser[] = [
  {
    id: 'usr_admin_001',
    email: 'admin@prontopaga.cl',
    passwordHash: '$2a$10$69xCu.gqIKitIYH8dhv5netjk.lo4oo93JGwCRxEKdiL76EJ6JNEa',
    role: 'admin',
  },
  {
    id: 'usr_client_002',
    email: 'juan.perez@example.cl',
    passwordHash: '$2a$10$OtsUPoa4gOW6km26snT39.pSQltma/0VMo47h/xeO5R63IhBZSjHS',
    role: 'user',
    rut: '12.345.678-5',
  },
  {
    id: 'usr_client_003',
    email: 'maria.soto@example.cl',
    passwordHash: '$2a$10$MGRHhGVA4UOhDHdxzJYXYeyy1fPkGScN2fpHwbXSc1PatjtViG85.',
    role: 'user',
    rut: '18.765.432-7',
  },
];

/**
 * Busca un usuario por email, sin distinguir mayusculas.
 *
 * Los emails se comparan normalizados porque el usuario no deberia quedar
 * fuera por escribir "Admin@ProntoPaga.cl".
 */
export function findUserByEmail(email: string): MockUser | undefined {
  const normalized = email.trim().toLowerCase();
  return USERS.find((user) => user.email === normalized);
}
