import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import {
  markDataSyncFinished,
  markDataSyncStarted,
} from '@/lib/data-sync-state';
import type { User } from '@/lib/schemas';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Ein kalter GA4-Projektlauf darf bis zu 120 Sekunden benötigen. Deshalb
// startet der Cron nach 150 Sekunden kein weiteres Projekt mehr und lässt der
// aktuell laufenden Verarbeitung genügend Abstand zum 300-Sekunden-Limit.
const MAX_EXECUTION_TIME_MS = 150_000;
const CACHE_REFRESH_THRESHOLD_HOURS = 20;
const MAX_USERS_PER_RUN = 50;

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    try {
      await sql`
        DELETE FROM ga4_ai_traffic_cache
        WHERE created_at < NOW() - INTERVAL '14 days'
      `;
    } catch (cleanupError) {
      console.warn(
        '[CRON Cache] Alte GA4-Cachezeilen konnten nicht bereinigt werden:',
        cleanupError instanceof Error ? cleanupError.message : cleanupError,
      );
    }

    const { rows } = await sql`
      SELECT u.*
      FROM users u
      LEFT JOIN google_data_cache cache
        ON cache.user_id = u.id AND cache.date_range = '30d'
      LEFT JOIN project_data_sync_state state
        ON state.user_id = u.id AND state.source = 'dashboard-30d'
      WHERE u.role = 'BENUTZER'
        AND (u.gsc_site_url IS NOT NULL OR u.ga4_property_id IS NOT NULL)
        AND (
          cache.last_fetched IS NULL
          OR cache.last_fetched < NOW() - INTERVAL '20 hours'
        )
        AND (state.next_sync_at IS NULL OR state.next_sync_at <= NOW())
      ORDER BY
        COALESCE(state.last_attempt_at, '1970-01-01'::timestamptz) ASC,
        COALESCE(cache.last_fetched, '1970-01-01'::timestamptz) ASC,
        u.id ASC
      LIMIT ${MAX_USERS_PER_RUN}
    `;
    const users = rows as unknown as User[];

    let processed = 0;
    let successful = 0;
    let failed = 0;
    let timeoutReached = false;
    const errors: string[] = [];

    for (const user of users) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        timeoutReached = true;
        break;
      }

      await markDataSyncStarted(user.id, 'dashboard-30d');
      try {
        const dashboardData = await getOrFetchGoogleData(user, '30d', true);
        if (!dashboardData) throw new Error('Keine Dashboard-Daten erzeugt');
        const criticalError = dashboardData.apiErrors?.ga4 || dashboardData.apiErrors?.gsc;
        if (criticalError) throw new Error(String(criticalError));

        await markDataSyncFinished(user.id, 'dashboard-30d', { success: true });
        successful++;
        console.log(`[CRON Cache] ${user.email}: aktualisiert`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await markDataSyncFinished(user.id, 'dashboard-30d', {
          success: false,
          error: message,
        });
        failed++;
        errors.push(`${user.email}: ${message}`);
        console.error(`[CRON Cache] ${user.email}:`, message);
      }
      processed++;
    }

    return NextResponse.json({
      success: true,
      processed,
      queuedUsers: users.length,
      refreshes: successful,
      failed,
      didTimeout: timeoutReached,
      incomplete: processed < users.length,
      durationSeconds: (Date.now() - startTime) / 1000,
      cacheThresholdHours: CACHE_REFRESH_THRESHOLD_HOURS,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CRON Cache] Fatal:', message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
