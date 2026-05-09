// src/app/api/users/brand-keywords/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function normalizeBrandKeywords(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;

  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const keyword = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (keyword.length < 2 || keyword.length > 80) continue;
    if (seen.has(keyword)) continue;
    seen.add(keyword);
    keywords.push(keyword);
    if (keywords.length >= 30) break;
  }

  return keywords.length > 0 ? keywords : null;
}

async function resolveTargetUserId(
  req: NextRequest,
  body?: any
): Promise<{ ok: false; res: NextResponse } | { ok: true; userId: string }> {
  let session;
  try {
    session = await auth();
  } catch {
    session = null;
  }

  if (!session?.user?.id) {
    return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const userId = session.user.id;
  const role = session.user.role;
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
  const url = new URL(req.url);
  const target = body?.targetUserId || url.searchParams.get('targetUserId') || userId;

  if (target !== userId && !isAdmin) {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, userId: target };
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ctx = await resolveTargetUserId(req, body);
  if (!ctx.ok) return ctx.res;

  const keywords = normalizeBrandKeywords(body.brand_keywords);

  try {
    const { rows } = await sql`
      UPDATE users
      SET brand_keywords = ${keywords as any}
      WHERE id = ${ctx.userId}::uuid
      RETURNING id::text as id, brand_keywords
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await sql`DELETE FROM google_data_cache WHERE user_id = ${ctx.userId}::uuid`;

    return NextResponse.json({
      success: true,
      keywords: rows[0].brand_keywords || null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'DB-Save fehlgeschlagen', details: e.message },
      { status: 500 }
    );
  }
}
