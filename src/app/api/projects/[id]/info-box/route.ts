import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    const userId = session?.user?.id;
    const mandantId = session?.user?.mandant_id;

    if (!session?.user || (role !== 'ADMIN' && role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const { id: projectId } = await context.params;
    const body = await request.json().catch(() => null);
    const text = typeof body?.text === 'string' ? body.text.trim() : '';

    if (text.length > 5000) {
      return NextResponse.json({ message: 'Infobox-Text ist zu lang.' }, { status: 400 });
    }

    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_info_text TEXT NULL`;

    if (role === 'ADMIN') {
      const { rows } = await sql`
        SELECT 1
        FROM users u
        WHERE u.id::text = ${projectId}
          AND (
            u."createdByAdminId"::text = ${userId}
            OR (u.mandant_id IS NOT NULL AND u.mandant_id = ${mandantId || null})
            OR EXISTS (
              SELECT 1
              FROM project_assignments pa
              WHERE pa.user_id::text = ${userId} AND pa.project_id::text = ${projectId}
            )
          )
        LIMIT 1
      `;

      if (rows.length === 0) {
        return NextResponse.json({ message: 'Keine Berechtigung für dieses Projekt.' }, { status: 403 });
      }
    }

    const { rows } = await sql`
      UPDATE users
      SET dashboard_info_text = ${text || null}, updated_at = CURRENT_TIMESTAMP
      WHERE id::text = ${projectId}
      RETURNING dashboard_info_text
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Projekt nicht gefunden.' }, { status: 404 });
    }

    return NextResponse.json({ text: rows[0].dashboard_info_text || null });
  } catch (error) {
    console.error('[/api/projects/[id]/info-box] Fehler:', error);
    return NextResponse.json({ message: 'Serverfehler' }, { status: 500 });
  }
}
