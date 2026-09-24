import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { AuthProvider } from '../auth/AuthProvider.js';
import type { AuthenticatedUser } from '../api/types.js';

/** Misma clave que usa AuthProvider para persistir la sesion. */
const STORAGE_KEY = 'riesgo.session';

/**
 * Deja una sesion activa antes de montar el arbol.
 *
 * AuthProvider lee sessionStorage en su inicializacion, asi que sembrar el
 * almacenamiento es la forma de partir autenticado sin exponer setters de
 * prueba en el codigo de produccion.
 */
export function sembrarSesion(user: AuthenticatedUser, token = 'token-de-prueba'): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
}

export const USUARIO: AuthenticatedUser = {
  id: 'usr_client_002',
  email: 'juan.perez@example.cl',
  role: 'user',
  rut: '12.345.678-5',
};

export const ADMIN: AuthenticatedUser = {
  id: 'usr_admin_001',
  email: 'admin@prontopaga.cl',
  role: 'admin',
};

/** Monta un componente con enrutador y proveedor de sesion. */
export function renderConProveedores(ui: ReactElement, route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
  );
}
