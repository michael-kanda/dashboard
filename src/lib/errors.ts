// Helfer fuer `catch (error: unknown)`: Fehlermeldung und typische Zusatzfelder
// lesen, ohne den gefangenen Wert als `any` zu behandeln.

/**
 * Felder, die Fehler von gaxios/googleapis, axios, fetch und gRPC haeufig tragen.
 * Alles ist optional und ungeprueft: Werte wie unzuverlaessige Daten behandeln.
 */
export interface ErrorFields {
  message?: string;
  name?: string;
  stack?: string;
  code?: string | number;
  status?: string | number;
  type?: string;
  errors?: { reason?: string }[];
  cause?: { message?: string; type?: string };
  error?: { type?: string };
  config?: { signal?: { aborted?: boolean } };
  response?: {
    status?: number;
    data?: {
      error?: { message?: string; code?: string | number; status?: string; errors?: { reason?: string }[] };
    };
  };
}

/** Objektsicht auf einen gefangenen Wert; Primitive und null ergeben ein leeres Objekt. */
export function errorFields(error: unknown): ErrorFields {
  return typeof error === 'object' && error !== null ? (error as ErrorFields) : {};
}

/**
 * Fehlermeldung eines beliebigen Throwables: `message` bei Error-Instanzen und
 * Objekten mit String-`message`, sonst `String(error)`.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const { message } = errorFields(error);
  return typeof message === 'string' ? message : String(error);
}
