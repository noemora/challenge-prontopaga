const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/** Forma de error que emite la API. */
interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Error de API con el codigo estable que devuelve el backend.
 *
 * La UI decide que mostrar en funcion de `code`, no del texto: el mensaje puede
 * cambiar sin romper la logica del cliente.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True cuando la sesion dejo de ser valida y hay que volver al login. */
  get isSessionExpired(): boolean {
    return this.status === 401 && this.code !== 'INVALID_CREDENTIALS';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Access token a enviar como Bearer. */
  token?: string | undefined;
  signal?: AbortSignal | undefined;
}

/**
 * Cliente HTTP de la aplicacion.
 *
 * Centraliza la URL base, la cabecera de autorizacion y —sobre todo— la
 * traduccion de cualquier fallo a un `ApiError`. Que toda la app reciba un
 * unico tipo de error evita que cada componente tenga que distinguir entre un
 * 4xx, una respuesta no-JSON y una caida de red.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    // Una peticion abortada no es un fallo: la propaga tal cual para que quien
    // llama pueda ignorarla en lugar de mostrar un error al usuario.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'No se pudo conectar con el servidor. Revisa tu conexion e intenta nuevamente.',
    );
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = payload as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      parsed?.error?.code ?? 'UNKNOWN_ERROR',
      parsed?.error?.message ?? 'Ocurrio un error inesperado. Intenta nuevamente.',
      parsed?.error?.details,
    );
  }

  return payload as T;
}
