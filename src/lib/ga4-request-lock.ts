import { sql } from '@vercel/postgres';

export interface Ga4RequestLock {
  lockKey: string;
  token: string;
}

const DEFAULT_GA4_LOCK_TTL_MS = 2 * 60 * 1000;

let lockTableReady: Promise<void> | null = null;

async function ensureGa4LockTable(): Promise<void> {
  if (!lockTableReady) {
    lockTableReady = sql`
      CREATE TABLE IF NOT EXISTS ga4_request_locks (
        lock_key TEXT PRIMARY KEY,
        lock_token TEXT NOT NULL,
        locked_until TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `.then(() => undefined);
  }

  await lockTableReady;
}

export function getGa4PropertyLockKey(propertyId: string | null | undefined): string | null {
  const normalized = String(propertyId ?? '').trim();
  return normalized ? `ga4-property:${normalized}` : null;
}

export function getGa4PropertyLockKeyFromCacheKey(cacheKey: string): string {
  const [, propertyId] = cacheKey.split(':');
  return getGa4PropertyLockKey(propertyId) ?? `ga4-cache:${cacheKey}`;
}

export async function tryAcquireGa4RequestLock(
  lockKey: string,
  ttlMs = DEFAULT_GA4_LOCK_TTL_MS
): Promise<Ga4RequestLock | null> {
  try {
    await ensureGa4LockTable();

    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const lockedUntil = new Date(Date.now() + ttlMs).toISOString();
    const { rows } = await sql`
      INSERT INTO ga4_request_locks (lock_key, lock_token, locked_until, updated_at)
      VALUES (${lockKey}, ${token}, ${lockedUntil}, now())
      ON CONFLICT (lock_key)
      DO UPDATE SET
        lock_token = EXCLUDED.lock_token,
        locked_until = EXCLUDED.locked_until,
        updated_at = now()
      WHERE ga4_request_locks.locked_until < now()
      RETURNING lock_token
    `;

    return rows.length > 0 ? { lockKey, token } : null;
  } catch (err) {
    console.warn('[GA4 Lock] Lock konnte nicht geprüft werden, fahre fail-open fort:', err);
    return {
      lockKey,
      token: `fail-open-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
  }
}

export async function releaseGa4RequestLock(lock: Ga4RequestLock | null): Promise<void> {
  if (!lock || lock.token.startsWith('fail-open-')) return;

  try {
    await sql`
      DELETE FROM ga4_request_locks
      WHERE lock_key = ${lock.lockKey}
        AND lock_token = ${lock.token}
    `;
  } catch (err) {
    console.warn('[GA4 Lock] Freigabe fehlgeschlagen:', err);
  }
}
