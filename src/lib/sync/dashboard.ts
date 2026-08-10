import { sql } from '@vercel/postgres';
import type { User } from '@/lib/schemas';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { runWithSourceLease } from '@/lib/sync/source-lease';
import { classifyGoogleApiError } from '@/lib/sync/google-api-error';

export interface DashboardSyncOptions {
  deadlineAt?: number;
}

export class DashboardSourceError extends Error {
  constructor(
    message: string,
    readonly kind: 'transient' | 'permanent',
    readonly sources: string[],
  ) {
    super(message);
    this.name = 'DashboardSourceError';
  }
}

export async function syncDashboardProjectSnapshot(
  userId: string,
  dateRange: string,
  options: DashboardSyncOptions = {},
) {
  const { rows } = await sql`
    SELECT *
    FROM users
    WHERE id = ${userId}::uuid
    LIMIT 1
  `;
  const project = rows[0] as unknown as User | undefined;
  if (!project) throw new Error('Projekt nicht gefunden');

  const data = await getOrFetchGoogleData(project, dateRange, true, {
    deadlineAt: options.deadlineAt,
  });
  if (!data) throw new Error('Keine Dashboard-Daten erzeugt');

  const failures = (['gsc', 'ga4'] as const).flatMap((source) => {
    const raw = data.apiErrors?.[source];
    return raw ? [{ source: source.toUpperCase(), raw, classified: classifyGoogleApiError(raw) }] : [];
  });
  if (failures.length > 0) {
    const kind = failures.some(({ classified }) => classified.kind !== 'permanent')
      ? 'transient'
      : 'permanent';
    throw new DashboardSourceError(
      failures.map(({ source, classified }) => `${source}: ${classified.message}`).join(' | '),
      kind,
      failures.map(({ source }) => source),
    );
  }

  return data;
}

export async function trySyncDashboardProjectSnapshot(
  userId: string,
  dateRange: string,
  options: DashboardSyncOptions = {},
) {
  return runWithSourceLease(
    userId,
    `dashboard:${dateRange || '30d'}`,
    () => syncDashboardProjectSnapshot(userId, dateRange, options),
  );
}
