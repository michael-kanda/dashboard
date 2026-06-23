import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';
import { normalizeManualGoogleGenAiData } from '@/lib/google-genai-manual';

export const dynamic = 'force-dynamic';

async function canEditProject(projectId: string) {
  const session = await auth();
  const role = session?.user?.role;
  const userId = session?.user?.id;
  const mandantId = session?.user?.mandant_id;

  if (!session?.user || (role !== 'ADMIN' && role !== 'SUPERADMIN')) {
    return { ok: false as const, status: 403, message: 'Zugriff verweigert' };
  }

  if (role === 'SUPERADMIN') {
    return { ok: true as const };
  }

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
    return { ok: false as const, status: 403, message: 'Keine Berechtigung für dieses Projekt.' };
  }

  return { ok: true as const };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;
    const permission = await canEditProject(projectId);
    if (!permission.ok) {
      return NextResponse.json({ message: permission.message }, { status: permission.status });
    }

    const body = await request.json().catch(() => null);
    const payload = body?.data || body;
    const normalized = normalizeManualGoogleGenAiData(payload);

    if (!normalized) {
      return NextResponse.json({
        message: 'Keine gültigen GenAI-Impressions gefunden. Erwartet JSON mit totalImpressions/topPages/trend oder csv mit Spalten Seite/Page/URL und Impressionen.',
      }, { status: 400 });
    }

    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_genai_manual_data JSONB NULL`;
    await sql`
      UPDATE users
      SET google_genai_manual_data = ${JSON.stringify({
        ...payload,
        importedAt: normalized.manualSource?.importedAt || new Date().toISOString(),
      })}::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id::text = ${projectId}
    `;
    await sql`DELETE FROM google_data_cache WHERE user_id = ${projectId}::uuid`;

    return NextResponse.json({
      message: 'Google-GenAI-Export gespeichert und Dashboard-Cache gelöscht.',
      googleGenAi: normalized,
    });
  } catch (error) {
    console.error('[/api/projects/[id]/google-genai-manual] Fehler:', error);
    return NextResponse.json({ message: 'Serverfehler' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;
    const permission = await canEditProject(projectId);
    if (!permission.ok) {
      return NextResponse.json({ message: permission.message }, { status: permission.status });
    }

    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_genai_manual_data JSONB NULL`;
    await sql`
      UPDATE users
      SET google_genai_manual_data = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id::text = ${projectId}
    `;
    await sql`DELETE FROM google_data_cache WHERE user_id = ${projectId}::uuid`;

    return NextResponse.json({ message: 'Manueller Google-GenAI-Export gelöscht.' });
  } catch (error) {
    console.error('[/api/projects/[id]/google-genai-manual] DELETE Fehler:', error);
    return NextResponse.json({ message: 'Serverfehler' }, { status: 500 });
  }
}
