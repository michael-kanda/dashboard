import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';
import { trySyncDashboardProjectSnapshot } from '@/lib/sync/dashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

const DATE_RANGES = new Set(['7d', '30d', '3m', '6m', '12m', '18m', '24m']);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }
  const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN';
  if (!isAdmin && session.user.id !== id) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const dateRange = typeof body.dateRange === 'string' ? body.dateRange : '';
  if (!DATE_RANGES.has(dateRange)) {
    return NextResponse.json({ message: 'Ungültiger Zeitraum' }, { status: 400 });
  }

  const { rows: cacheRows } = await sql`
    SELECT 1
    FROM google_data_cache
    WHERE user_id = ${id}::uuid
      AND date_range = ${dateRange}
      AND data IS NOT NULL
      AND data <> 'null'::jsonb
    LIMIT 1
  `;
  if (cacheRows.length > 0) {
    return NextResponse.json({
      success: true,
      pending: false,
      fromCache: true,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  try {
    const result = await trySyncDashboardProjectSnapshot(id, dateRange);
    if (!result.acquired) {
      return NextResponse.json({
        success: false,
        pending: true,
        status: 'busy',
      }, {
        status: 202,
        headers: { 'Retry-After': '4', 'Cache-Control': 'no-store' },
      });
    }
    return NextResponse.json({ success: true, pending: false }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, pending: true, message }, { status: 502 });
  }
}
