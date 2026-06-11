// src/app/api/ai-traffic-detail-v2/route.ts
// API Route für erweiterte KI-Traffic Analyse mit Intent & Journey

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getAiTrafficExtendedWithComparison } from '@/lib/ai-traffic-extended-v2';

const QUOTA_COOLDOWN_MS = 55 * 60 * 1000;
const quotaCooldownUntil = new Map<string, number>();
const inFlightRequests = new Map<string, Promise<any>>();

function getQuotaMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const cause = (error as any)?.cause?.message;
  return cause || message;
}

function isGa4QuotaError(error: unknown) {
  const status = (error as any)?.status || (error as any)?.code || (error as any)?.response?.status;
  const message = getQuotaMessage(error).toLowerCase();
  return status === 429 || message.includes('quota') || message.includes('resource_exhausted');
}

function quotaLimitedResponse(ga4PropertyId: string, message: string) {
  const retryAfterMs = Math.max(0, (quotaCooldownUntil.get(ga4PropertyId) || Date.now()) - Date.now());

  return NextResponse.json({
    success: false,
    data: null,
    quotaLimited: true,
    retryAfterMs,
    error: message,
  });
}

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

    const cooldownUntil = quotaCooldownUntil.get(ga4PropertyId) || 0;
    if (cooldownUntil > Date.now()) {
      return quotaLimitedResponse(
        ga4PropertyId,
        'GA4-Quota ist vorübergehend erschöpft. Die KI-Traffic-Detaildaten werden später automatisch wieder geladen.'
      );
    }

    // Datumsberechnung
    // end = gestern (GA4-Daten für heute sind noch unvollständig)
    const end = new Date();
    end.setDate(end.getDate() - 1);

    let days = 30;
    switch (dateRange) {
      case '30d': days = 30; break;
      case '3m': days = 90; break;
      case '6m': days = 180; break;
      case '12m': days = 365; break;
      case '18m': days = 548; break;
      case '24m': days = 730; break;
    }

    // WICHTIG: start IMMER von end ableiten (nicht von "heute").
    // Sonst entsteht am Monatsersten ein invertierter Range, weil
    // .getDate() nur den Tag-im-Monat liefert und über Monatsgrenzen kippt.
    const start = new Date(end);
    start.setDate(start.getDate() - days);

    // Vorperiode für Vergleich (lückenlos direkt vor dem aktuellen Zeitraum)
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days);

    const currentStartStr = start.toISOString().split('T')[0];
    const currentEndStr = end.toISOString().split('T')[0];
    const prevStartStr = prevStart.toISOString().split('T')[0];
    const prevEndStr = prevEnd.toISOString().split('T')[0];

    console.log(`[AI Traffic V2] Loading data for ${ga4PropertyId}`);
    // console.log(`[AI Traffic V2] Current: ${currentStartStr} - ${currentEndStr}`);
    // console.log(`[AI Traffic V2] Previous: ${prevStartStr} - ${prevEndStr}`);

    const requestKey = `${ga4PropertyId}:${currentStartStr}:${currentEndStr}:${prevStartStr}:${prevEndStr}`;
    const requestPromise = inFlightRequests.get(requestKey) || getAiTrafficExtendedWithComparison(
      ga4PropertyId,
      currentStartStr,
      currentEndStr,
      prevStartStr,
      prevEndStr
    );
    inFlightRequests.set(requestKey, requestPromise);

    let data;
    try {
      data = await requestPromise;
    } catch (error) {
      if (isGa4QuotaError(error)) {
        const message = getQuotaMessage(error);
        quotaCooldownUntil.set(ga4PropertyId, Date.now() + QUOTA_COOLDOWN_MS);
        console.warn('[AI Traffic V2 API] GA4 quota cooldown aktiviert:', message);
        return quotaLimitedResponse(ga4PropertyId, message);
      }
      throw error;
    } finally {
      inFlightRequests.delete(requestKey);
    }

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
