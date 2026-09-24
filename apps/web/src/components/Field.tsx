import { useId, type InputHTMLAttributes } from 'react';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  label: string;
  /** Mensaje de error de validacion. Su presencia marca el campo como invalido. */
  error?: string | undefined;
  /** Texto de ayuda permanente bajo el campo. */
  hint?: string | undefined;
}

/**
 * Campo de formulario etiquetado y accesible.
 *
 * Enlaza label, ayuda y error mediante `useId`, de modo que un lector de
 * pantalla anuncie el nombre del campo y el motivo del fallo sin depender de la
 * posicion visual de los textos. El error va en un contenedor `role="alert"`
 * para que se anuncie en cuanto aparece.
 */
export function Field({ label, error, hint, ...inputProps }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>
        {label}
      </label>

      <input
        {...inputProps}
        id={id}
        className="campo__control"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />

      {hint ? (
        <span className="campo__ayuda" id={hintId}>
          {hint}
        </span>
      ) : null}

      {error ? (
        <span className="campo__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
