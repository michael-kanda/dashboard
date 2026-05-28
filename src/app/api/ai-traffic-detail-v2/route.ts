// src/app/api/ai-traffic-detail-v2/route.ts
// API Route für erweiterte KI-Traffic Analyse mit Intent & Journey

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { 
  getAiTrafficExtended, 
  getAiTrafficExtendedWithComparison 
} from '@/lib/ai-traffic-extended-v2';

export async function GET(request: NextRequest) {
  try {
    // Auth Check (NextAuth v5 Pattern)
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parameter
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const dateRange = searchParams.get('dateRange') || '30d';

    // User & Projekt laden
    let ga4PropertyId: string | null = null;

    if (projectId) {
      // KORREKTUR: Projekte sind technisch User-Einträge in der 'users'-Tabelle.
      // Wir fragen daher die 'users'-Tabelle ab, nicht 'projects'.
      const { rows: projectRows } = await sql`
        SELECT ga4_property_id FROM users WHERE id = ${projectId}::uuid
      `;
      if (projectRows.length > 0) {
        ga4PropertyId = projectRows[0].ga4_property_id;
      }
    } else {
      // User-basiert (Fallback auf den aktuell eingeloggten User)
      const { rows: userRows } = await sql`
        SELECT ga4_property_id FROM users WHERE email = ${session.user.email}
      `;
      if (userRows.length > 0) {
        ga4PropertyId = userRows[0].ga4_property_id;
      }
    }

    if (!ga4PropertyId) {
      console.warn(`[AI Traffic V2] No GA4 Property ID found. ProjectId: ${projectId}, User: ${session.user.email}`);
      return NextResponse.json({ 
        data: null, 
        error: 'Keine GA4 Property ID gefunden' 
      });
    }

    // Datumsberechnung
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date();
    let days = 30;

    switch (dateRange) {
      case '30d': days = 30; break;
      case '3m': days = 90; break;
      case '6m': days = 180; break;
      case '12m': days = 365; break;
      case '18m': days = 548; break;
      case '24m': days = 730; break;
    }
    
    start.setDate(end.getDate() - days);

    // Vorperiode für Vergleich
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevEnd.getDate() - days);

    const currentStartStr = start.toISOString().split('T')[0];
    const currentEndStr = end.toISOString().split('T')[0];
    const prevStartStr = prevStart.toISOString().split('T')[0];
    const prevEndStr = prevEnd.toISOString().split('T')[0];

    console.log(`[AI Traffic V2] Loading data for ${ga4PropertyId}`);
    // console.log(`[AI Traffic V2] Current: ${currentStartStr} - ${currentEndStr}`);
    // console.log(`[AI Traffic V2] Previous: ${prevStartStr} - ${prevEndStr}`);

    // Daten laden (mit Vergleich)
    const data = await getAiTrafficExtendedWithComparison(
      ga4PropertyId,
      currentStartStr,
      currentEndStr,
      prevStartStr,
      prevEndStr
    );

    return NextResponse.json({ 
      success: true,
      data,
      meta: {
        dateRange,
        currentPeriod: { start: currentStartStr, end: currentEndStr },
        previousPeriod: { start: prevStartStr, end: prevEndStr }
      }
    });

  } catch (error) {
    console.error('[AI Traffic V2 API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
