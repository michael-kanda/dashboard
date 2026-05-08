// src/app/api/prompt-tracking/cluster/route.ts
//
// API Route: KI-basierte Cluster-Analyse von Prompt-Tracking-Queries.
// Nimmt eine Liste von langen GSC-Queries entgegen und gibt
// strukturierte thematische Cluster + Insights zurück.
//
// Modell: Gemini 2.5 Flash (günstig, schnell, strukturierter Output)
// Auth:   auth() aus @/lib/auth (NextAuth v5 Standard)

import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { auth } from '@/lib/auth';

import {
  PromptClusterRequestSchema,
  PromptClusterResultSchema,
  type PromptClusterApiResponse,
} from '@/lib/prompt-cluster-schema';

// Verhindert Prerendering – diese Route ist immer dynamisch
export const dynamic = 'force-dynamic';
// Erlaubt längere LLM-Calls (Vercel: max 60s im Hobby-Plan, 300s Pro)
export const maxDuration = 60;

// ──────────────────────────────────────────────────────────────────
// Modell-Konfiguration
// ──────────────────────────────────────────────────────────────────
const MODEL_ID = 'gemini-2.5-flash';

// ──────────────────────────────────────────────────────────────────
// System Prompt
// ──────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Du bist ein erfahrener SEO- und Suchintention-Analyst.

Du analysierst lange, konversationsartige Suchanfragen aus der Google Search Console.
Diese Queries sind ≥10 Wörter lang und gelten als möglicher Proxy für AI-Mode-/LLM-Anfragen.

Deine Aufgabe:
1. Gruppiere die Queries in 3–8 sinnvolle thematische Cluster.
2. Bestimme den dominanten Intent jedes Clusters (informational, transactional, comparative, navigational, commercial).
3. Identifiziere wiederkehrende Attribute, Einwände, Entscheidungsfaktoren.
4. Erkenne Content-Lücken (fehlende FAQ-Seiten, Vergleichsseiten, Use-Case-Artikel etc.).
5. Antworte ausschließlich auf Deutsch.

Wichtig:
- Jede Query ist 0-basiert nummeriert. Verwende exakt diese Indizes in queryIndices.
- Eine Query gehört in genau einen Cluster.
- Cluster-Themen sollen prägnant und konkret sein (max 5 Wörter).
- "Sonstiges" oder "Verschiedenes" als Cluster vermeiden – lieber kleinere thematische Gruppen.`;

// ──────────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  // ── 1. Auth-Check via NextAuth v5 ──────────────────────────────
  let session;
  try {
    session = await auth();
  } catch (e) {
    console.error('[Prompt Cluster] Auth-Fehler:', e);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!session?.user) {
    console.warn('[Prompt Cluster] Keine Session – Auth fehlgeschlagen');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[Prompt Cluster] Auth OK für ${session.user.email}`);

  // ── 2. ENV-Check ────────────────────────────────────────────────
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('[Prompt Cluster] GOOGLE_GENERATIVE_AI_API_KEY fehlt');
    return NextResponse.json(
      { error: 'KI-Service nicht konfiguriert (API-Key fehlt)' },
      { status: 503 }
    );
  }

  // ── 3. Body parsen + validieren ─────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PromptClusterRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validierungsfehler',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      },
      { status: 400 }
    );
  }

  const { domain, dateRange, queries } = parsed.data;

  // ── 4. Prompt zusammenbauen ─────────────────────────────────────
  const queryListText = queries
    .map((q, i) => `${i}: "${q.query}" (clicks=${q.clicks}, impressions=${q.impressions})`)
    .join('\n');

  const userPrompt = [
    `Domain: ${domain ?? '(nicht angegeben)'}`,
    `Zeitraum: ${dateRange ?? '(nicht angegeben)'}`,
    `Anzahl Queries: ${queries.length}`,
    '',
    'Queries:',
    queryListText,
  ].join('\n');

  // ── 5. LLM-Aufruf ───────────────────────────────────────────────
  try {
    const result = await generateObject({
      model: google(MODEL_ID),
      schema: PromptClusterResultSchema,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.3,
    });

    // ── 6. Sanity-Check der queryIndices ─────────────────────────
    const validatedClusters = result.object.clusters
      .map((cluster) => ({
        ...cluster,
        queryIndices: cluster.queryIndices.filter(
          (i) => Number.isInteger(i) && i >= 0 && i < queries.length
        ),
      }))
      .filter((cluster) => cluster.queryIndices.length > 0);

    if (validatedClusters.length === 0) {
      return NextResponse.json(
        { error: 'Modell konnte keine sinnvollen Cluster bilden' },
        { status: 502 }
      );
    }

    const response: PromptClusterApiResponse = {
      clusters: validatedClusters,
      insights: result.object.insights,
      meta: {
        model: MODEL_ID,
        queriesAnalyzed: queries.length,
        generatedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt,
      },
    };

    console.log(
      `[Prompt Cluster] ✅ ${validatedClusters.length} Cluster aus ${queries.length} Queries ` +
      `in ${response.meta.elapsedMs}ms`
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Prompt Cluster] LLM-Fehler:', error);

    return NextResponse.json(
      {
        error: 'Cluster-Analyse fehlgeschlagen',
        details: error?.message || 'Unbekannter Fehler',
      },
      { status: 500 }
    );
  }
}
