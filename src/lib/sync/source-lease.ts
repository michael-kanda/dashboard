import { randomUUID } from 'node:crypto';
import { sql } from '@vercel/postgres';

const LEASE_SECONDS = 90;
const HEARTBEAT_SECONDS = 25;

interface SourceLease {
  userId: string;
  source: string;
  ownerToken: string;
}

async function acquireSourceLease(userId: string, source: string): Promise<SourceLease | null> {
  const ownerToken = randomUUID();
  const { rows } = await sql`
    INSERT INTO project_sync_leases (user_id, source, owner_token, lease_until, updated_at)
    VALUES (
      ${userId}::uuid,
      ${source},
      ${ownerToken}::uuid,
      NOW() + (${LEASE_SECONDS} * INTERVAL '1 second'),
      NOW()
    )
    ON CONFLICT (user_id, source)
    DO UPDATE SET
      owner_token = EXCLUDED.owner_token,
      lease_until = EXCLUDED.lease_until,
      updated_at = NOW()
    WHERE project_sync_leases.lease_until <= NOW()
    RETURNING user_id
  `;
  return rows.length > 0 ? { userId, source, ownerToken } : null;
}

async function extendSourceLease(lease: SourceLease) {
  await sql`
    UPDATE project_sync_leases
    SET
      lease_until = NOW() + (${LEASE_SECONDS} * INTERVAL '1 second'),
      updated_at = NOW()
    WHERE user_id = ${lease.userId}::uuid
      AND source = ${lease.source}
      AND owner_token = ${lease.ownerToken}::uuid
  `;
}

async function releaseSourceLease(lease: SourceLease) {
  await sql`
    DELETE FROM project_sync_leases
    WHERE user_id = ${lease.userId}::uuid
      AND source = ${lease.source}
      AND owner_token = ${lease.ownerToken}::uuid
  `;
}

export async function runWithSourceLease<T>(
  userId: string,
  source: string,
  task: () => Promise<T>,
): Promise<{ acquired: false } | { acquired: true; value: T }> {
  const lease = await acquireSourceLease(userId, source);
  if (!lease) return { acquired: false };

  const heartbeat = setInterval(() => {
    void extendSourceLease(lease).catch((error) => {
      console.warn('[Sync Lease] Heartbeat fehlgeschlagen:', error);
    });
  }, HEARTBEAT_SECONDS * 1000);
  heartbeat.unref?.();

  try {
    return { acquired: true, value: await task() };
  } finally {
    clearInterval(heartbeat);
    await releaseSourceLease(lease).catch((error) => {
      console.warn('[Sync Lease] Freigabe fehlgeschlagen:', error);
    });
  }
}
