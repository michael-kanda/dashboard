import { sql, type VercelPoolClient } from '@vercel/postgres';
import { getGscDataForPagesWithComparison, getSearchConsoleData } from '../google-api';
import { markDataSyncFinished, markDataSyncStarted } from '../data-sync-state';

type GscProject = {
  id: string;
  email: string;
  gsc_site_url: string;
};

const GSC_INITIAL_HISTORY_DAYS = 90;
const GSC_INCREMENTAL_DAYS = 7;

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function calculatePageDateRanges() {
  const endDateCurrent = new Date();
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

function safeRound(value: number | null | undefined) {
  return value === null || value === undefined || Number.isNaN(value)
    ? 0
    : Math.round(value);
}

async function updateLandingPages(
  client: VercelPoolClient,
  project: GscProject,
) {
  const { rows: landingPages } = await client.query<{ id: number; url: string }>(
    'SELECT id, url FROM landingpages WHERE user_id::text = $1',
    [project.id],
  );
  if (landingPages.length === 0) return 0;

  const ranges = calculatePageDateRanges();
  const metrics = await getGscDataForPagesWithComparison(
    project.gsc_site_url,
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
       ) AS u(id, clicks, clicks_change, impressions, impressions_change, position, position_change)
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

async function updateDailyHistory(client: VercelPoolClient, siteUrl: string) {
  const { rows } = await client.query<{ row_count: string }>(
    'SELECT COUNT(*)::text AS row_count FROM gsc_daily_data WHERE site_url = $1',
    [siteUrl],
  );
  const hasHistory = Number(rows[0]?.row_count ?? 0) >= 30;
  const historyDays = hasHistory ? GSC_INCREMENTAL_DAYS : GSC_INITIAL_HISTORY_DAYS;
  const mode = hasHistory ? 'incremental' as const : 'initial' as const;
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
     FROM UNNEST($2::text[], $3::int[], $4::int[]) AS data(date, clicks, impressions)
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

export async function syncGscHistoryForProject(userId: string) {
  const { rows } = await sql<GscProject>`
    SELECT id::text, email, gsc_site_url
    FROM users
    WHERE id = ${userId}::uuid
      AND gsc_site_url IS NOT NULL
      AND gsc_site_url != ''
    LIMIT 1
  `;
  const project = rows[0];
  if (!project) throw new Error('Projekt ohne GSC-Konfiguration');

  await markDataSyncStarted(project.id, 'gsc-daily');
  const client = await sql.connect();
  try {
    const updatedPages = await updateLandingPages(client, project);
    const daily = await updateDailyHistory(client, project.gsc_site_url);
    await markDataSyncFinished(project.id, 'gsc-daily', { success: true });
    return { updatedPages, dailyRows: daily.count, mode: daily.mode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markDataSyncFinished(project.id, 'gsc-daily', { success: false, error: message });
    throw error;
  } finally {
    client.release();
  }
}
