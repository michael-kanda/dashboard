// src/app/api/prompt-tracking/cluster/route.ts
//
// API Route: KI-basierte Cluster-Analyse von Prompt-Tracking-Queries.
// Speichert Ergebnisse zusätzlich in prompt_cluster_history für
// Vergleiche über Zeit ("Vor 3 Monaten dominierte Cluster X").

import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import crypto from 'crypto';
import { AI_CONFIG, google } from '@/lib/ai-config';

import {
  PromptClusterRequestSchema,
  PromptClusterResultSchema,
  type PromptClusterApiResponse,
} from '@/lib/prompt-cluster-schema';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL_ID = AI_CONFIG.primaryModel;

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

/**
 * Hash für die Eingabe-Queries (Cache-Key + Idempotenz)
 */
function hashQueries(queries: { query: string }[]): string {
  const sorted = [...queries].map((q) => q.query.toLowerCase().trim()).sort();
  return crypto.createHash('sha256').update(sorted.join('|')).digest('hex').slice(0, 16);
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  // ── 1. Auth-Check ───────────────────────────────────────────────
  let session;
  try {
    session = await auth();
  } catch (e) {
    console.error('[Prompt Cluster] Auth-Fehler:', e);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!session?.user || !(session.user as any).id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  console.log(`[Prompt Cluster] Auth OK für ${session.user.email}`);

  // ── 2. ENV-Check ────────────────────────────────────────────────
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('[Prompt Cluster] Gemini API-Key fehlt');
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
  const queriesHash = hashQueries(queries);

  // ── 4. Cache-Check: gleicher Hash innerhalb von 7 Tagen? ────────
  try {
    const { rows } = await sql`
      SELECT result, created_at
      FROM prompt_cluster_history
      WHERE user_id = ${userId}::uuid
        AND queries_hash = ${queriesHash}
        AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (rows.length > 0) {
      console.log(`[Prompt Cluster] ✅ Cache HIT (Hash ${queriesHash})`);
      return NextResponse.json(rows[0].result);
    }
  } catch (e) {
    console.warn('[Prompt Cluster] Cache-Lookup fehlgeschlagen (ignoriert):', e);
  }

  // ── 5. Prompt zusammenbauen ─────────────────────────────────────
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

  // ── 6. LLM-Aufruf ───────────────────────────────────────────────
  try {
    const result = await generateObject({
      model: google(MODEL_ID),
      schema: PromptClusterResultSchema,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.3,
    });

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

    // ── 7. In History speichern (für spätere Vergleiche) ─────────
    try {
      await sql`
        INSERT INTO prompt_cluster_history (
          user_id, date_range, queries_hash, result, query_count
        )
        VALUES (
          ${userId}::uuid,
          ${dateRange || 'unknown'},
          ${queriesHash},
          ${JSON.stringify(response)}::jsonb,
          ${queries.length}
        )
      `;
    } catch (e) {
      console.warn('[Prompt Cluster] History-Save fehlgeschlagen (ignoriert):', e);
    }

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
