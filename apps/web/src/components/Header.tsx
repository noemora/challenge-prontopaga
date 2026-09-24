import { useAuth } from '../auth/useAuth.js';

/** Barra superior con la identidad de la sesion y el cierre de sesion. */
export function Header() {
  const { session, cerrarSesion } = useAuth();

  return (
    <header className="cabecera">
      <div className="cabecera__marca">
        <span className="cabecera__logo" aria-hidden="true">
          RF
        </span>
        <span>Consulta de Riesgo Financiero</span>
      </div>

      {session ? (
        <div className="cabecera__sesion">
          <span>{session.user.email}</span>
          <span className="etiqueta">{session.user.role}</span>
          <button type="button" className="boton boton--secundario" onClick={() => cerrarSesion()}>
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </header>
  );
}
