import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from './api/client.js';
import { fetchScore } from './api/endpoints.js';
import { App } from './App.js';
import { USUARIO, renderConProveedores, sembrarSesion } from './test/render.js';

vi.mock('./api/endpoints.js', () => ({
  login: vi.fn(),
  fetchScore: vi.fn(),
}));

const fetchScoreMock = vi.mocked(fetchScore);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

/**
 * Recorrido completo del cierre de sesion.
 *
 * Se monta la aplicacion entera, con enrutador, en lugar de una vista suelta,
 * porque lo que se comprueba atraviesa tres piezas: la vista detecta el 401, el
 * proveedor guarda el motivo, la guarda de rutas redirige y el login muestra el
 * mensaje. Probado por separado, cada pieza pasaria aunque el recorrido estuviera
 * roto en las costuras.
 */
describe('cierre de sesion', () => {
  it('explica en el login por que se cerro la sesion al expirar el token', async () => {
    const user = userEvent.setup();
    sembrarSesion(USUARIO);
    fetchScoreMock.mockRejectedValue(new ApiError(401, 'TOKEN_EXPIRED', 'La sesión expiró.'));

    renderConProveedores(<App />, '/consulta');
    expect(screen.getByRole('heading', { name: /consulta de score/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /consultar score/i }));

    // Sin este aviso, el usuario aparece de golpe en el login sin haber hecho
    // nada: la caducidad de la sesion se leeria como un fallo de la aplicacion.
    expect(await screen.findByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/la sesión expiró/i);
  });

  it('no muestra ningun aviso cuando es el usuario quien cierra la sesion', async () => {
    const user = userEvent.setup();
    sembrarSesion(USUARIO);

    renderConProveedores(<App />, '/consulta');
    await user.click(screen.getByRole('button', { name: /cerrar sesión/i }));

    // Aqui el usuario ya sabe por que esta en el login: lo pidio el. Explicarselo
    // seria ruido.
    expect(await screen.findByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('descarta el aviso una vez que se vuelve a iniciar sesion', async () => {
    const user = userEvent.setup();
    sembrarSesion(USUARIO);
    fetchScoreMock.mockRejectedValue(new ApiError(401, 'TOKEN_EXPIRED', 'La sesión expiró.'));

    renderConProveedores(<App />, '/consulta');
    await user.click(screen.getByRole('button', { name: /consultar score/i }));
    await screen.findByRole('status');

    const { login } = await import('./api/endpoints.js');
    vi.mocked(login).mockResolvedValue({ accessToken: 'token-nuevo', user: USUARIO });

    await user.type(screen.getByLabelText(/email/i), USUARIO.email);
    await user.type(screen.getByLabelText(/contraseña/i), 'User123!');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    // El aviso no debe quedar pegado en la siguiente sesion.
    expect(await screen.findByRole('heading', { name: /consulta de score/i })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
