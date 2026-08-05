import { sql } from '@vercel/postgres';
import type { User } from '@/lib/schemas';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { runWithSourceLease } from '@/lib/sync/source-lease';

export async function syncDashboardProjectSnapshot(userId: string, dateRange: string) {
  const { rows } = await sql`
    SELECT *
    FROM users
    WHERE id = ${userId}::uuid
    LIMIT 1
  `;
  const project = rows[0] as unknown as User | undefined;
  if (!project) throw new Error('Projekt nicht gefunden');

  const data = await getOrFetchGoogleData(project, dateRange, true);
  if (!data) throw new Error('Keine Dashboard-Daten erzeugt');
  const criticalError = data.apiErrors?.ga4 || data.apiErrors?.gsc;
  if (criticalError) throw new Error(String(criticalError));

  return data;
}

export async function trySyncDashboardProjectSnapshot(userId: string, dateRange: string) {
  return runWithSourceLease(
    userId,
    'dashboard',
    () => syncDashboardProjectSnapshot(userId, dateRange),
  );
}
