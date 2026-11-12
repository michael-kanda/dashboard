// src/app/api/debug-gsc-landingpages/route.ts
// Testet ob GSC-Daten für spezifische URLs abgerufen werden können

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth
import { canAccessProject } from '@/lib/project-access';
import { sql } from '@vercel/postgres';
import { getGscDataForPagesWithComparison } from '@/lib/google-api';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await auth(); // KORRIGIERT: auth() aufgerufen
    
    if (session?.user?.role !== 'SUPERADMIN' && session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ message: 'userId parameter erforderlich' }, { status: 400 });
    }
    if (!(await canAccessProject(session?.user, userId))) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
    }

    logger.debug('[Debug GSC Landingpages] User ID:', userId);

    // User-Daten laden
    const { rows: userRows } = await sql`
      SELECT email, domain, gsc_site_url 
      FROM users 
      WHERE id::text = ${userId}
    `;

    if (userRows.length === 0) {
      return NextResponse.json({ message: 'User nicht gefunden' }, { status: 404 });
    }

    const user = userRows[0];
    
    if (!user.gsc_site_url) {
      return NextResponse.json({ 
        message: 'GSC nicht konfiguriert',
        user: { email: user.email, gsc_site_url: null }
      }, { status: 400 });
    }

    logger.debug('[Debug GSC Landingpages] User:', user.email);
    logger.debug('[Debug GSC Landingpages] GSC URL:', user.gsc_site_url);

    // Landingpages laden
    const { rows: landingpages } = await sql`
      SELECT id, url, haupt_keyword
      FROM landingpages
      WHERE user_id::text = ${userId}
      ORDER BY id ASC
      LIMIT 5
    `;

    if (landingpages.length === 0) {
      return NextResponse.json({ 
        message: 'Keine Landingpages gefunden',
        user: { email: user.email, gsc_site_url: user.gsc_site_url }
      });
    }

    logger.debug('[Debug GSC Landingpages] Gefunden:', landingpages.length, 'Landingpages');

    // Zeiträume berechnen (30 Tage)
    const today = new Date();
    const endDateCurrent = new Date(today);
    endDateCurrent.setDate(endDateCurrent.getDate() - 2);
    
    const startDateCurrent = new Date(endDateCurrent);
    startDateCurrent.setDate(startDateCurrent.getDate() - 29);
    
    const endDatePrevious = new Date(startDateCurrent);
    endDatePrevious.setDate(endDatePrevious.getDate() - 1);
    const startDatePrevious = new Date(endDatePrevious);
    startDatePrevious.setDate(startDatePrevious.getDate() - 29);
    
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    
    const currentRange = {
      startDate: formatDate(startDateCurrent),
      endDate: formatDate(endDateCurrent)
    };
    
    const previousRange = {
      startDate: formatDate(startDatePrevious),
      endDate: formatDate(endDatePrevious)
    };

    logger.debug('[Debug GSC Landingpages] Zeitraum:', currentRange);

    // GSC-Daten abrufen
    const pageUrls = landingpages.map(lp => lp.url);
    
    logger.debug('[Debug GSC Landingpages] Rufe GSC-Daten ab für URLs:', pageUrls);

    let gscDataMap;
    let error = null;
    
    try {
      gscDataMap = await getGscDataForPagesWithComparison(
        user.gsc_site_url,
        pageUrls,
        currentRange,
        previousRange
      );
      
      logger.debug('[Debug GSC Landingpages] ✅ GSC-Daten erfolgreich abgerufen');
    } catch (gscError) {
      error = gscError instanceof Error ? gscError.message : String(gscError);
      console.error('[Debug GSC Landingpages] ❌ GSC-Fehler:', error);
      
      return NextResponse.json({
        success: false,
        error: error,
        user: {
          email: user.email,
          domain: user.domain,
          gsc_site_url: user.gsc_site_url
        },
        landingpages: landingpages.map(lp => ({
          id: lp.id,
          url: lp.url,
          keyword: lp.haupt_keyword
        })),
        dateRange: currentRange
      }, { status: 500 });
    }

    // Ergebnisse aufbereiten
    const results = landingpages.map(lp => {
      const gscData = gscDataMap.get(lp.url);
      
      return {
        id: lp.id,
        url: lp.url,
        keyword: lp.haupt_keyword,
        gsc: gscData ? {
          clicks: gscData.clicks,
          clicks_change: gscData.clicks_change,
          impressions: gscData.impressions,
          impressions_change: gscData.impressions_change,
          position: gscData.position,
          position_change: gscData.position_change,
          hasData: gscData.clicks > 0 || gscData.impressions > 0
        } : {
          clicks: 0,
          impressions: 0,
          position: 0,
          hasData: false,
          note: 'Keine Daten von GSC erhalten'
        }
      };
    });

    // Zusammenfassung
    const summary = {
      totalPages: results.length,
      pagesWithData: results.filter(r => r.gsc.hasData).length,
      pagesWithoutData: results.filter(r => !r.gsc.hasData).length,
      totalClicks: results.reduce((sum, r) => sum + (r.gsc.clicks || 0), 0),
      totalImpressions: results.reduce((sum, r) => sum + (r.gsc.impressions || 0), 0)
    };

    logger.debug('[Debug GSC Landingpages] Summary:', summary);

    return NextResponse.json({
      success: true,
      user: {
        email: user.email,
        domain: user.domain,
        gsc_site_url: user.gsc_site_url
      },
      dateRange: currentRange,
      summary: summary,
      results: results,
      recommendations: summary.pagesWithoutData === summary.totalPages ? [
        '❌ KEINE Seite hat GSC-Daten!',
        'Mögliche Ursachen:',
        '1. GSC-URL falsch konfiguriert (z.B. fehlendes www)',
        '2. Domain Property statt URL Property verwenden',
        '3. URLs sind in GSC nicht indexiert',
        '4. Service Account hat keine Berechtigung',
        '',
        'Prüfe in Google Search Console:',
        `- Gehe zu: https://search.google.com/search-console`,
        `- Wähle die Property: ${user.gsc_site_url}`,
        `- Prüfe unter "Leistung" ob diese URLs auftauchen`
      ] : summary.pagesWithData > 0 ? [
        `✅ ${summary.pagesWithData} von ${summary.totalPages} Seiten haben Daten`,
        'Die Seiten ohne Daten haben wahrscheinlich keine Rankings/Traffic.'
      ] : []
    });

  } catch (error) {
    console.error('[Debug GSC Landingpages] Schwerwiegender Fehler:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
