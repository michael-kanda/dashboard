// src/app/api/projects/[id]/share-link/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';
import { canAccessProject } from '@/lib/project-access';
import { createShareLink, revokeShareLinks } from '@/lib/share-links';

export const dynamic = 'force-dynamic';

const MAX_LINKS_PER_HOUR = 20;

function isMissingTable(error: unknown) {
  return (error as { code?: string } | null)?.code === '42P01';
}

const MISSING_TABLE_MESSAGE = 'Tabelle project_share_links fehlt. Bitte zuerst Migration 009 ausführen.';

async function authorize(context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id: projectId } = await context.params;
  if (!session?.user) return { error: NextResponse.json({ message: 'Bitte anmelden' }, { status: 401 }) };
  if (!(await canAccessProject(session.user, projectId))) {
    return { error: NextResponse.json({ message: 'Keine Berechtigung für dieses Projekt.' }, { status: 403 }) };
  }
  return { session, projectId };
}

/**
 * POST: Erstellt einen 24 Stunden gültigen Gastlink (nur lesen) für alle, die das Projekt sehen dürfen
 */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const result = await authorize(context);
  if ('error' in result) return result.error;
  const { session, projectId } = result;

  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS count FROM project_share_links
      WHERE project_id = ${projectId}::uuid AND created_at > NOW() - INTERVAL '1 hour'
    `;
    if ((rows[0]?.count ?? 0) >= MAX_LINKS_PER_HOUR) {
      return NextResponse.json({ message: 'Zu viele Links in kurzer Zeit. Bitte später erneut versuchen.' }, { status: 429 });
    }

    const { token, expiresAt } = await createShareLink(projectId, session.user.id ?? null);
    return NextResponse.json({ path: `/teilen/${token}`, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    if (isMissingTable(error)) return NextResponse.json({ message: MISSING_TABLE_MESSAGE }, { status: 500 });
    console.error('[Gastlink] Erstellen fehlgeschlagen:', error);
    return NextResponse.json({ message: 'Link konnte nicht erstellt werden' }, { status: 500 });
  }
}

/**
 * DELETE: Widerruft alle noch gültigen Gastlinks des Projekts
 */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const result = await authorize(context);
  if ('error' in result) return result.error;

  try {
    const revoked = await revokeShareLinks(result.projectId);
    return NextResponse.json({ revoked });
  } catch (error) {
    if (isMissingTable(error)) return NextResponse.json({ message: MISSING_TABLE_MESSAGE }, { status: 500 });
    console.error('[Gastlink] Widerrufen fehlgeschlagen:', error);
    return NextResponse.json({ message: 'Links konnten nicht widerrufen werden' }, { status: 500 });
  }
}
