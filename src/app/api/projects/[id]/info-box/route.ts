import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';
import { canAccessProject } from '@/lib/project-access';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const role = session?.user?.role;

    if (!session?.user || (role !== 'ADMIN' && role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const { id: projectId } = await context.params;
    const body = await request.json().catch(() => null);
    const text = typeof body?.text === 'string' ? body.text.trim() : '';

    if (text.length > 5000) {
      return NextResponse.json({ message: 'Infobox-Text ist zu lang.' }, { status: 400 });
    }

    if (!(await canAccessProject(session.user, projectId))) {
      return NextResponse.json({ message: 'Keine Berechtigung für dieses Projekt.' }, { status: 403 });
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
