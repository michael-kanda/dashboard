// src/app/api/cron/refresh-all-gsc/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getGscDataForPagesWithComparison, getSearchConsoleData } from '@/lib/google-api';
import type { User } from '@/types';

// Konfiguration
const BATCH_SIZE = 5;
const MAX_EXECUTION_TIME_MS = 50 * 1000; // 50s Safety-Buffer
// Wie viele Tage Tagesdaten der Cron pro Lauf holt. 90 Tage ergibt ein
// rollendes Fenster: ältere Tage bleiben in der Tabelle (durch UPSERT
// werden sie nicht gelöscht), neue Tage kommen jede Nacht dazu.
const GSC_DAILY_HISTORY_DAYS = 90;

// === Hilfsfunktionen ===

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calculateDateRanges() {
  const today = new Date();
  const endDateCurrent = new Date(today);
  endDateCurrent.setDate(endDateCurrent.getDate() - 2);
  
  const startDateCurrent = new Date(endDateCurrent);
  const daysBack = 29; 
  startDateCurrent.setDate(startDateCurrent.getDate() - daysBack);
  
  const endDatePrevious = new Date(startDateCurrent);
  endDatePrevious.setDate(endDatePrevious.getDate() - 1);
  const startDatePrevious = new Date(endDatePrevious);
  startDatePrevious.setDate(startDatePrevious.getDate() - daysBack);
  
  return {
    currentRange: { startDate: formatDate(startDateCurrent), endDate: formatDate(endDateCurrent) },
    previousRange: { startDate: formatDate(startDatePrevious), endDate: formatDate(endDatePrevious) },
  };
}

// Hilfsfunktion für sichere Rundung (null-safe)
function safeRound(value: number | null | undefined): number {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return Math.round(value);
}

// Für Position mit Rundung
function roundPosition(value: number | null | undefined): number {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return Math.round(value);
}

// Verarbeitet EINEN einzelnen User
async function processUser(
  user: Pick<User, 'id' | 'email' | 'gsc_site_url'>, 
  ranges: ReturnType<typeof calculateDateRanges>
) {
  const logPrefix = `[User ${user.email}]`;
  let updatedCount = 0;

  try {
    const client = await sql.connect();
    
    try {
      // 1. Landingpages laden
      const { rows: landingpageRows } = await client.query<{ id: number; url: string }>(
        `SELECT id, url FROM landingpages WHERE user_id::text = $1;`,
        [user.id]
      );

      if (landingpageRows.length === 0) {
        client.release();
        return { success: true, count: 0, msg: 'Keine Landingpages' };
      }

      const pageUrls = landingpageRows.map(lp => lp.url);
      const pageIdMap = new Map(landingpageRows.map(lp => [lp.url, lp.id]));

      // 2. GSC Daten holen
      const gscDataMap = await getGscDataForPagesWithComparison(
        user.gsc_site_url!,
        pageUrls,
        ranges.currentRange,
        ranges.previousRange
      );

      // 3. Batch Update in Transaktion
      await client.query('BEGIN');
      
      for (const [url, data] of gscDataMap.entries()) {
        const landingpageId = pageIdMap.get(url);
        if (landingpageId) {
          await client.query(
            `UPDATE landingpages
             SET 
               gsc_klicks = $1, gsc_klicks_change = $2,
               gsc_impressionen = $3, gsc_impressionen_change = $4,
               gsc_position = $5, gsc_position_change = $6,
               gsc_last_updated = NOW(), gsc_last_range = '30d'
             WHERE id = $7;`,
            [
              safeRound(data.clicks),
              safeRound(data.clicks_change),
              safeRound(data.impressions),
              safeRound(data.impressions_change),
              roundPosition(data.position),
              safeRound(data.position_change),
              landingpageId
            ]
          );
          updatedCount++;
        }
      }

      await client.query('COMMIT');

      // 4. Daily-Trend-Daten (für Project-Timeline-Widget) auf ein
      //    rollendes 90-Tage-Fenster updaten. Idempotent via UPSERT.
      let dailyUpserted = 0;
      try {
        const today = new Date();
        const dailyEnd = new Date(today);
        dailyEnd.setDate(dailyEnd.getDate() - 2); // GSC hat 2 Tage Delay
        const dailyStart = new Date(dailyEnd);
        dailyStart.setDate(dailyStart.getDate() - GSC_DAILY_HISTORY_DAYS);

        const daily = await getSearchConsoleData(
          user.gsc_site_url!,
          formatDate(dailyStart),
          formatDate(dailyEnd)
        );

        // Map: timestamp -> { clicks, impressions }
        const byDate = new Map<number, { clicks: number; impressions: number }>();
        for (const p of daily.clicks.daily) {
          byDate.set(p.date, { clicks: p.value, impressions: 0 });
        }
        for (const p of daily.impressions.daily) {
          const e = byDate.get(p.date) ?? { clicks: 0, impressions: 0 };
          e.impressions = p.value;
          byDate.set(p.date, e);
        }

        if (byDate.size > 0) {
          await client.query('BEGIN');
          for (const [ts, vals] of byDate.entries()) {
            const dateStr = formatDate(new Date(ts));
            await client.query(
              `INSERT INTO gsc_daily_data (site_url, date, clicks, impressions, updated_at)
               VALUES ($1, $2, $3, $4, NOW())
               ON CONFLICT (site_url, date)
               DO UPDATE SET
                 clicks      = EXCLUDED.clicks,
                 impressions = EXCLUDED.impressions,
                 updated_at  = NOW();`,
              [user.gsc_site_url, dateStr, safeRound(vals.clicks), safeRound(vals.impressions)]
            );
            dailyUpserted++;
          }
          await client.query('COMMIT');
        }
      } catch (dailyErr: any) {
        // Daily-Sync ist Best-Effort: scheitert er, soll der Page-Update-Teil
        // trotzdem committed bleiben.
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        console.warn(`${logPrefix} Daily-Trend-Sync fehlgeschlagen:`, dailyErr?.message || dailyErr);
      }

      return { success: true, count: updatedCount, dailyUpserted };

    } catch (innerErr) {
      await client.query('ROLLBACK');
      throw innerErr;
    } finally {
      client.release();
    }

  } catch (err: any) {
    console.error(`${logPrefix} Fehler:`, err.message);
    return { success: false, error: err.message };
  }
}

// === MAIN ROUTE ===
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Pro

// ✅ GET statt POST - Vercel Cron sendet GET-Requests!
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // Auth Check - Vercel sendet Authorization Header automatisch
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('[CRON GSC] ❌ Unauthorized - Invalid or missing CRON_SECRET');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  console.log('[CRON GSC] ✅ Authentifizierung erfolgreich, starte Job...');

  // Schema sicherstellen — idempotent. So kann das Project-Timeline-Widget
  // ab dem ersten Cron-Lauf auf gsc_daily_data zugreifen, ohne
  // 'relation does not exist'-Fehler zu werfen.
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS gsc_daily_data (
        site_url    TEXT NOT NULL,
        date        DATE NOT NULL,
        clicks      INT  NOT NULL DEFAULT 0,
        impressions INT  NOT NULL DEFAULT 0,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (site_url, date)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_gsc_daily_site_date ON gsc_daily_data(site_url, date);`;
  } catch (schemaErr: any) {
    console.error('[CRON GSC] Schema-Setup fehlgeschlagen:', schemaErr?.message || schemaErr);
    return NextResponse.json({ message: 'Schema-Setup fehlgeschlagen' }, { status: 500 });
  }

  const { currentRange, previousRange } = calculateDateRanges();
  const ranges = { currentRange, previousRange };

  try {
    // User laden
    const { rows: users } = await sql<Pick<User, 'id' | 'email' | 'gsc_site_url'>>`
      SELECT id, email, gsc_site_url 
      FROM users 
      WHERE role = 'BENUTZER' AND gsc_site_url IS NOT NULL AND gsc_site_url != '';
    `;

    console.log(`[CRON GSC] Starte Batch-Verarbeitung für ${users.length} User.`);

    let processedCount = 0;
    let totalUpdatedPages = 0;
    let totalDailyRows = 0;
    const errors: string[] = [];

    // Batch-Verarbeitung (Parallelisierung)
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      
      // Zeit-Check
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.warn('[CRON GSC] ⚠️ Zeitlimit fast erreicht. Stoppe vorzeitig.');
        errors.push('Zeitlimit erreicht - Job unvollständig');
        break; 
      }

      const batch = users.slice(i, i + BATCH_SIZE);
      console.log(`[CRON GSC] Verarbeite Batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} User)...`);

      const results = await Promise.allSettled(
        batch.map(user => processUser(user, ranges))
      );

      // Ergebnisse auswerten
      results.forEach((res, idx) => {
        const user = batch[idx];
        if (res.status === 'fulfilled') {
          const val = res.value;
          if (val.success) {
            totalUpdatedPages += val.count || 0;
            totalDailyRows  += val.dailyUpserted || 0;
          } else {
            errors.push(`User ${user.email}: ${val.error}`);
          }
        } else {
          errors.push(`User ${user.email}: Kritischer Fehler (Promise rejected)`);
        }
      });

      processedCount += batch.length;
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[CRON GSC] 🏁 Fertig in ${duration.toFixed(1)}s. Seiten: ${totalUpdatedPages}. Daily-Rows: ${totalDailyRows}. Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      processedUsers: processedCount,
      totalUsers: users.length,
      pagesUpdated: totalUpdatedPages,
      dailyRowsUpserted: totalDailyRows,
      durationSeconds: duration,
      errors: errors.length > 0 ? errors : undefined,
      incomplete: processedCount < users.length
    });

  } catch (error: any) {
    console.error('[CRON GSC] Fataler Fehler:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
