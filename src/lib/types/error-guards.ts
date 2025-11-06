/**
 * Type guards para Error objects
 */

/**
 * Verifica se o valor é uma instância de Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Verifica se o valor tem propriedade message (como Error)
 */
export function hasMessage(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as { message: unknown }).message === 'string'
  );
}

/**
 * Verifica se o valor tem propriedade stack (como Error)
 */
export function hasStack(value: unknown): value is { stack: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'stack' in value &&
    typeof (value as { stack: unknown }).stack === 'string'
  );
}

/**
 * Extrai mensagem de erro de forma segura
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (hasMessage(error)) {
    return error.message;
  }
  return String(error);
}

/**
 * Extrai stack trace de forma segura
 */
export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) {
    return error.stack;
  }
  if (hasStack(error)) {
    return error.stack;
  }
  return undefined;
}

/**
 * Verifica se o valor tem propriedade status (como ApiError)
 */
export function hasStatus(
  value: unknown,
): value is { status: number; [key: string]: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof (value as { status: unknown }).status === 'number'
  );
}

/**
 * Verifica se o valor tem propriedade code (como Stripe error)
 */
export function hasCode(
  value: unknown,
): value is { code: string; [key: string]: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as { code: unknown }).code === 'string'
  );
}
