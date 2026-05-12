// src/app/api/prompt-tracking/research/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { google, AI_CONFIG } from '@/lib/ai-config';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ResearchRequestSchema = z.object({
  setup: z.object({
    domainLabel: z.string().optional(),
    industry: z.string().optional(),
    region: z.string().optional(),
    projectName: z.string().optional(),
    landingPage: z.string().optional(),
    topic: z.string().optional(),
    includeBrand: z.boolean().optional(),
    isLegal: z.boolean().optional(),
  }),
  queries: z.array(z.object({
    query: z.string(),
    clicks: z.number(),
    impressions: z.number(),
    ctr: z.number(),
    position: z.number(),
    url: z.string().optional(),
  })).max(80),
  landingPages: z.array(z.object({
    path: z.string(),
    conversions: z.number().optional(),
    conversionRate: z.number().optional(),
    sessions: z.number().optional(),
  })).max(20).optional(),
});

const ResearchResponseSchema = z.object({
  opportunities: z.array(z.object({
    topic: z.string(),
    prompt: z.string(),
    intent: z.enum(['Quick Win', 'Buy Intent', 'Optimierung']),
    score: z.number().min(1).max(92),
    source: z.enum(['GSC', 'GA4', 'GSC + GA4']),
    reason: z.string(),
    action: z.string(),
  })).min(1).max(8),
});

const SYSTEM_PROMPT = `Du bist DataMax, ein SEO-, Analytics- und Prompt-Research-Experte.

Du erstellst Decision-Prompts aus echten GSC- und GA4-Daten.

Wichtig:
- Keine generischen Templates wiederholen.
- Jeder Prompt muss zum konkreten Thema passen.
- Bei Rechtsanwalt/Kanzlei-Projekten müssen die Prompts nach echten Mandatsfragen klingen.
- Kosten-Themen sind Kosten-/Honorar-Prompts, keine Kanzlei-Auswahl-Floskeln.
- Hundebiss, Waffenrecht, Verkehrsunfall, Führerscheinentzug usw. sind unterschiedliche Rechtsprobleme und brauchen unterschiedliche Prompts.
- Die Landingpage NICHT in den Prompt schreiben. Nutze sie nur für reason/action/source.
- Wenn includeBrand=false, Projekt/Brand nicht im Prompt nennen.
- Score maximal 92. Top-Rankings mit guter CTR sind nicht automatisch höchste Quick Wins.
- Antworte ausschließlich mit strukturierten JSON-Daten nach Schema.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = ResearchRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validierungsfehler', details: parsed.error.issues }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'KI-Service nicht konfiguriert' }, { status: 503 });
  }

  const { setup, queries, landingPages = [] } = parsed.data;
  const prompt = [
    'SETUP:',
    JSON.stringify(setup, null, 2),
    '',
    'GSC_QUERIES:',
    JSON.stringify(queries.slice(0, 60), null, 2),
    '',
    'GA4_LANDINGPAGES:',
    JSON.stringify(landingPages, null, 2),
    '',
    'Erstelle ein priorisiertes Prompt-Research-Ranking.',
  ].join('\n');

  try {
    const result = await generateObject({
      model: google(AI_CONFIG.fallbackModel),
      schema: ResearchResponseSchema,
      system: SYSTEM_PROMPT,
      prompt,
      temperature: 0.35,
    });

    return NextResponse.json(result.object);
  } catch (error: any) {
    console.error('[Prompt Research] DataMax Fehler:', error);
    return NextResponse.json(
      { error: 'Prompt Research fehlgeschlagen', details: error?.message || 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}
