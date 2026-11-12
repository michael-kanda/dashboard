// src/app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { canAccessProject } from '@/lib/project-access';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { streamTextSafe } from '@/lib/ai-config';
import { UserSchema } from '@/lib/schemas';
import { getAiTrafficDetailWithComparison } from '@/lib/ai-traffic-extended';
import Holidays from 'date-holidays';
import { detectRequestedDateRange, getDateRanges, normalizeDateRange } from '@/lib/ai-chat/date-range';
import { buildChatContext } from '@/lib/ai-chat/context';
import { generateSuggestedQuestions } from '@/lib/ai-chat/fallback';
import { buildSystemPrompt } from '@/lib/ai-chat/prompt';
import { logger } from '@/lib/logger';
export const maxDuration = 60;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  logger.debug('[DataMax Chat] POST Request erhalten');
  
  try {
    // 1. Auth
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await req.json();
    const { message, projectId, dateRange = '30d' } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Nachricht fehlt' }, { status: 400 });
    }

    const selectedDateRange = normalizeDateRange(typeof dateRange === 'string' ? dateRange : '30d');
    const requestedDateRange = detectRequestedDateRange(message);
    const effectiveDateRange = requestedDateRange || selectedDateRange;

    // 2. Ziel-User bestimmen
    const userId = session.user.id;
    const userRole = session.user.role;
    const targetUserId = projectId || userId;

    // Fremde Projekte nur mit Berechtigung (Kunden ausschließlich das eigene)
    if (targetUserId !== userId && !(await canAccessProject(session.user, targetUserId))) {
      return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 });
    }

    // 3. User-Daten laden
    const { rows } = await sql`SELECT * FROM users WHERE id::text = ${targetUserId}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 });
    }

    const parseResult = UserSchema.safeParse(rows[0]);
    if (!parseResult.success) {
      console.error('[DataMax Chat] User Parse Error:', parseResult.error);
      return NextResponse.json({ error: 'Daten fehlerhaft' }, { status: 500 });
    }
    const user = parseResult.data;

    // 4. Dashboard-Daten laden (aus Cache)
    const dashboardData = await getOrFetchGoogleData(user, effectiveDateRange);
    if (!dashboardData) {
      return NextResponse.json({ error: 'Keine Projektdaten verfügbar' }, { status: 400 });
    }

    // =========================================================================
    // ✅ NEU: Extended AI Traffic Daten laden
    // =========================================================================
    let aiTrafficDetail = null;
    
    if (user.ga4_property_id) {
      try {
        const dateRanges = getDateRanges(effectiveDateRange);
        aiTrafficDetail = await getAiTrafficDetailWithComparison(
          user.ga4_property_id,
          dateRanges.current.start,
          dateRanges.current.end,
          dateRanges.previous.start,
          dateRanges.previous.end
        );
        logger.debug('[DataMax Chat] Extended AI Traffic geladen:', aiTrafficDetail?.totalSessions, 'Sessions');
      } catch (e) {
        console.warn('[DataMax Chat] Extended AI Traffic nicht verfügbar:', e);
        // Kein Fehler werfen - wir nutzen dann die Basis-Daten
      }
    }

    // 5. Kontext bauen (mit Extended AI Traffic + Wetter + Feiertage)
    // Land aus Domain-TLD ableiten (z.B. "example.at" → "AT", "example.de" → "DE")
    const domainParts = (user.domain || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').split('.');
    const tld = domainParts[domainParts.length - 1]?.toUpperCase() || 'AT';
    const userCountry = ['AT', 'DE', 'CH'].includes(tld) ? tld : 'AT';
    const context = buildChatContext(dashboardData, user, effectiveDateRange, aiTrafficDetail, userCountry);
    
    // Feiertage prüfen für Suggested Questions
    const hasHolidays = (() => {
      try {
        const hd = new Holidays(userCountry);
        const dateRanges = getDateRanges(effectiveDateRange);
        const start = new Date(dateRanges.current.start);
        const end = new Date(dateRanges.current.end);
        const years = new Set<number>();
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          years.add(d.getFullYear());
        }
        return Array.from(years).some(year => 
          hd.getHolidays(year).some((h: any) => {
            const hDate = new Date(h.date);
            return hDate >= start && hDate <= end && h.type === 'public';
          })
        );
      } catch { return false; }
    })();
    
    const suggestedQuestions = generateSuggestedQuestions(dashboardData, aiTrafficDetail, hasHolidays);

    // 6. System-Prompt
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
    
    const systemPrompt = buildSystemPrompt(context, isAdmin, selectedDateRange, effectiveDateRange);

    // 7. Stream-Response
    const result = await streamTextSafe({
      system: systemPrompt,
      prompt: message,
      temperature: 0.7,
    });

    // Base64-Encoding für Header
    const questionsBase64 = Buffer.from(JSON.stringify(suggestedQuestions), 'utf-8').toString('base64');
    
    const response = result.toTextStreamResponse();
    response.headers.set('X-Suggested-Questions', questionsBase64);
    
    return response;

  } catch (error) {
    console.error('[DataMax Chat] Fehler:', error);
    return NextResponse.json(
      { error: 'Interner Fehler' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET: Suggested Questions ohne Chat
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || session.user.id;
    const dateRange = normalizeDateRange(searchParams.get('dateRange') || '30d');
    if (projectId !== session.user.id && !(await canAccessProject(session.user, projectId))) {
      return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 });
    }

    // User laden
    const { rows } = await sql`SELECT * FROM users WHERE id::text = ${projectId}`;
    if (rows.length === 0) {
      return NextResponse.json({ questions: [] });
    }

    const parseResult = UserSchema.safeParse(rows[0]);
    if (!parseResult.success) {
      return NextResponse.json({ questions: [] });
    }

    const user = parseResult.data;

    // Daten laden
    const dashboardData = await getOrFetchGoogleData(user, dateRange);
    if (!dashboardData) {
      return NextResponse.json({ questions: [] });
    }

    // Extended AI Traffic für bessere Fragen
    let aiTrafficDetail = null;
    if (user.ga4_property_id) {
      try {
        const dateRanges = getDateRanges(dateRange);
        aiTrafficDetail = await getAiTrafficDetailWithComparison(
          user.ga4_property_id,
          dateRanges.current.start,
          dateRanges.current.end,
          dateRanges.previous.start,
          dateRanges.previous.end
        );
      } catch {
        // Ignore - nutzen Basis-Daten
      }
    }

    const questions = generateSuggestedQuestions(dashboardData, aiTrafficDetail, (() => {
      try {
        const domainParts = (user.domain || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').split('.');
        const tld = domainParts[domainParts.length - 1]?.toUpperCase() || 'AT';
        const userCountry = ['AT', 'DE', 'CH'].includes(tld) ? tld : 'AT';
        const hd = new Holidays(userCountry);
        const dateRanges = getDateRanges(dateRange);
        const start = new Date(dateRanges.current.start);
        const end = new Date(dateRanges.current.end);
        const years = new Set<number>();
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          years.add(d.getFullYear());
        }
        return Array.from(years).some(year =>
          hd.getHolidays(year).some((h: any) => {
            const hDate = new Date(h.date);
            return hDate >= start && hDate <= end && h.type === 'public';
          })
        );
      } catch { return false; }
    })());
    return NextResponse.json({ questions });

  } catch (error) {
    console.error('[DataMax Questions] Fehler:', error);
    return NextResponse.json({ questions: [] });
  }
}
