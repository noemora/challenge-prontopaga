import type { ScoreResponse } from '../api/types.js';

/** Umbrales de interpretacion del score. */
const UMBRAL_ALTO = 70;
const UMBRAL_MEDIO = 40;

type Nivel = 'alto' | 'medio' | 'bajo';

function nivelDe(score: number): Nivel {
  if (score >= UMBRAL_ALTO) return 'alto';
  if (score >= UMBRAL_MEDIO) return 'medio';
  return 'bajo';
}

const ETIQUETA_NIVEL: Record<Nivel, string> = {
  alto: 'Riesgo bajo',
  medio: 'Riesgo medio',
  bajo: 'Riesgo alto',
};

/**
 * Formatea la marca temporal UTC de la API a la zona horaria del navegador.
 *
 * La API responde siempre en UTC, que es lo correcto para un dato de sistema;
 * la conversion a hora local es responsabilidad de la capa de presentacion.
 */
function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(fecha);
}

/**
 * Resultado de una consulta de score.
 *
 * El color no es el unico portador de significado: junto a la barra se muestra
 * siempre la etiqueta textual del nivel, para que la lectura no dependa de
 * distinguir verde de rojo.
 */
export function ScoreResult({ resultado }: { resultado: ScoreResponse }) {
  const nivel = nivelDe(resultado.score);

  return (
    <section className="resultado" aria-labelledby="resultado-titulo">
      <h2 className="sr-only" id="resultado-titulo">
        Resultado de la consulta
      </h2>

      <div className="resultado__cabecera">
        <span className="resultado__rut">{resultado.rut}</span>
        <span className="resultado__fecha">Consultado el {formatearFecha(resultado.fecha)}</span>
      </div>

      <div className="medidor">
        <span className={`medidor__valor nivel--${nivel}`}>{resultado.score}</span>
        <span className="medidor__total">/ 100</span>
        <span className={`medidor__nivel nivel--${nivel}`}>{ETIQUETA_NIVEL[nivel]}</span>
      </div>

      <div
        className="barra"
        role="meter"
        aria-valuenow={resultado.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Score financiero: ${resultado.score} de 100. ${ETIQUETA_NIVEL[nivel]}.`}
      >
        <div
          className={`barra__relleno nivel--${nivel}`}
          style={{ width: `${resultado.score}%`, backgroundColor: 'currentColor' }}
        />
      </div>
    </section>
  );
}
