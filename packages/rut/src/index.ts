/**
 * Utilidades de RUT chileno (Rol Unico Tributario).
 *
 * Este modulo es SEGURIDAD-CRITICA: la comparacion entre el RUT del token y el
 * RUT solicitado depende de que ambos lados normalicen exactamente igual. Por eso
 * vive en un paquete compartido y no duplicado en API y SPA: si las dos
 * implementaciones divergieran, se abriria un bypass de autorizacion.
 *
 * @see README.md, seccion "Decisiones tecnicas".
 */

/** Largo minimo del cuerpo (sin DV) aceptado. RUTs de persona parten en 7 digitos. */
const MIN_BODY_LENGTH = 7;
/** Largo maximo del cuerpo (sin DV) aceptado. Empresas llegan a 8 digitos. */
const MAX_BODY_LENGTH = 8;

/** Motivos por los que un RUT puede ser rechazado. */
export type RutErrorCode = 'RUT_EMPTY' | 'RUT_MALFORMED' | 'RUT_OUT_OF_RANGE' | 'RUT_INVALID_DV';

/** Error de dominio con causa tipada, para que la capa HTTP elija el mensaje. */
export class InvalidRutError extends Error {
  readonly code: RutErrorCode;
  /** DV correcto segun modulo 11. Solo presente cuando code === 'RUT_INVALID_DV'. */
  readonly expectedDv?: string;

  constructor(code: RutErrorCode, message: string, expectedDv?: string) {
    super(message);
    this.name = 'InvalidRutError';
    this.code = code;
    if (expectedDv !== undefined) this.expectedDv = expectedDv;
    Object.setPrototypeOf(this, InvalidRutError.prototype);
  }
}

/** RUT ya validado y descompuesto. */
export interface ParsedRut {
  /** Cuerpo sin puntos ni ceros a la izquierda. Ej: "12345678". */
  readonly body: string;
  /** Digito verificador, siempre mayuscula. Ej: "5" o "K". */
  readonly dv: string;
  /** Forma canonica para comparar y hashear: cuerpo + DV, sin separadores. Ej: "123456785". */
  readonly canonical: string;
  /** Forma de presentacion chilena. Ej: "12.345.678-5". */
  readonly formatted: string;
}

/**
 * Calcula el digito verificador de un cuerpo de RUT usando modulo 11.
 *
 * Se recorre el cuerpo de derecha a izquierda multiplicando por la serie
 * ciclica 2,3,4,5,6,7. El resto de la suma sobre 11 define el DV:
 * 11 -> "0", 10 -> "K", en otro caso el numero.
 *
 * @param body Cuerpo del RUT, solo digitos.
 */
export function computeDv(body: string): string {
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i -= 1) {
    const digit = body.charCodeAt(i) - 48; // '0' === 48
    sum += digit * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

/**
 * Parsea y valida un RUT en cualquier formato de entrada razonable.
 *
 * Acepta "12.345.678-5", "12345678-5", "123456785", "12.345.678 - 5" y
 * variantes con "k" minuscula o ceros a la izquierda. Todas colapsan a la
 * misma forma canonica, lo que evita que el formato sirva como vector de
 * evasion en el control de autorizacion.
 *
 * @throws {InvalidRutError} Si el RUT es vacio, malformado, fuera de rango o con DV incorrecto.
 */
export function parseRut(input: string): ParsedRut {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new InvalidRutError('RUT_EMPTY', 'El RUT es obligatorio.');
  }

  // Se eliminan separadores de presentacion (puntos, guiones, espacios) y se
  // unifica la caja para que "k" y "K" sean el mismo DV.
  const cleaned = input.replace(/[.\-\s]/g, '').toUpperCase();

  if (cleaned.length < 2) {
    throw new InvalidRutError('RUT_MALFORMED', 'El RUT debe incluir cuerpo y digito verificador.');
  }

  const dv = cleaned.slice(-1);
  const rawBody = cleaned.slice(0, -1);

  if (!/^\d+$/.test(rawBody)) {
    throw new InvalidRutError('RUT_MALFORMED', 'El cuerpo del RUT solo puede contener digitos.');
  }
  if (!/^[\dK]$/.test(dv)) {
    throw new InvalidRutError(
      'RUT_MALFORMED',
      'El digito verificador debe ser un numero o la letra K.',
    );
  }

  // Los ceros a la izquierda no cambian el RUT; normalizarlos impide que
  // "01.234.567-4" y "1.234.567-4" se traten como identidades distintas.
  const body = rawBody.replace(/^0+/, '');

  if (body.length < MIN_BODY_LENGTH || body.length > MAX_BODY_LENGTH) {
    throw new InvalidRutError(
      'RUT_OUT_OF_RANGE',
      `El cuerpo del RUT debe tener entre ${MIN_BODY_LENGTH} y ${MAX_BODY_LENGTH} digitos.`,
    );
  }

  const expectedDv = computeDv(body);
  if (dv !== expectedDv) {
    throw new InvalidRutError(
      'RUT_INVALID_DV',
      'El digito verificador no corresponde al cuerpo del RUT.',
      expectedDv,
    );
  }

  return {
    body,
    dv,
    canonical: `${body}${dv}`,
    formatted: `${groupThousands(body)}-${dv}`,
  };
}

/** Variante sin excepciones, comoda para validacion en formularios. */
export function safeParseRut(
  input: string,
): { ok: true; value: ParsedRut } | { ok: false; error: InvalidRutError } {
  try {
    return { ok: true, value: parseRut(input) };
  } catch (error) {
    if (error instanceof InvalidRutError) return { ok: false, error };
    throw error;
  }
}

/** True si el RUT es sintacticamente valido y su DV cuadra. */
export function isValidRut(input: string): boolean {
  return safeParseRut(input).ok;
}

/** Devuelve la forma canonica ("123456785") de un RUT valido. */
export function normalizeRut(input: string): string {
  return parseRut(input).canonical;
}

/** Devuelve la forma de presentacion ("12.345.678-5") de un RUT valido. */
export function formatRut(input: string): string {
  return parseRut(input).formatted;
}

/**
 * Compara dos RUT por identidad real, ignorando diferencias de formato.
 *
 * Es la primitiva que usa el middleware de autorizacion. Devuelve false ante
 * cualquier entrada invalida en vez de lanzar: una comparacion de permisos
 * nunca debe fallar "abierta".
 */
export function areSameRut(a: string, b: string): boolean {
  const parsedA = safeParseRut(a);
  const parsedB = safeParseRut(b);
  if (!parsedA.ok || !parsedB.ok) return false;
  return parsedA.value.canonical === parsedB.value.canonical;
}

/** Inserta los puntos de miles del formato chileno: "12345678" -> "12.345.678". */
function groupThousands(body: string): string {
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
