import { NextRequest, NextResponse } from 'next/server';
import { sql, type VercelPoolClient } from '@vercel/postgres';
import { getGscDataForPagesWithComparison, getSearchConsoleData } from '@/lib/google-api';
import {
  markDataSyncFinished,
  markDataSyncStarted,
} from '@/lib/data-sync-state';
import type { User } from '@/types';

const BATCH_SIZE = 3;
const MAX_EXECUTION_TIME_MS = 240_000;
const GSC_INITIAL_HISTORY_DAYS = 90;
const GSC_INCREMENTAL_DAYS = 7;
const MAX_USERS_PER_RUN = 50;

type GscUser = Pick<User, 'id' | 'email' | 'gsc_site_url'>;

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calculatePageDateRanges() {
  const today = new Date();
  const endDateCurrent = new Date(today);
  endDateCurrent.setDate(endDateCurrent.getDate() - 2);

  const startDateCurrent = new Date(endDateCurrent);
  startDateCurrent.setDate(startDateCurrent.getDate() - 29);

  const endDatePrevious = new Date(startDateCurrent);
  endDatePrevious.setDate(endDatePrevious.getDate() - 1);
  const startDatePrevious = new Date(endDatePrevious);
  startDatePrevious.setDate(startDatePrevious.getDate() - 29);

  return {
    currentRange: {
      startDate: formatDate(startDateCurrent),
      endDate: formatDate(endDateCurrent),
    },
    previousRange: {
      startDate: formatDate(startDatePrevious),
      endDate: formatDate(endDatePrevious),
    },
  };
}

function safeRound(value: number | null | undefined): number {
  return value === null || value === undefined || Number.isNaN(value)
    ? 0
    : Math.round(value);
}

async function updateLandingPages(
  client: VercelPoolClient,
  user: GscUser,
  ranges: ReturnType<typeof calculatePageDateRanges>,
): Promise<number> {
  const { rows: landingPages } = await client.query<{ id: number; url: string }>(
    'SELECT id, url FROM landingpages WHERE user_id::text = $1',
    [user.id],
  );
  if (landingPages.length === 0) return 0;

  const metrics = await getGscDataForPagesWithComparison(
    user.gsc_site_url!,
    landingPages.map((page) => page.url),
    ranges.currentRange,
    ranges.previousRange,
  );
  const pageIdByUrl = new Map(landingPages.map((page) => [page.url, page.id]));
  const updates = Array.from(metrics.entries())
    .map(([url, data]) => {
      const id = pageIdByUrl.get(url);
      if (!id) return null;
      return {
        id,
        clicks: safeRound(data.clicks),
        clicksChange: safeRound(data.clicks_change),
        impressions: safeRound(data.impressions),
        impressionsChange: safeRound(data.impressions_change),
        position: safeRound(data.position),
        positionChange: safeRound(data.position_change),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (updates.length === 0) return 0;

  await client.query(
    `UPDATE landingpages AS lp
     SET
       gsc_klicks = data.clicks,
       gsc_klicks_change = data.clicks_change,
       gsc_impressionen = data.impressions,
       gsc_impressionen_change = data.impressions_change,
       gsc_position = data.position,
       gsc_position_change = data.position_change,
       gsc_last_updated = NOW(),
       gsc_last_range = '30d'
     FROM (
       SELECT *
       FROM UNNEST(
         $1::int[], $2::int[], $3::int[], $4::int[],
         $5::int[], $6::int[], $7::int[]
       )
       AS u(id, clicks, clicks_change, impressions, impressions_change, position, position_change)
     ) AS data
     WHERE lp.id = data.id`,
    [
      updates.map((item) => item.id),
      updates.map((item) => item.clicks),
      updates.map((item) => item.clicksChange),
      updates.map((item) => item.impressions),
      updates.map((item) => item.impressionsChange),
      updates.map((item) => item.position),
      updates.map((item) => item.positionChange),
    ],
  );

  return updates.length;
}

async function updateDailyHistory(
  client: VercelPoolClient,
  siteUrl: string,
): Promise<{ count: number; mode: 'initial' | 'incremental' }> {
  const { rows } = await client.query<{ row_count: string }>(
    'SELECT COUNT(*)::text AS row_count FROM gsc_daily_data WHERE site_url = $1',
    [siteUrl],
  );
  const hasHistory = Number(rows[0]?.row_count ?? 0) >= 30;
  const historyDays = hasHistory ? GSC_INCREMENTAL_DAYS : GSC_INITIAL_HISTORY_DAYS;
  const mode = hasHistory ? 'incremental' : 'initial';

  const end = new Date();
  end.setDate(end.getDate() - 2);
  const start = new Date(end);
  start.setDate(start.getDate() - (historyDays - 1));

  const daily = await getSearchConsoleData(siteUrl, formatDate(start), formatDate(end));
  const byDate = new Map<number, { clicks: number; impressions: number }>();
  for (const point of daily.clicks.daily) {
    byDate.set(point.date, { clicks: point.value, impressions: 0 });
  }
  for (const point of daily.impressions.daily) {
    const entry = byDate.get(point.date) ?? { clicks: 0, impressions: 0 };
    entry.impressions = point.value;
    byDate.set(point.date, entry);
  }
  if (byDate.size === 0) return { count: 0, mode };

  const entries = Array.from(byDate.entries());
  await client.query(
    `INSERT INTO gsc_daily_data (site_url, date, clicks, impressions, updated_at)
     SELECT $1, data.date::date, data.clicks, data.impressions, NOW()
     FROM UNNEST($2::text[], $3::int[], $4::int[])
       AS data(date, clicks, impressions)
     ON CONFLICT (site_url, date)
     DO UPDATE SET
       clicks = EXCLUDED.clicks,
       impressions = EXCLUDED.impressions,
       updated_at = NOW()`,
    [
      siteUrl,
      entries.map(([timestamp]) => formatDate(new Date(timestamp))),
      entries.map(([, values]) => safeRound(values.clicks)),
      entries.map(([, values]) => safeRound(values.impressions)),
    ],
  );

  return { count: entries.length, mode };
}

async function processUser(
  user: GscUser,
  ranges: ReturnType<typeof calculatePageDateRanges>,
) {
  const logPrefix = `[GSC ${user.email}]`;
  let client: VercelPoolClient | null = null;

  try {
    await markDataSyncStarted(user.id, 'gsc-daily');
    client = await sql.connect();
    const updatedPages = await updateLandingPages(client, user, ranges);
    const daily = await updateDailyHistory(client, user.gsc_site_url!);
    await markDataSyncFinished(user.id, 'gsc-daily', { success: true });
    console.log(
      `${logPrefix} OK: ${updatedPages} Landingpages, ${daily.count} Tageswerte (${daily.mode})`,
    );
    return { success: true as const, updatedPages, dailyRows: daily.count, mode: daily.mode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markDataSyncFinished(user.id, 'gsc-daily', { success: false, error: message });
    console.error(`${logPrefix} Fehler:`, message);
    return { success: false as const, error: message };
  } finally {
    client?.release();
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { rows } = await sql<GscUser>`
      SELECT u.id::text, u.email, u.gsc_site_url
      FROM users u
      LEFT JOIN project_data_sync_state state
        ON state.user_id = u.id AND state.source = 'gsc-daily'
      WHERE u.role = 'BENUTZER'
        AND u.gsc_site_url IS NOT NULL
        AND u.gsc_site_url != ''
        AND (state.next_sync_at IS NULL OR state.next_sync_at <= NOW())
      ORDER BY
        COALESCE(state.last_attempt_at, '1970-01-01'::timestamptz) ASC,
        u.id ASC
      LIMIT ${MAX_USERS_PER_RUN}
    `;
    const users = rows;
    const ranges = calculatePageDateRanges();
    let processed = 0;
    let updatedPages = 0;
    let dailyRows = 0;
    let initialBackfills = 0;
    const errors: string[] = [];

    for (let index = 0; index < users.length; index += BATCH_SIZE) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) break;
      const batch = users.slice(index, index + BATCH_SIZE);
      const results = await Promise.all(batch.map((user) => processUser(user, ranges)));
      for (let resultIndex = 0; resultIndex < results.length; resultIndex++) {
        const result = results[resultIndex];
        processed++;
        if (result.success) {
          updatedPages += result.updatedPages;
          dailyRows += result.dailyRows;
          if (result.mode === 'initial') initialBackfills++;
        } else {
          errors.push(`${batch[resultIndex].email}: ${result.error}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      processedUsers: processed,
      queuedUsers: users.length,
      pagesUpdated: updatedPages,
      dailyRowsUpserted: dailyRows,
      initialBackfills,
      incrementalWindowDays: GSC_INCREMENTAL_DAYS,
      durationSeconds: (Date.now() - startTime) / 1000,
      incomplete: processed < users.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CRON GSC] Fataler Fehler:', message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
