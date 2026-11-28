// src/app/api/ai/demo-chat/route.ts
// DataMax in der öffentlichen Demo (/demo-anwalt): ohne Anmeldung, nur mit den fiktiven
// Demo-Daten, höchstens 5 Fragen pro Besucher und Tag (src/lib/demo-chat-quota.ts).
// Das Gesprächsgedächtnis gilt nur innerhalb der Sitzung: Der Browser schickt den Verlauf mit,
// gespeichert wird nichts.
import { NextRequest, NextResponse } from 'next/server';
import { demoData } from '@/app/demo-anwalt/demo-dashboard-data';
import { streamTextSafe } from '@/lib/ai-config';
import { buildChatContext } from '@/lib/ai-chat/context';
import { parseComparisonMode } from '@/lib/comparison';
import { generateSuggestedQuestions } from '@/lib/ai-chat/fallback';
import { buildSystemPrompt } from '@/lib/ai-chat/prompt';
import { buildChatMessages } from '@/lib/ai-chat/history';
import {
  consumeDemoChatQuota,
  demoQuotaHeaders,
  demoQuotaMessage,
  hashDemoVisitor,
  readDemoChatQuota,
  type DemoChatQuota,
} from '@/lib/demo-chat-quota';
import { readClientIp } from '@/lib/login-throttle';
import type { User } from '@/lib/schemas';

export const maxDuration = 60;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LENGTH = 500;
const DEMO_DOMAIN = 'kanzlei-demo.at';

// buildChatContext liest vom Projekt nur die Domain.
const demoUser = { id: 'demo', email: 'demo@datapeak.at', role: 'BENUTZER', domain: DEMO_DOMAIN } as unknown as User;

const DEMO_NOTE = `

WICHTIG – ÖFFENTLICHE DEMO:
Dies ist die öffentliche Demo von DataPeak mit erfundenen Beispieldaten der fiktiven Kanzlei ${DEMO_DOMAIN}.
Es gibt keine echten Kundendaten. Sag das, wenn jemand nach echten Daten, anderen Websites oder Projekten fragt.
Beantworte nur Fragen zu diesen Demo-Daten, zu DataPeak und zu SEO/Analytics allgemein. Halte die Antworten kurz.
Google GenAI Sichtbarkeit (AI Overviews, AI Mode) hat noch keine Schnittstelle und ist ein Platzhalter; lange, fragenartige Suchen zeigt das Fragen-Radar.`;

function limitResponse(quota: DemoChatQuota) {
  if (quota.reason === 'error') {
    return NextResponse.json({ error: demoQuotaMessage(quota) }, { status: 503 });
  }
  return NextResponse.json(
    { error: demoQuotaMessage(quota), limitReached: true, limit: quota.limit },
    { status: 429, headers: demoQuotaHeaders({ ...quota, remaining: 0 }) },
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) return NextResponse.json({ error: 'Nachricht fehlt' }, { status: 400 });
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Bitte fassen Sie die Frage kürzer (höchstens ${MAX_MESSAGE_LENGTH} Zeichen).` }, { status: 400 });
    }

    const ipHash = hashDemoVisitor(readClientIp(req));
    const quota = await consumeDemoChatQuota(ipHash);
    if (!quota.allowed) return limitResponse(quota);

    const comparisonMode = parseComparisonMode(typeof body?.vergleich === 'string' ? body.vergleich : null);
    const context = buildChatContext(demoData, demoUser, '30d', null, 'AT', comparisonMode);
    const system = buildSystemPrompt(context, false, '30d', '30d') + DEMO_NOTE;
    const result = await streamTextSafe({
      system,
      // In der Demo reicht ein kürzeres Gedächtnis; das hält die KI-Kosten klein.
      messages: buildChatMessages(body?.history, message, { maxChars: 6_000 }),
      temperature: 0.7,
    });

    const questions = generateSuggestedQuestions(demoData, null, false);
    const response = result.toTextStreamResponse();
    response.headers.set('X-Suggested-Questions', Buffer.from(JSON.stringify(questions), 'utf-8').toString('base64'));
    for (const [key, value] of Object.entries(demoQuotaHeaders(quota))) response.headers.set(key, value);
    return response;
  } catch (error) {
    console.error('[DataMax Demo] Fehler:', error);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}

/** Vorschläge und verbleibende Fragen, ohne zu zählen. */
export async function GET(req: NextRequest) {
  const quota = await readDemoChatQuota(hashDemoVisitor(readClientIp(req)));
  return NextResponse.json({
    questions: generateSuggestedQuestions(demoData, null, false),
    usage: { limit: quota.limit, remaining: quota.reason === 'visitor' ? 0 : quota.remaining },
  });
}
