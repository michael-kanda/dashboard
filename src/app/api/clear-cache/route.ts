import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';
import { INVALIDATED_CACHE_TIMESTAMP } from '@/lib/sync/cache-policy';

type ClearCacheBody = {
  dateRange?: string;
  userId?: string;
};

async function isSuperAdmin() {
  const session = await auth();
  return session?.user?.role === 'SUPERADMIN';
}

function parseBody(value: unknown): ClearCacheBody {
  if (!value || typeof value !== 'object') return {};

  const body = value as Record<string, unknown>;
  return {
    dateRange: typeof body.dateRange === 'string' && body.dateRange.trim()
      ? body.dateRange.trim()
      : undefined,
    userId: typeof body.userId === 'string' && body.userId.trim()
      ? body.userId.trim()
      : undefined,
  };
}

export async function POST(request: NextRequest) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  }

  try {
    // KORREKTUR: Robusteres Parsing des Request-Bodies.
    // Verhindert Absturz ("SyntaxError"), wenn das Frontend keinen Body sendet.
    let body: ClearCacheBody = {};
    try {
      const text = await request.text();
      if (text && text.trim().length > 0) {
        body = parseBody(JSON.parse(text));
      }
    } catch {
      return NextResponse.json({ error: 'Ungueltiger JSON-Body' }, { status: 400 });
    }

    const { dateRange, userId } = body;

    // Vorhandene Snapshots bleiben sichtbar, bis die Synchronisierung neue Daten liefert.
    if (!userId) {
      if (dateRange) {
        const result = await sql`
          UPDATE google_data_cache
          SET last_fetched = ${INVALIDATED_CACHE_TIMESTAMP}::timestamptz
          WHERE date_range = ${dateRange}
        `;
        return NextResponse.json({ 
          success: true, 
          message: `Daten für ${dateRange} zur Aktualisierung vorgemerkt`,
          cleared: dateRange,
          rowsMarkedStale: result.rowCount
        });
      } else {
        const result = await sql`
          UPDATE google_data_cache
          SET last_fetched = ${INVALIDATED_CACHE_TIMESTAMP}::timestamptz
        `;
        return NextResponse.json({ 
          success: true, 
          message: 'Alle vorhandenen Daten zur Aktualisierung vorgemerkt',
          cleared: 'all',
          rowsMarkedStale: result.rowCount
        });
      }
    }

    if (dateRange) {
      const result = await sql`
        UPDATE google_data_cache
        SET last_fetched = ${INVALIDATED_CACHE_TIMESTAMP}::timestamptz
        WHERE user_id = ${userId}::uuid AND date_range = ${dateRange}
      `;
      return NextResponse.json({ 
        success: true, 
        message: `Daten für ${dateRange} zur Aktualisierung vorgemerkt`,
        cleared: dateRange,
        userId,
        rowsMarkedStale: result.rowCount
      });
    } else {
      const result = await sql`
        UPDATE google_data_cache
        SET last_fetched = ${INVALIDATED_CACHE_TIMESTAMP}::timestamptz
        WHERE user_id = ${userId}::uuid
      `;
      return NextResponse.json({ 
        success: true, 
        message: 'Vorhandene Daten zur Aktualisierung vorgemerkt',
        cleared: 'all',
        userId,
        rowsMarkedStale: result.rowCount
      });
    }

  } catch (error: unknown) {
    console.error('[Clear Cache] CRITICAL Error:', error);
    return NextResponse.json(
      {
        error: 'Daten konnten nicht zur Aktualisierung vorgemerkt werden',
        details: error instanceof Error ? error.message : 'Unbekannter Fehler',
      },
      { status: 500 }
    );
  }
}

// GET zum Anzeigen aller Caches (Superadmin View)
export async function GET(request: NextRequest) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    let query;
    if (userId) {
      // Spezifischer User
      query = sql`
        SELECT 
          u.email,
          c.user_id,
          c.date_range, 
          c.last_fetched, 
          c.data->'kpis'->'sessions'->>'value' as ga4_sessions,
          c.data->'kpis'->'clicks'->>'value' as gsc_clicks,
          c.data->'apiErrors' as api_errors
        FROM google_data_cache c
        JOIN users u ON u.id = c.user_id
        WHERE c.user_id = ${userId}::uuid
        ORDER BY c.last_fetched DESC
      `;
    } else {
      // Alle User (Superadmin)
      query = sql`
        SELECT 
          u.email,
          c.user_id,
          c.date_range, 
          c.last_fetched, 
          c.data->'kpis'->'sessions'->>'value' as ga4_sessions,
          c.data->'kpis'->'clicks'->>'value' as gsc_clicks,
          c.data->'apiErrors' as api_errors
        FROM google_data_cache c
        JOIN users u ON u.id = c.user_id
        ORDER BY c.last_fetched DESC
        LIMIT 100
      `;
    }

    const { rows } = await query;

    const cacheInfo = rows.map(row => {
      const lastFetched = new Date(row.last_fetched);
      const ageHours = (Date.now() - lastFetched.getTime()) / (1000 * 60 * 60);
      
      return {
        userId: row.user_id,
        email: row.email,
        dateRange: row.date_range,
        lastFetched: lastFetched.toISOString(),
        ageHours: parseFloat(ageHours.toFixed(1)),
        hasGA4Data: row.ga4_sessions && parseInt(row.ga4_sessions) > 0,
        hasGSCData: row.gsc_clicks && parseInt(row.gsc_clicks) > 0,
        hasErrors: !!row.api_errors,
        ga4Sessions: row.ga4_sessions,
        gscClicks: row.gsc_clicks
      };
    });

    return NextResponse.json({
      success: true,
      mode: userId ? 'single-user' : 'all-users',
      cacheEntries: cacheInfo,
      totalEntries: cacheInfo.length
    });

  } catch (error: unknown) {
    console.error('[Cache Info] Error:', error);
    return NextResponse.json(
      {
        error: 'Cache-Info konnte nicht abgerufen werden',
        details: error instanceof Error ? error.message : 'Unbekannter Fehler',
      },
      { status: 500 }
    );
  }
}
