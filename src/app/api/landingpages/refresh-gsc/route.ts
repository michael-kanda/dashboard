// src/app/api/landingpages/refresh-gsc/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { REPORTING_LAG_DAYS } from '@/lib/sync/cache-policy';
import { auth } from '@/lib/auth';
import { canAccessProject } from '@/lib/project-access';
import { sql, type QueryResult } from '@vercel/postgres';
import { getGscDataForPagesWithComparison } from '@/lib/google-api';
import type { User } from '@/types';

// === Hilfsfunktionen ===

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ✅ NEU: Sichere Rundung für DB-Integer-Spalten
function safeRound(value: number | null | undefined): number {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return Math.round(value);
}

/**
 * Berechnet Start- und Enddatum basierend auf der Auswahl im Date Picker.
 * Berücksichtigt den 2-Tage-Versatz der GSC-Daten.
 */
function calculateDateRanges(dateRange: string): {
  currentRange: { startDate: string, endDate: string },
  previousRange: { startDate: string, endDate: string }
} {
  const today = new Date();
  const endDateCurrent = new Date(today);
  endDateCurrent.setDate(endDateCurrent.getDate() - REPORTING_LAG_DAYS); // bis Vortag
  
  const startDateCurrent = new Date(endDateCurrent);
  let daysBack: number;
  
  switch (dateRange) {
    case '3m': daysBack = 90; break;
    case '6m': daysBack = 180; break;
    case '12m': daysBack = 365; break;
    case '30d': default: daysBack = 29; break;
  }
  
  startDateCurrent.setDate(startDateCurrent.getDate() - daysBack);
  
  const endDatePrevious = new Date(startDateCurrent);
  endDatePrevious.setDate(endDatePrevious.getDate() - 1); 
  
  const startDatePrevious = new Date(endDatePrevious);
  startDatePrevious.setDate(startDatePrevious.getDate() - daysBack);
  
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

// === API POST Handler ===

export async function POST(request: NextRequest) {
  const client = await sql.connect();
  
  try {
    // 1. Authentifizierung
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // 2. Daten aus dem Frontend (Date Picker & Project ID)
    const body = await request.json();
    const { projectId, dateRange } = body as { projectId: string, dateRange: string };

    if (!projectId || !dateRange) {
      return NextResponse.json({ message: 'projectId und dateRange sind erforderlich' }, { status: 400 });
    }

    console.log(`[GSC Refresh] Starte Abgleich für Projekt ${projectId} über Zeitraum: ${dateRange}`);

    // 3. Berechtigungsprüfung
    if (!(await canAccessProject(user, projectId))) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    // 4. Projektdaten laden (GSC URL)
    const { rows: projectRows } = await sql<Pick<User, 'gsc_site_url'>>`
      SELECT gsc_site_url FROM users WHERE id::text = ${projectId};
    `;

    if (projectRows.length === 0 || !projectRows[0].gsc_site_url) {
      return NextResponse.json({ message: 'Keine GSC Site URL konfiguriert.' }, { status: 400 });
    }
    const siteUrl = projectRows[0].gsc_site_url;

    // 5. Landingpages laden
    const { rows: landingpageRows } = await sql<{ id: number; url: string }>`
      SELECT id, url FROM landingpages WHERE user_id::text = ${projectId};
    `;

    if (landingpageRows.length === 0) {
      return NextResponse.json({ message: 'Keine Landingpages gefunden.' });
    }

    const pageUrls = landingpageRows.map(lp => lp.url);
    const pageIdMap = new Map<string, number>(landingpageRows.map(lp => [lp.url, lp.id]));

    // 6. Zeiträume berechnen
    const { currentRange, previousRange } = calculateDateRanges(dateRange);
    console.log(`[GSC Refresh] Zeiträume: Aktuell(${currentRange.startDate} bis ${currentRange.endDate})`);

    // 7. GSC-Daten abrufen
    const gscDataMap = await getGscDataForPagesWithComparison(
      siteUrl,
      pageUrls,
      currentRange,
      previousRange
    );

    // 8. Datenbank Update (Transaktion)
    await client.query('BEGIN');
    
    let updatedCount = 0;
    const updatePromises: Promise<QueryResult>[] = [];

    for (const [url, data] of gscDataMap.entries()) {
      const landingpageId = pageIdMap.get(url);
      
      if (landingpageId) {
        updatePromises.push(
          client.query(
            `UPDATE landingpages
             SET 
               gsc_klicks = $1,
               gsc_klicks_change = $2,
               gsc_impressionen = $3,
               gsc_impressionen_change = $4,
               gsc_position = $5,
               gsc_position_change = $6,
               gsc_last_updated = NOW(),
               gsc_last_range = $7
             WHERE id = $8;`,
            [
              // ✅ FIX: Alle Werte runden für INTEGER-Spalten
              safeRound(data.clicks),
              safeRound(data.clicks_change),
              safeRound(data.impressions),
              safeRound(data.impressions_change),
              safeRound(data.position),
              safeRound(data.position_change),
              dateRange,
              landingpageId
            ]
          )
        );
        updatedCount++;
      }
    }

    await Promise.all(updatePromises);
    await client.query('COMMIT');

    console.log(`[GSC Refresh] ✅ ${updatedCount} Seiten aktualisiert.`);

    return NextResponse.json({
      message: `✅ ${updatedCount} Landingpages erfolgreich aktualisiert (${dateRange}).`,
      updatedCount
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[GSC Refresh] Fehler:', error);
    return NextResponse.json(
      { message: 'Fehler beim Synchronisieren', error: 'Unbekannt' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
