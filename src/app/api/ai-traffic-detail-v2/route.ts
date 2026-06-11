// src/app/api/ai-traffic-detail-v2/route.ts
// API Route für erweiterte KI-Traffic Analyse mit Intent & Journey
//
// UMBAU (Quota-Härtung):
//  1. Persistenter Cooldown in Postgres statt In-Memory-Map (funktioniert über
//     mehrere Vercel-Lambda-Instanzen hinweg).
//  2. Postgres-Result-Cache (Default 30 Min). Eliminiert den Großteil der
//     GA4-Calls und ist die nachhaltigste Quota-Entlastung.
//  3. Stale-While-Cooldown: Ist die Quota gesperrt, werden vorhandene (auch
//     ältere) Cache-Daten ausgeliefert statt eines Fehlers.
//
//  Voraussetzung: Migration db/migrations/ga4_cache_cooldown.sql ausführen.
//
//  UMBAU (Timeout-Härtung):
//  4. Transiente Fehler (GA4-Timeout/Abort, Netzwerkabbrüche) werden erkannt
//     und wie ein "weicher" Ausfall behandelt: Stale-Cache ausliefern statt
//     500er. Ohne Cache -> 503 mit klarer Meldung (KEIN Cooldown, da kein
//     Quota-Problem vorliegt).

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getAiTrafficExtendedWithComparison } from '@/lib/ai-traffic-extended-v2';

// Vercel: dem mehrstufigen GA4-Report genug Zeit geben. Muss größer sein als
// die Summe der GA4-Client-Timeouts (siehe Hinweis unten bei den Fehler-Helpern).
export const maxDuration = 60;

const QUOTA_COOLDOWN_MS = 55 * 60 * 1000;
// GA4-Daten aktualisieren sich nur periodisch — ein paar Minuten Cache sind
// fachlich unkritisch und sparen massiv GA4-Calls.
const CACHE_TTL_MS = 30 * 60 * 1000;

// In-Memory-Dedup nur als Best-Effort-Optimierung INNERHALB einer warmen
// Instanz. Der eigentliche instanzübergreifende Schutz läuft über DB-Cooldown
// und DB-Cache.
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

/**
 * Transiente Fehler: GA4-Client-Timeout (gaxios bricht per AbortSignal ab,
 * Meldung "The operation was aborted."), Netzwerkabbrüche etc.
 * Diese Fälle sind KEIN Quota-Problem -> kein Cooldown setzen, aber wie bei
 * Quota Stale-Cache bevorzugen, statt einen 500er an den Client zu geben.
 *
 * Hinweis: Das eigentliche 20s-Timeout kommt aus dem GA4-Client in
 * lib/ai-traffic-extended-v2 (gaxios `timeout: 20000`). Dort ggf. auf
 * 40-45s erhöhen und/oder die Teil-Reports sequenziell statt parallel
 * feuern — maxDuration oben ist darauf abgestimmt.
 */
function isTransientGa4Error(error: unknown) {
  const message = getQuotaMessage(error).toLowerCase();
  const type =
    (error as any)?.type ||
    (error as any)?.error?.type ||
    (error as any)?.cause?.type;
  return (
    type === 'aborted' ||
    (error as any)?.name === 'AbortError' ||
    message.includes('aborted') ||
    message.includes('timeout') ||
    message.includes('etimedout') ||
    message.includes('econnreset') ||
    message.includes('socket hang up') ||
    message.includes('fetch failed')
  );
}

// ---------------------------------------------------------------------------
// Persistenter Cooldown (Postgres)
// ---------------------------------------------------------------------------

/** Liefert den Cooldown-Endzeitpunkt (ms epoch) oder 0, wenn keiner aktiv ist. */
async function getCooldownUntil(propertyId: string): Promise<number> {
  try {
    const { rows } = await sql`
      SELECT cooldown_until FROM ga4_quota_cooldown WHERE property_id = ${propertyId}
    `;
    if (rows.length === 0) return 0;
    return new Date(rows[0].cooldown_until).getTime();
  } catch (err) {
    // Cache-/Cooldown-Infrastruktur darf den Hauptpfad nie blockieren.
    console.warn('[AI Traffic V2] Cooldown-Lookup fehlgeschlagen:', err);
    return 0;
  }
}

async function setCooldown(propertyId: string): Promise<number> {
  const until = Date.now() + QUOTA_COOLDOWN_MS;
  try {
    await sql`
      INSERT INTO ga4_quota_cooldown (property_id, cooldown_until)
      VALUES (${propertyId}, ${new Date(until).toISOString()})
      ON CONFLICT (property_id)
      DO UPDATE SET cooldown_until = EXCLUDED.cooldown_until
    `;
  } catch (err) {
    console.warn('[AI Traffic V2] Cooldown-Schreiben fehlgeschlagen:', err);
  }
  return until;
}

// ---------------------------------------------------------------------------
// Result-Cache (Postgres)
// ---------------------------------------------------------------------------

interface CacheHit {
  payload: any;
  ageMs: number;
}

async function readCache(cacheKey: string): Promise<CacheHit | null> {
  try {
    const { rows } = await sql`
      SELECT payload, created_at FROM ga4_ai_traffic_cache WHERE cache_key = ${cacheKey}
    `;
    if (rows.length === 0) return null;
    return {
      payload: rows[0].payload,
      ageMs: Date.now() - new Date(rows[0].created_at).getTime(),
    };
  } catch (err) {
    console.warn('[AI Traffic V2] Cache-Lookup fehlgeschlagen:', err);
    return null;
  }
}

async function writeCache(cacheKey: string, payload: any): Promise<void> {
  try {
    await sql`
      INSERT INTO ga4_ai_traffic_cache (cache_key, payload, created_at)
      VALUES (${cacheKey}, ${JSON.stringify(payload)}::jsonb, now())
      ON CONFLICT (cache_key)
      DO UPDATE SET payload = EXCLUDED.payload, created_at = EXCLUDED.created_at
    `;
  } catch (err) {
    console.warn('[AI Traffic V2] Cache-Schreiben fehlgeschlagen:', err);
  }
}

function quotaLimitedResponse(cooldownUntil: number, message: string) {
  const retryAfterMs = Math.max(0, cooldownUntil - Date.now());
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

    const cacheKey = `${ga4PropertyId}:${currentStartStr}:${currentEndStr}:${prevStartStr}:${prevEndStr}`;

    // 1) Frischer Cache? -> sofort ausliefern, kein GA4-Call.
    const cached = await readCache(cacheKey);
    if (cached && cached.ageMs < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        data: cached.payload,
        cached: true,
        meta: {
          dateRange,
          cacheAgeMs: cached.ageMs,
          currentPeriod: { start: currentStartStr, end: currentEndStr },
          previousPeriod: { start: prevStartStr, end: prevEndStr }
        }
      });
    }

    // 2) Quota im Cooldown? -> wenn möglich (auch ältere) Cache-Daten liefern,
    //    sonst quotaLimited. So sieht der Nutzer Daten statt eines Fehlers.
    const cooldownUntil = await getCooldownUntil(ga4PropertyId);
    if (cooldownUntil > Date.now()) {
      if (cached) {
        return NextResponse.json({
          success: true,
          data: cached.payload,
          cached: true,
          stale: true,
          meta: {
            dateRange,
            cacheAgeMs: cached.ageMs,
            retryAfterMs: Math.max(0, cooldownUntil - Date.now()),
            currentPeriod: { start: currentStartStr, end: currentEndStr },
            previousPeriod: { start: prevStartStr, end: prevEndStr }
          }
        });
      }
      return quotaLimitedResponse(
        cooldownUntil,
        'GA4-Quota ist vorübergehend erschöpft. Die KI-Traffic-Detaildaten werden später automatisch wieder geladen.'
      );
    }

    console.log(`[AI Traffic V2] Loading data for ${ga4PropertyId}`);

    // 3) Frisch laden (mit In-Flight-Dedup innerhalb der Instanz).
    const requestPromise = inFlightRequests.get(cacheKey) || getAiTrafficExtendedWithComparison(
      ga4PropertyId,
      currentStartStr,
      currentEndStr,
      prevStartStr,
      prevEndStr
    );
    inFlightRequests.set(cacheKey, requestPromise);

    let data;
    try {
      data = await requestPromise;
    } catch (error) {
      if (isGa4QuotaError(error)) {
        const message = getQuotaMessage(error);
        const until = await setCooldown(ga4PropertyId);
        console.warn('[AI Traffic V2 API] GA4 quota cooldown aktiviert:', message);
        // Stale-Cache bevorzugen, falls vorhanden.
        if (cached) {
          return NextResponse.json({
            success: true,
            data: cached.payload,
            cached: true,
            stale: true,
            meta: {
              dateRange,
              cacheAgeMs: cached.ageMs,
              retryAfterMs: Math.max(0, until - Date.now()),
              currentPeriod: { start: currentStartStr, end: currentEndStr },
              previousPeriod: { start: prevStartStr, end: prevEndStr }
            }
          });
        }
        return quotaLimitedResponse(until, message);
      }
      // Transienter Fehler (z.B. GA4-Timeout "The operation was aborted."):
      // kein Cooldown, aber Stale-Cache bevorzugen statt 500er.
      if (isTransientGa4Error(error)) {
        console.warn('[AI Traffic V2 API] Transienter GA4-Fehler (Timeout/Abort):', getQuotaMessage(error));
        if (cached) {
          return NextResponse.json({
            success: true,
            data: cached.payload,
            cached: true,
            stale: true,
            meta: {
              dateRange,
              cacheAgeMs: cached.ageMs,
              transientError: true,
              currentPeriod: { start: currentStartStr, end: currentEndStr },
              previousPeriod: { start: prevStartStr, end: prevEndStr }
            }
          });
        }
        return NextResponse.json({
          success: false,
          data: null,
          transient: true,
          error: 'GA4 hat nicht rechtzeitig geantwortet (Timeout). Bitte in ein paar Minuten erneut versuchen.'
        }, { status: 503 });
      }
      throw error;
    } finally {
      inFlightRequests.delete(cacheKey);
    }

    // 4) Erfolgreich -> Cache aktualisieren.
    await writeCache(cacheKey, data);

    return NextResponse.json({
      success: true,
      data,
      cached: false,
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
