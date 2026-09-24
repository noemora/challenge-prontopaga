import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { safeParseRut } from '@riesgo/rut';
import { ApiError } from '../api/client.js';
import { fetchScore } from '../api/endpoints.js';
import type { ScoreResponse } from '../api/types.js';
import type { AuthState } from '../auth/AuthContext.js';
import { useAuth } from '../auth/useAuth.js';
import { Alert } from '../components/Alert.js';
import { Field } from '../components/Field.js';
import { ScoreResult } from '../components/ScoreResult.js';
import { SubmitButton } from '../components/SubmitButton.js';

/**
 * Punto de entrada de la vista de consulta.
 *
 * Separa la comprobacion de sesion del formulario para que el formulario reciba
 * una sesion garantizada y no necesite aserciones non-null. Importa porque la
 * sesion puede desaparecer MIENTRAS la vista esta montada —por ejemplo cuando
 * la API responde que el token expiro—, y una asercion `session!` haria que el
 * componente reviente en ese mismo instante en lugar de ceder el paso al login.
 */
export function ScorePage() {
  const { session, cerrarSesion } = useAuth();

  if (!session) return <Navigate to="/login" replace />;

  return <ScoreForm session={session} cerrarSesion={cerrarSesion} />;
}

interface ScoreFormProps {
  session: AuthState;
  cerrarSesion: (motivo?: string) => void;
}

function ScoreForm({ session, cerrarSesion }: ScoreFormProps) {
  const usuario = session.user;
  const esAdmin = usuario.role === 'admin';

  // A un usuario con rol 'user' se le precarga su propio RUT, pero el campo
  // sigue siendo editable. Bloquearlo ocultaria justamente el caso que el
  // enunciado pide cubrir: el mensaje claro al intentar un RUT no permitido.
  const [rut, setRut] = useState(usuario.rut ?? '');
  const [errorCampo, setErrorCampo] = useState<string | undefined>(undefined);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ScoreResponse | null>(null);
  const [consultando, setConsultando] = useState(false);

  // Permite descartar la respuesta de una consulta que quedo obsoleta cuando el
  // usuario lanza otra antes de que la primera termine.
  const peticionEnCurso = useRef<AbortController | null>(null);

  useEffect(() => () => peticionEnCurso.current?.abort(), []);

  /** Al salir del campo se normaliza la presentacion, si el RUT es valido. */
  function formatearAlSalir() {
    const parseado = safeParseRut(rut);
    if (parseado.ok) setRut(parseado.value.formatted);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorGeneral(null);

    // Validacion local con el MISMO modulo que usa la API. Ahorra un viaje al
    // servidor y, sobre todo, garantiza que cliente y backend no discrepen
    // sobre que es un RUT valido.
    const parseado = safeParseRut(rut);
    if (!parseado.ok) {
      const { error } = parseado;
      setErrorCampo(
        error.code === 'RUT_INVALID_DV' && error.expectedDv
          ? `El dígito verificador no corresponde: para este cuerpo debería ser "${error.expectedDv}".`
          : error.message,
      );
      setResultado(null);
      return;
    }

    setErrorCampo(undefined);
    setRut(parseado.value.formatted);

    peticionEnCurso.current?.abort();
    const controller = new AbortController();
    peticionEnCurso.current = controller;

    setConsultando(true);
    try {
      const respuesta = await fetchScore(
        parseado.value.formatted,
        session.token,
        controller.signal,
      );
      setResultado(respuesta);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;

      setResultado(null);

      if (error instanceof ApiError) {
        // Un token expirado o invalido termina la sesion y explica por que, en
        // lugar de dejar al usuario reintentando contra un 401 silencioso.
        if (error.isSessionExpired) {
          cerrarSesion(`${error.message} Vuelve a iniciar sesión para continuar.`);
          return;
        }
        if (error.code === 'RUT_INVALID') {
          setErrorCampo(error.message);
          return;
        }
        setErrorGeneral(error.message);
        return;
      }

      setErrorGeneral('No se pudo completar la consulta. Intenta nuevamente.');
    } finally {
      if (peticionEnCurso.current === controller) {
        peticionEnCurso.current = null;
        setConsultando(false);
      }
    }
  }

  return (
    <div className="tarjeta">
      <h1 className="tarjeta__titulo">Consulta de score</h1>
      <p className="tarjeta__subtitulo">
        {esAdmin
          ? 'Tu perfil de administrador permite consultar el score de cualquier RUT.'
          : 'Tu perfil permite consultar únicamente el RUT asociado a tu cuenta.'}
      </p>

      {errorGeneral ? <Alert tone="error">{errorGeneral}</Alert> : null}

      <form
        onSubmit={(event) => {
          // El handler es async y React espera void. `void` descarta la
          // promesa de forma explicita; los errores ya se manejan dentro.
          void onSubmit(event);
        }}
        noValidate
      >
        <Field
          label="RUT a consultar"
          name="rut"
          inputMode="text"
          autoComplete="off"
          placeholder="12.345.678-5"
          value={rut}
          error={errorCampo}
          disabled={consultando}
          hint="Se acepta con o sin puntos y guion."
          onChange={(event) => {
            setRut(event.target.value);
            if (errorCampo) setErrorCampo(undefined);
          }}
          onBlur={formatearAlSalir}
        />

        <SubmitButton loading={consultando} loadingLabel="Consultando...">
          Consultar score
        </SubmitButton>
      </form>

      {resultado ? <ScoreResult resultado={resultado} /> : null}
    </div>
  );
}
