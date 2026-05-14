// src/app/api/prompt-tracking/cluster-history/route.ts
//
// Lädt historische Cluster-Analysen für einen User.
// Erlaubt Vergleich der Themenverschiebung über Zeit.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────
  let session;
  try {
    session = await auth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!session?.user || !(session.user as any).id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;

  // ── Optional: Date-Range-Filter ──────────────────────────────────
  const url = new URL(req.url);
  const dateRange = url.searchParams.get('dateRange');

  // Limit defensiv parsen: invalid input ('foo', leer, negativ) → default 10.
  // Vorher: parseInt('foo', 10) = NaN → Math.min(NaN, 50) = NaN → LIMIT NaN
  // wäre als SQL-Param ein 500-Error gewesen.
  const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '10', 10);
  const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 10, 50);

  try {
    let rows;
    if (dateRange) {
      const result = await sql`
        SELECT id, date_range, query_count, result, created_at
        FROM prompt_cluster_history
        WHERE user_id = ${userId}::uuid
          AND date_range = ${dateRange}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      rows = result.rows;
    } else {
      const result = await sql`
        SELECT id, date_range, query_count, result, created_at
        FROM prompt_cluster_history
        WHERE user_id = ${userId}::uuid
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      rows = result.rows;
    }

    return NextResponse.json({
      history: rows.map((r) => ({
        id: r.id,
        dateRange: r.date_range,
        queryCount: r.query_count,
        result: r.result,
        createdAt: r.created_at,
      })),
    });
  } catch (e: any) {
    console.error('[Cluster History] Fehler:', e);
    return NextResponse.json(
      { error: 'Konnte Historie nicht laden', details: e.message },
      { status: 500 }
    );
  }
}
