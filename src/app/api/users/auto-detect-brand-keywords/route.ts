// src/app/api/user/auto-detect-brand-keywords/route.ts
//
// GET: Vorschau ohne zu speichern.
// POST: Detection + speichern + Cache invalidieren.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { detectBrandKeywords } from '@/lib/prompt-tracking/brand-detector';
import { getTopQueries } from '@/lib/google-api';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function loadUserAndTopQueries(targetUserId: string) {
  const { rows } = await sql`
    SELECT id, email, domain, gsc_site_url, brand_keywords
    FROM users WHERE id = ${targetUserId}::uuid LIMIT 1
  `;
  if (rows.length === 0) return null;
  const user = rows[0];

  let topQueries: { query: string; clicks: number }[] = [];
  if (user.gsc_site_url) {
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(end.getDate() - 90);

    try {
      const top = await getTopQueries(
        user.gsc_site_url,
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0]
      );
      topQueries = (top as any[])
        .map(q => ({
          query: q.query || q.keys?.[0] || '',
          clicks: q.clicks ?? 0,
        }))
        .filter(q => q.query.length > 0);
    } catch (e) {
      console.warn('[auto-detect] GSC top-queries fail:', e);
    }
  }
  return { user, topQueries };
}

async function resolveTargetUserId(req: NextRequest, fromBody?: any): Promise<{ ok: false; res: NextResponse } | { ok: true; userId: string }> {
  let session;
  try { session = await auth(); } catch { session = null; }
  if (!session?.user || !(session.user as any).id) {
    return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const userId = (session.user as any).id as string;
  const role = (session.user as any).role;
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';

  const url = new URL(req.url);
  const target = (fromBody?.targetUserId) || url.searchParams.get('targetUserId') || userId;

  if (target !== userId && !isAdmin) {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, userId: target };
}

export async function GET(req: NextRequest) {
  const ctx = await resolveTargetUserId(req);
  if (!ctx.ok) return ctx.res;

  const data = await loadUserAndTopQueries(ctx.userId);
  if (!data) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (!data.user.domain && !data.user.gsc_site_url) {
    return NextResponse.json(
      { error: 'User hat weder Domain noch GSC-Site-URL — Auto-Detection nicht möglich' },
      { status: 400 }
    );
  }

  const result = await detectBrandKeywords({
    domain: data.user.domain,
    topQueries: data.topQueries,
  });

  return NextResponse.json({
    keywords: result.keywords,
    sources: result.sources,
    pageTitle: result.pageTitleRaw,
    pageTitleFetched: result.pageTitleFetched,
    topQueriesAnalyzed: result.topQueriesAnalyzed,
  });
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch {}

  const ctx = await resolveTargetUserId(req, body);
  if (!ctx.ok) return ctx.res;

  const data = await loadUserAndTopQueries(ctx.userId);
  if (!data) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (!data.user.domain && !data.user.gsc_site_url) {
    return NextResponse.json(
      { error: 'User hat weder Domain noch GSC-Site-URL — Auto-Detection nicht möglich' },
      { status: 400 }
    );
  }

  let result;
  try {
    result = await detectBrandKeywords({
      domain: data.user.domain,
      topQueries: data.topQueries,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Detection fehlgeschlagen', details: e.message },
      { status: 500 }
    );
  }

  try {
    await sql`
      UPDATE users
      SET brand_keywords = ${result.keywords as any}
      WHERE id = ${ctx.userId}::uuid
    `;
    await sql`DELETE FROM google_data_cache WHERE user_id = ${ctx.userId}::uuid`;
  } catch (e: any) {
    return NextResponse.json(
      { error: 'DB-Save fehlgeschlagen', details: e.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    keywords: result.keywords,
    sources: result.sources,
    pageTitle: result.pageTitleRaw,
    pageTitleFetched: result.pageTitleFetched,
    topQueriesAnalyzed: result.topQueriesAnalyzed,
  });
}
