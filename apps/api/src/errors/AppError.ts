/**
 * Error de aplicacion con codigo estable y status HTTP.
 *
 * El `code` es contrato con el frontend: la SPA decide que mensaje mostrar en
 * base al codigo, no al texto, que puede cambiar sin romper clientes.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const badRequest = (code: string, message: string, details?: unknown): AppError =>
  new AppError(400, code, message, details);

export const unauthorized = (code: string, message: string): AppError =>
  new AppError(401, code, message);

export const forbidden = (code: string, message: string): AppError =>
  new AppError(403, code, message);
