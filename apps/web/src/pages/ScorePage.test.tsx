import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../api/client.js';
import { fetchScore } from '../api/endpoints.js';
import { ScorePage } from './ScorePage.js';
import { ADMIN, USUARIO, renderConProveedores, sembrarSesion } from '../test/render.js';

vi.mock('../api/endpoints.js', () => ({
  login: vi.fn(),
  fetchScore: vi.fn(),
}));

const fetchScoreMock = vi.mocked(fetchScore);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('ScorePage — rol user', () => {
  beforeEach(() => sembrarSesion(USUARIO));

  it('precarga el RUT del usuario autenticado', () => {
    renderConProveedores(<ScorePage />);

    expect(screen.getByLabelText(/rut a consultar/i)).toHaveValue('12.345.678-5');
  });

  it('explica que solo puede consultar su propio RUT', () => {
    renderConProveedores(<ScorePage />);

    expect(screen.getByText(/únicamente el RUT asociado a tu cuenta/i)).toBeInTheDocument();
  });

  it('muestra el score cuando la consulta es exitosa', async () => {
    const user = userEvent.setup();
    fetchScoreMock.mockResolvedValue({
      rut: '12.345.678-5',
      score: 73,
      fecha: '2026-09-24T14:35:00Z',
    });

    renderConProveedores(<ScorePage />);
    await user.click(screen.getByRole('button', { name: /consultar score/i }));

    expect(await screen.findByText('73')).toBeInTheDocument();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '73');
  });

  it('muestra un mensaje claro cuando el RUT no esta permitido', async () => {
    const user = userEvent.setup();
    fetchScoreMock.mockRejectedValue(
      new ApiError(403, 'RUT_FORBIDDEN', 'No tienes permiso para consultar el score de otro RUT.'),
    );

    renderConProveedores(<ScorePage />);

    const campo = screen.getByLabelText(/rut a consultar/i);
    await user.clear(campo);
    await user.type(campo, '18.765.432-7');
    await user.click(screen.getByRole('button', { name: /consultar score/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no tienes permiso/i);
  });

  it('no muestra ningun score tras un rechazo por permisos', async () => {
    const user = userEvent.setup();
    fetchScoreMock
      .mockResolvedValueOnce({ rut: '12.345.678-5', score: 73, fecha: '2026-09-24T14:35:00Z' })
      .mockRejectedValueOnce(new ApiError(403, 'RUT_FORBIDDEN', 'Sin permiso.'));

    renderConProveedores(<ScorePage />);

    await user.click(screen.getByRole('button', { name: /consultar score/i }));
    expect(await screen.findByText('73')).toBeInTheDocument();

    const campo = screen.getByLabelText(/rut a consultar/i);
    await user.clear(campo);
    await user.type(campo, '18.765.432-7');
    await user.click(screen.getByRole('button', { name: /consultar score/i }));

    await screen.findByRole('alert');
    // El resultado anterior debe desaparecer: dejarlo en pantalla junto a un
    // error confundiria sobre a que RUT corresponde.
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
  });

  describe('validacion local del RUT', () => {
    it('detecta un digito verificador incorrecto sin llamar a la API', async () => {
      const user = userEvent.setup();
      renderConProveedores(<ScorePage />);

      const campo = screen.getByLabelText(/rut a consultar/i);
      await user.clear(campo);
      // 12.345.678-9 es el RUT de ejemplo del enunciado; su DV correcto es 5.
      await user.type(campo, '12.345.678-9');
      await user.click(screen.getByRole('button', { name: /consultar score/i }));

      expect(await screen.findByText(/dígito verificador no corresponde/i)).toBeInTheDocument();
      expect(screen.getByText(/"5"/)).toBeInTheDocument();
      expect(fetchScoreMock).not.toHaveBeenCalled();
    });

    it('rechaza un RUT malformado sin llamar a la API', async () => {
      const user = userEvent.setup();
      renderConProveedores(<ScorePage />);

      const campo = screen.getByLabelText(/rut a consultar/i);
      await user.clear(campo);
      await user.type(campo, 'no-es-un-rut');
      await user.click(screen.getByRole('button', { name: /consultar score/i }));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(fetchScoreMock).not.toHaveBeenCalled();
    });

    it('normaliza el formato del RUT al salir del campo', async () => {
      const user = userEvent.setup();
      renderConProveedores(<ScorePage />);

      const campo = screen.getByLabelText(/rut a consultar/i);
      await user.clear(campo);
      await user.type(campo, '123456785');
      await user.tab();

      expect(campo).toHaveValue('12.345.678-5');
    });

    it('envia siempre el RUT en su forma canonica, escriba como escriba el usuario', async () => {
      const user = userEvent.setup();
      fetchScoreMock.mockResolvedValue({
        rut: '12.345.678-5',
        score: 73,
        fecha: '2026-09-24T14:35:00Z',
      });

      renderConProveedores(<ScorePage />);

      const campo = screen.getByLabelText(/rut a consultar/i);
      await user.clear(campo);
      await user.type(campo, '123456785');
      await user.click(screen.getByRole('button', { name: /consultar score/i }));

      await waitFor(() => {
        expect(fetchScoreMock).toHaveBeenCalledWith(
          '12.345.678-5',
          'token-de-prueba',
          expect.anything(),
        );
      });
    });
  });

  it('cierra la sesion cuando el token expiro', async () => {
    const user = userEvent.setup();
    fetchScoreMock.mockRejectedValue(new ApiError(401, 'TOKEN_EXPIRED', 'La sesion expiro.'));

    renderConProveedores(<ScorePage />);
    await user.click(screen.getByRole('button', { name: /consultar score/i }));

    await waitFor(() => {
      expect(sessionStorage.getItem('riesgo.session')).toBeNull();
    });
  });
});

describe('ScorePage — rol admin', () => {
  beforeEach(() => sembrarSesion(ADMIN));

  it('deja el campo vacio porque el admin no tiene un RUT propio', () => {
    renderConProveedores(<ScorePage />);

    expect(screen.getByLabelText(/rut a consultar/i)).toHaveValue('');
  });

  it('indica que puede consultar cualquier RUT', () => {
    renderConProveedores(<ScorePage />);

    expect(screen.getByText(/cualquier RUT/i)).toBeInTheDocument();
  });
});
