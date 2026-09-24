import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../api/client.js';
import { login } from '../api/endpoints.js';
import { LoginPage } from './LoginPage.js';
import { renderConProveedores } from '../test/render.js';

vi.mock('../api/endpoints.js', () => ({
  login: vi.fn(),
  fetchScore: vi.fn(),
}));

const loginMock = vi.mocked(login);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoginPage', () => {
  it('muestra el formulario de inicio de sesion', () => {
    renderConProveedores(<LoginPage />);

    expect(screen.getByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });

  it('valida los campos vacios sin llamar a la API', async () => {
    const user = userEvent.setup();
    renderConProveedores(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText(/ingresa tu email/i)).toBeInTheDocument();
    expect(screen.getByText(/ingresa tu contraseña/i)).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('rechaza un email con formato invalido', async () => {
    const user = userEvent.setup();
    renderConProveedores(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'esto-no-es-un-email');
    await user.type(screen.getByLabelText(/contraseña/i), 'cualquiera');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText(/formato válido/i)).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('envia las credenciales cuando el formulario es valido', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({
      accessToken: 'token',
      user: { id: 'usr_1', email: 'juan.perez@example.cl', role: 'user', rut: '12.345.678-5' },
    });

    renderConProveedores(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'juan.perez@example.cl');
    await user.type(screen.getByLabelText(/contraseña/i), 'User123!');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('juan.perez@example.cl', 'User123!');
    });
  });

  it('muestra el mensaje de la API cuando las credenciales son incorrectas', async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Email o contrasena incorrectos.'),
    );

    renderConProveedores(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'juan.perez@example.cl');
    await user.type(screen.getByLabelText(/contraseña/i), 'incorrecta');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/incorrectos/i);
  });

  it('limpia la contrasena tras un intento fallido', async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Credenciales invalidas.'),
    );

    renderConProveedores(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'juan.perez@example.cl');
    await user.type(screen.getByLabelText(/contraseña/i), 'incorrecta');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await screen.findByRole('alert');
    expect(screen.getByLabelText(/contraseña/i)).toHaveValue('');
  });

  it('informa cuando el servidor no responde', async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor.'),
    );

    renderConProveedores(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'juan.perez@example.cl');
    await user.type(screen.getByLabelText(/contraseña/i), 'User123!');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo conectar/i);
  });

  it('rellena el formulario con una cuenta de prueba', async () => {
    const user = userEvent.setup();
    renderConProveedores(<LoginPage />);

    const botones = screen.getAllByRole('button', { name: /usar/i });
    await user.click(botones[0]!);

    expect(screen.getByLabelText(/email/i)).toHaveValue('admin@prontopaga.cl');
    expect(screen.getByLabelText(/contraseña/i)).toHaveValue('Admin123!');
  });
});
