interface SubmitButtonProps {
  /** Muestra el indicador de carga y bloquea el envio. */
  loading: boolean;
  children: React.ReactNode;
  loadingLabel: string;
}

/**
 * Boton de envio con estado de carga.
 *
 * Mientras carga se deshabilita —lo que evita envios duplicados— y expone
 * `aria-busy` para que la espera sea perceptible tambien sin ver el girador.
 */
export function SubmitButton({ loading, loadingLabel, children }: SubmitButtonProps) {
  return (
    <button type="submit" className="boton boton--primario" disabled={loading} aria-busy={loading}>
      {loading ? (
        <>
          <span className="girador" aria-hidden="true" />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
