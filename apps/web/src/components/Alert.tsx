export type AlertTone = 'error' | 'info';

interface AlertProps {
  tone?: AlertTone;
  children: React.ReactNode;
}

/**
 * Mensaje destacado para el usuario.
 *
 * Los errores usan `role="alert"`, que un lector de pantalla anuncia de
 * inmediato. Los avisos informativos usan `role="status"`, menos intrusivo,
 * porque interrumpir la lectura para una nota que no exige accion es ruido.
 */
export function Alert({ tone = 'error', children }: AlertProps) {
  const esError = tone === 'error';

  return (
    <div className={`aviso aviso--${tone}`} role={esError ? 'alert' : 'status'}>
      <span className="aviso__icono" aria-hidden="true">
        {esError ? '!' : 'i'}
      </span>
      <span>{children}</span>
    </div>
  );
}
