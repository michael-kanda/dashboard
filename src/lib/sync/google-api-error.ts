export type GoogleApiErrorKind = 'transient' | 'quota' | 'permanent' | 'unknown';

export interface ClassifiedGoogleApiError {
  kind: GoogleApiErrorKind;
  status: number | null;
  reason: string | null;
  message: string;
  retryable: boolean;
  blocksSnapshotWrite: boolean;
}

const TRANSIENT_CODES = new Set([
  'ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'EAI_AGAIN', 'EPIPE', 'ENOTFOUND',
  'ERR_SOCKET_CONNECTION_TIMEOUT', 'UND_ERR_CONNECT_TIMEOUT',
]);
const QUOTA_REASONS = new Set([
  'quotaExceeded', 'rateLimitExceeded', 'userRateLimitExceeded',
  'dailyLimitExceeded', 'RESOURCE_EXHAUSTED',
]);
const PERMANENT_REASONS = new Set([
  'forbidden', 'permissionDenied', 'PERMISSION_DENIED', 'insufficientPermissions',
  'notFound', 'NOT_FOUND', 'unauthorized', 'UNAUTHENTICATED', 'INVALID_ARGUMENT',
  'badRequest', 'invalid', 'accessNotConfigured',
]);

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' ? value as Record<string, any> : null;
}

function readStatus(error: unknown): number | null {
  const candidate = asRecord(error);
  const raw = candidate?.status
    ?? candidate?.code
    ?? candidate?.response?.status
    ?? candidate?.response?.data?.error?.code;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 100 && parsed < 600 ? parsed : null;
}

function readReason(error: unknown): string | null {
  const candidate = asRecord(error);
  const reason = candidate?.errors?.[0]?.reason
    ?? candidate?.response?.data?.error?.errors?.[0]?.reason
    ?? candidate?.response?.data?.error?.status
    ?? (typeof candidate?.code === 'string' ? candidate.code : null);
  return typeof reason === 'string' && reason ? reason : null;
}

export function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  const nested = asRecord(error)?.response?.data?.error?.message;
  if (typeof nested === 'string' && nested) return nested;
  const text = String(error ?? '');
  return text && text !== '[object Object]' ? text : 'Unbekannter Google-API-Fehler';
}

export function classifyGoogleApiError(error: unknown): ClassifiedGoogleApiError {
  const status = readStatus(error);
  const reason = readReason(error);
  const message = readErrorMessage(error);
  const haystack = `${reason ?? ''} ${message}`.toLowerCase();
  const base = { status, reason, message };

  if (
    status === 429
    || (reason !== null && QUOTA_REASONS.has(reason))
    || haystack.includes('quota')
    || haystack.includes('rate limit')
    || haystack.includes('ratelimit')
    || haystack.includes('resource_exhausted')
  ) {
    return { ...base, kind: 'quota', retryable: true, blocksSnapshotWrite: true };
  }

  if (
    (reason !== null && TRANSIENT_CODES.has(reason))
    || (status !== null && status >= 500)
    || haystack.includes('timeout')
    || haystack.includes('operation was aborted')
    || haystack.includes('socket hang up')
    || haystack.includes('network')
  ) {
    return { ...base, kind: 'transient', retryable: true, blocksSnapshotWrite: true };
  }

  if (
    status === 400 || status === 401 || status === 403 || status === 404
    || (reason !== null && PERMANENT_REASONS.has(reason))
    || haystack.includes('permission denied')
    || haystack.includes('insufficient permission')
    || haystack.includes('forbidden')
    || haystack.includes('unauthorized')
    || haystack.includes('not found')
    || haystack.includes('invalid argument')
  ) {
    return { ...base, kind: 'permanent', retryable: false, blocksSnapshotWrite: false };
  }

  return { ...base, kind: 'unknown', retryable: true, blocksSnapshotWrite: true };
}

export function isQuotaError(error: unknown): boolean {
  return classifyGoogleApiError(error).kind === 'quota';
}

export function isPermanentConfigurationError(error: unknown): boolean {
  return classifyGoogleApiError(error).kind === 'permanent';
}
