// src/app/api/project-timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    
    // Bestimme die Projekt-ID (entweder aus Query oder Session für BENUTZER)
    let targetProjectId: string;
    
    if (session.user.role === 'BENUTZER') {
      targetProjectId = session.user.id!;
    } else if (projectId) {
      targetProjectId = projectId;
    } else {
      return NextResponse.json({ message: 'Keine Projekt-ID angegeben' }, { status: 400 });
    }

    // ==========================================
    // ✅ DEMO-MODUS CHECK
    // ==========================================
    const isDemo = session.user.email?.includes('demo');
    
    if (isDemo) {
      console.log('[Project Timeline] Demo-User erkannt. Sende Demo-Daten...');
      
      // Demo: Projektstart vor 60 Tagen, 6 Monate Laufzeit
      const demoStartDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const demoDurationMonths = 6;
      
      const demoData = {
        project: {
          startDate: demoStartDate.toISOString(),
          durationMonths: demoDurationMonths
        },
        progress: {
          counts: {
            'Offen': 3,
            'In Prüfung': 5,
            'Gesperrt': 1,
            'Freigegeben': 21,
            'Total': 30
          },
          percentage: 70
        },
        gscImpressionTrend: generateTrendData(demoStartDate, demoDurationMonths, 800, 1200),
        aiTrafficTrend: generateTrendData(demoStartDate, demoDurationMonths, 50, 180),
        topMovers: [
          {
            url: 'https://demo-shop.de/produkte/sneaker-collection',
            haupt_keyword: 'sneaker online kaufen',
            gsc_impressionen: 5234,
            gsc_impressionen_change: 1823
          },
          {
            url: 'https://demo-shop.de/sale/sommer-special',
            haupt_keyword: 'sportschuhe sale',
            gsc_impressionen: 3421,
            gsc_impressionen_change: 987
          },
          {
            url: 'https://demo-shop.de/laufschuhe-damen',
            haupt_keyword: 'laufschuhe damen',
            gsc_impressionen: 2876,
            gsc_impressionen_change: 654
          }
        ]
      };

      return NextResponse.json(demoData);
    }
    // ==========================================
    // ENDE DEMO-MODUS
    // ==========================================

    // ==========================================
    // ECHTE DATEN LADEN
    // ==========================================

    // 1. Projekt-Daten laden
    const { rows: projectRows } = await sql`
      SELECT 
        project_start_date,
        project_duration_months,
        project_timeline_active,
        gsc_site_url,
        ga4_property_id
      FROM users 
      WHERE id::text = ${targetProjectId}
    `;

    if (projectRows.length === 0) {
      return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    }

    const project = projectRows[0];

    // Wenn Timeline nicht aktiv, leere Antwort
    if (!project.project_timeline_active) {
      return NextResponse.json({ message: 'Timeline nicht aktiviert' }, { status: 404 });
    }

    // Projekt-Zeitraum berechnen
    const projectStartDate = project.project_start_date 
      ? new Date(project.project_start_date) 
      : new Date();
    const durationMonths = project.project_duration_months || 6;

    // 2. Landingpage-Status zählen
    const { rows: statusRows } = await sql`
      SELECT 
        status,
        COUNT(*)::int as count
      FROM landingpages
      WHERE user_id::text = ${targetProjectId}
      GROUP BY status
    `;

    const counts: Record<string, number> = {
      'Offen': 0,
      'In Prüfung': 0,
      'Gesperrt': 0,
      'Freigegeben': 0,
      'Total': 0
    };

    let total = 0;
    for (const row of statusRows) {
      counts[row.status] = row.count;
      total += row.count;
    }
    counts['Total'] = total;

    const percentage = total > 0 ? Math.round((counts['Freigegeben'] / total) * 100) : 0;

    // 3. GSC Impression Trend (ab Projektstart)
    let gscImpressionTrend: { date: string; value: number }[] = [];
    
    if (project.gsc_site_url) {
      // Schema-Self-Healing: Tabelle anlegen, falls Cron noch nicht
      // gelaufen ist. Idempotent, kein Fehler bei Existenz.
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
      } catch (schemaErr) {
        console.warn('[Project Timeline] Schema-Setup übersprungen:', schemaErr);
      }

      try {
        const { rows: gscRows } = await sql`
          SELECT 
            date,
            impressions as value
          FROM gsc_daily_data
          WHERE site_url = ${project.gsc_site_url}
            AND date >= ${projectStartDate.toISOString().split('T')[0]}
          ORDER BY date ASC
        `;
        
        gscImpressionTrend = gscRows.map(row => ({
          date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
          value: Number(row.value) || 0
        }));
      } catch (e) {
        console.warn('[Project Timeline] GSC Trend nicht verfügbar:', e);
        // Fallback: Aus Cache laden wenn vorhanden
        try {
          const { rows: cacheRows } = await sql`
            SELECT data FROM google_data_cache 
            WHERE user_id::text = ${targetProjectId} 
            AND date_range = '3m'
            LIMIT 1
          `;
          
          if (cacheRows.length > 0 && cacheRows[0].data?.charts?.impressions) {
            gscImpressionTrend = cacheRows[0].data.charts.impressions
              .filter((point: any) => new Date(point.date) >= projectStartDate)
              .map((point: any) => ({
                date: new Date(point.date).toISOString().split('T')[0],
                value: point.value || 0
              }));
          }
        } catch (cacheError) {
          console.warn('[Project Timeline] Cache Fallback fehlgeschlagen:', cacheError);
        }
      }
    }

    // 4. AI Traffic Trend (ab Projektstart) - aus Cache
    let aiTrafficTrend: { date: string; value: number }[] = [];
    
    try {
      const { rows: cacheRows } = await sql`
        SELECT data FROM google_data_cache 
        WHERE user_id::text = ${targetProjectId} 
        AND date_range = '3m'
        LIMIT 1
      `;
      
      if (cacheRows.length > 0 && cacheRows[0].data?.aiTraffic?.trend) {
        aiTrafficTrend = cacheRows[0].data.aiTraffic.trend
          .filter((point: any) => new Date(point.date) >= projectStartDate)
          .map((point: any) => ({
            date: new Date(point.date).toISOString().split('T')[0],
            value: point.sessions || point.value || 0
          }));
      }
    } catch (e) {
      console.warn('[Project Timeline] AI Traffic Trend nicht verfügbar:', e);
    }

    // 5. Top Movers (Landingpages mit größtem Impressionen-Zuwachs)
    let topMovers: any[] = [];
    
    try {
      const { rows: moverRows } = await sql`
        SELECT 
          url,
          haupt_keyword,
          gsc_impressionen,
          gsc_impressionen_change
        FROM landingpages
        WHERE user_id::text = ${targetProjectId}
          AND gsc_impressionen_change > 0
          AND status = 'Freigegeben'
        ORDER BY gsc_impressionen_change DESC
        LIMIT 3
      `;
      
      topMovers = moverRows;
    } catch (e) {
      console.warn('[Project Timeline] Top Movers nicht verfügbar:', e);
    }

    // Response zusammenbauen
    const responseData = {
      project: {
        startDate: projectStartDate.toISOString(),
        durationMonths: durationMonths
      },
      progress: {
        counts,
        percentage
      },
      gscImpressionTrend,
      aiTrafficTrend,
      topMovers
    };

    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('[Project Timeline] Error:', error);
    return NextResponse.json({ 
      message: error instanceof Error ? error.message : 'Interner Serverfehler' 
    }, { status: 500 });
  }
}

// Helper: Generiert Trend-Daten ab Projektstart bis heute (nur für Demo)
function generateTrendData(startDate: Date, durationMonths: number, minValue: number, maxValue: number) {
  const data = [];
  const now = new Date();
  const start = new Date(startDate);
  
  // Nur bis heute generieren, nicht bis Projektende
  const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const daysToGenerate = Math.max(0, daysSinceStart);
  
  for (let i = 0; i <= daysToGenerate; i++) {
    const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const progress = i / Math.max(1, daysToGenerate);
    const value = Math.floor(minValue + (maxValue - minValue) * progress + (Math.random() - 0.5) * 100);
    
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.max(0, value)
    });
  }
  
  return data;
}
