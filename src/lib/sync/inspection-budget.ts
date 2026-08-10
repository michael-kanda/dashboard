import { sql } from '@vercel/postgres';

export const URL_INSPECTION_DAILY_LIMIT = 1_800;

function propertyKey(siteUrl: string) {
  return siteUrl.trim().toLowerCase();
}

export async function reserveInspectionQuota(
  siteUrl: string,
  requested: number,
  limit = URL_INSPECTION_DAILY_LIMIT,
): Promise<number> {
  if (requested <= 0) return 0;
  const client = await sql.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO url_inspection_budget (property_key, usage_date, used, updated_at)
       VALUES ($1, CURRENT_DATE, 0, NOW())
       ON CONFLICT (property_key, usage_date) DO NOTHING`,
      [propertyKey(siteUrl)],
    );
    const current = await client.query<{ used: number }>(
      `SELECT used FROM url_inspection_budget
       WHERE property_key = $1 AND usage_date = CURRENT_DATE
       FOR UPDATE`,
      [propertyKey(siteUrl)],
    );
    const used = Number(current.rows[0]?.used ?? 0);
    const granted = Math.max(0, Math.min(requested, limit - used));
    if (granted > 0) {
      await client.query(
        `UPDATE url_inspection_budget
         SET used = used + $2, updated_at = NOW()
         WHERE property_key = $1 AND usage_date = CURRENT_DATE`,
        [propertyKey(siteUrl), granted],
      );
    }
    await client.query('COMMIT');
    return granted;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getRemainingInspectionQuota(
  siteUrl: string,
  limit = URL_INSPECTION_DAILY_LIMIT,
): Promise<number> {
  const { rows } = await sql<{ used: number }>`
    SELECT COALESCE(used, 0)::int AS used
    FROM url_inspection_budget
    WHERE property_key = ${propertyKey(siteUrl)} AND usage_date = CURRENT_DATE
  `;
  return Math.max(0, limit - Number(rows[0]?.used ?? 0));
}

export async function releaseInspectionQuota(siteUrl: string, unused: number) {
  if (unused <= 0) return;
  await sql`
    UPDATE url_inspection_budget
    SET used = GREATEST(0, used - ${unused}), updated_at = NOW()
    WHERE property_key = ${propertyKey(siteUrl)} AND usage_date = CURRENT_DATE
  `;
}

export function nextQuotaResetAt(now = new Date()): Date {
  const reset = new Date(now);
  reset.setUTCHours(24, 5, 0, 0);
  return reset;
}
