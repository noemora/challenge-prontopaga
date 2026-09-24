import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { useAuth } from '../auth/useAuth.js';
import { Alert } from '../components/Alert.js';
import { Field } from '../components/Field.js';
import { SubmitButton } from '../components/SubmitButton.js';

/**
 * Cuentas del directorio mock.
 *
 * Se muestran en pantalla a proposito: el enunciado plantea credenciales
 * simuladas y esto permite evaluar la aplicacion sin consultar el README. En un
 * sistema real este bloque no existiria.
 */
const CUENTAS_DEMO = [
  { email: 'admin@prontopaga.cl', password: 'Admin123!', nota: 'admin — consulta cualquier RUT' },
  { email: 'juan.perez@example.cl', password: 'User123!', nota: 'user — 12.345.678-5' },
  { email: 'maria.soto@example.cl', password: 'User123!', nota: 'user — 18.765.432-7' },
] as const;

interface ErroresFormulario {
  email?: string;
  password?: string;
}

/** Validacion en cliente: mejora la respuesta inmediata, no sustituye a la del servidor. */
function validar(email: string, password: string): ErroresFormulario {
  const errores: ErroresFormulario = {};

  if (email.trim() === '') errores.email = 'Ingresa tu email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    errores.email = 'El email no tiene un formato válido.';

  if (password === '') errores.password = 'Ingresa tu contraseña.';

  return errores;
}

export function LoginPage() {
  const { session, logoutReason, iniciarSesion } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState<ErroresFormulario>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (session) return <Navigate to="/consulta" replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorGeneral(null);

    const encontrados = validar(email, password);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    setEnviando(true);
    try {
      await iniciarSesion(email.trim(), password);
    } catch (error) {
      setErrorGeneral(
        error instanceof ApiError
          ? error.message
          : 'No se pudo iniciar sesión. Intenta nuevamente.',
      );
      // La contrasena se limpia tras un fallo para no dejarla en el DOM.
      setPassword('');
    } finally {
      setEnviando(false);
    }
  }

  function usarCuenta(cuenta: (typeof CUENTAS_DEMO)[number]) {
    setEmail(cuenta.email);
    setPassword(cuenta.password);
    setErrores({});
    setErrorGeneral(null);
  }

  return (
    <div className="tarjeta">
      <h1 className="tarjeta__titulo">Iniciar sesión</h1>
      <p className="tarjeta__subtitulo">Accede para consultar el score de riesgo financiero.</p>

      {logoutReason ? <Alert tone="info">{logoutReason}</Alert> : null}
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
          label="Email"
          type="email"
          name="email"
          autoComplete="username"
          placeholder="tu@empresa.cl"
          value={email}
          error={errores.email}
          disabled={enviando}
          onChange={(event) => setEmail(event.target.value)}
        />

        <Field
          label="Contraseña"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          error={errores.password}
          disabled={enviando}
          onChange={(event) => setPassword(event.target.value)}
        />

        <SubmitButton loading={enviando} loadingLabel="Verificando...">
          Entrar
        </SubmitButton>
      </form>

      <div className="demo">
        <h2 className="demo__titulo">Cuentas de prueba</h2>
        <div className="demo__lista">
          {CUENTAS_DEMO.map((cuenta) => (
            <div className="demo__item" key={cuenta.email}>
              <div>
                <div className="demo__cuenta">
                  {cuenta.email} / {cuenta.password}
                </div>
                <div className="campo__ayuda">{cuenta.nota}</div>
              </div>
              <button
                type="button"
                className="boton boton--secundario"
                onClick={() => usarCuenta(cuenta)}
              >
                Usar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
