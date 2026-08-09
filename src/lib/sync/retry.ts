export function isRetryableInfrastructureError(error: unknown) {
  const candidate = error as {
    message?: string;
    code?: string;
    ['neon:retryable']?: boolean;
  };
  if (candidate?.['neon:retryable'] === true) return true;
  const message = `${candidate?.message ?? ''} ${candidate?.code ?? ''}`.toLowerCase();
  return [
    'control plane request failed',
    'connection terminated',
    'connection reset',
    'econnreset',
    'fetch failed',
    'temporarily unavailable',
    'timeout',
  ].some((fragment) => message.includes(fragment));
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export async function withInfrastructureRetry<T>(
  operation: () => Promise<T>,
  options: {
    attempts?: number;
    initialDelayMs?: number;
    onRetry?: (error: unknown, nextAttempt: number) => void;
  } = {},
) {
  const attempts = Math.max(1, options.attempts ?? 3);
  const initialDelayMs = Math.max(0, options.initialDelayMs ?? 250);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableInfrastructureError(error) || attempt === attempts) throw error;
      options.onRetry?.(error, attempt + 1);
      await wait(initialDelayMs * (2 ** (attempt - 1)));
    }
  }

  throw lastError;
}
