// src/app/api/debug-google-cache/route.ts
// Debug-Route zum Überprüfen des Google Cache Status

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth
import { sql } from '@vercel/postgres';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const session = await auth(); // KORRIGIERT: auth() aufgerufen
    
    // Nur Superadmins dürfen dieses Debug-Tool nutzen
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const dateRange = searchParams.get('dateRange');

    // ========== ACTION: LIST ==========
    if (!action || action === 'list') {
      logger.debug('[Debug Cache] Lade alle Cache-Einträge...');
      
      const { rows: cacheEntries } = await sql`
        SELECT 
          gc.user_id::text,
          u.email,
          u.domain,
          gc.date_range,
          gc.last_fetched,
          EXTRACT(EPOCH FROM (NOW() - gc.last_fetched)) / 3600 as age_hours,
          (gc.data->'kpis'->'clicks'->>'value')::int as clicks,
          (gc.data->'kpis'->'sessions'->>'value')::int as sessions
        FROM google_data_cache gc
        INNER JOIN users u ON gc.user_id = u.id
        ORDER BY gc.last_fetched DESC
        LIMIT 50;
      `;

      return NextResponse.json({
        action: 'list',
        count: cacheEntries.length,
        cacheEntries: cacheEntries.map(entry => ({
          userId: entry.user_id,
          email: entry.email,
          domain: entry.domain,
          dateRange: entry.date_range,
          lastFetched: entry.last_fetched,
          ageHours: parseFloat(entry.age_hours).toFixed(2),
          isStale: parseFloat(entry.age_hours) > 48,
          clicks: entry.clicks || 0,
          sessions: entry.sessions || 0
        }))
      });
    }

    // ========== ACTION: DETAILS ==========
    if (action === 'details' && userId && dateRange) {
      logger.debug(`[Debug Cache] Lade Cache-Details für User ${userId}, DateRange ${dateRange}...`);
      
      const { rows } = await sql`
        SELECT 
          gc.user_id::text,
          u.email,
          u.domain,
          gc.date_range,
          gc.last_fetched,
          gc.data,
          EXTRACT(EPOCH FROM (NOW() - gc.last_fetched)) / 3600 as age_hours
        FROM google_data_cache gc
        INNER JOIN users u ON gc.user_id = u.id
        WHERE gc.user_id::text = ${userId} AND gc.date_range = ${dateRange};
      `;

      if (rows.length === 0) {
        return NextResponse.json({
          action: 'details',
          found: false,
          message: 'Kein Cache-Eintrag gefunden'
        }, { status: 404 });
      }

      const entry = rows[0];
      
      return NextResponse.json({
        action: 'details',
        found: true,
        userId: entry.user_id,
        email: entry.email,
        domain: entry.domain,
        dateRange: entry.date_range,
        lastFetched: entry.last_fetched,
        ageHours: parseFloat(entry.age_hours).toFixed(2),
        isStale: parseFloat(entry.age_hours) > 48,
        data: entry.data
      });
    }

    // ========== ACTION: CLEAR ==========
    if (action === 'clear') {
      logger.debug('[Debug Cache] Lösche Cache...');
      
      let result;
      
      if (userId && dateRange) {
        // Spezifischen Eintrag löschen
        result = await sql`
          DELETE FROM google_data_cache
          WHERE user_id::text = ${userId} AND date_range = ${dateRange}
          RETURNING user_id::text, date_range;
        `;
        
        return NextResponse.json({
          action: 'clear',
          scope: 'specific',
          deleted: result.rowCount || 0,
          userId,
          dateRange
        });
      } else if (userId) {
        // Alle Einträge für einen User löschen
        result = await sql`
          DELETE FROM google_data_cache
          WHERE user_id::text = ${userId}
          RETURNING user_id::text, date_range;
        `;
        
        return NextResponse.json({
          action: 'clear',
          scope: 'user',
          deleted: result.rowCount || 0,
          userId
        });
      } else {
        // Alle Cache-Einträge löschen
        result = await sql`
          DELETE FROM google_data_cache
          RETURNING user_id::text, date_range;
        `;
        
        return NextResponse.json({
          action: 'clear',
          scope: 'all',
          deleted: result.rowCount || 0,
          warning: 'Alle Cache-Einträge wurden gelöscht!'
        });
      }
    }

    // ========== ACTION: STATS ==========
    if (action === 'stats') {
      logger.debug('[Debug Cache] Lade Cache-Statistiken...');
      
      const { rows: stats } = await sql`
        SELECT 
          COUNT(*) as total_entries,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT date_range) as unique_date_ranges,
          AVG(EXTRACT(EPOCH FROM (NOW() - last_fetched)) / 3600) as avg_age_hours,
          MIN(last_fetched) as oldest_entry,
          MAX(last_fetched) as newest_entry
        FROM google_data_cache;
      `;

      const { rows: staleStats } = await sql`
        SELECT 
          COUNT(*) as stale_count
        FROM google_data_cache
        WHERE EXTRACT(EPOCH FROM (NOW() - last_fetched)) / 3600 > 48;
      `;

      return NextResponse.json({
        action: 'stats',
        totalEntries: parseInt(stats[0].total_entries),
        uniqueUsers: parseInt(stats[0].unique_users),
        uniqueDateRanges: parseInt(stats[0].unique_date_ranges),
        avgAgeHours: parseFloat(stats[0].avg_age_hours).toFixed(2),
        oldestEntry: stats[0].oldest_entry,
        newestEntry: stats[0].newest_entry,
        staleEntries: parseInt(staleStats[0].stale_count),
        cacheHitRate: '(wird nicht getrackt)'
      });
    }

    // Ungültige Action
    return NextResponse.json({
      error: 'Ungültige Action',
      availableActions: ['list', 'details', 'clear', 'stats'],
      examples: [
        '/api/debug-google-cache?action=list',
        '/api/debug-google-cache?action=details&userId=UUID&dateRange=30d',
        '/api/debug-google-cache?action=clear&userId=UUID&dateRange=30d',
        '/api/debug-google-cache?action=clear&userId=UUID',
        '/api/debug-google-cache?action=clear',
        '/api/debug-google-cache?action=stats'
      ]
    }, { status: 400 });

  } catch (error) {
    console.error('[Debug Cache] Fehler:', error);
    return NextResponse.json({
      error: 'Interner Serverfehler',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
