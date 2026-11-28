// src/app/api/projects/[id]/assign/route.ts
// Betreuung eines Projekts: Admins (und durch Superadmins auch Superadmins)
// einem Projekt zuweisen oder die Zuweisung entfernen.

import { NextRequest, NextResponse } from 'next/server';
import { type Session } from 'next-auth';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { logger } from '@/lib/logger';

type AssignmentCheck =
  | { ok: true; staffEmail: string; projectEmail: string }
  | { ok: false; status: number; message: string };

/** Darf die angemeldete Person Zuweisungen ändern? */
function hasAssignmentPermission(session: Session | null) {
  if (!session?.user) return false;
  if (session.user.role === 'SUPERADMIN') return true;
  return session.user.role === 'ADMIN' && Boolean(session.user.permissions?.includes('kann_admins_verwalten'));
}

/**
 * Gemeinsame Prüfung für Zuweisen und Entfernen:
 * - Projekt muss ein Projekt (Rolle BENUTZER) sein.
 * - Betreuer muss ein Admin sein; Superadmins dürfen auch Superadmins zuweisen.
 * - Label-Admins (kann_admins_verwalten) nur innerhalb ihres eigenen Labels.
 */
async function checkAssignment(session: Session, staffId: string, projectId: string): Promise<AssignmentCheck> {
  const { rows: staffRows } = await sql`
    SELECT email, role, mandant_id FROM users WHERE id::text = ${staffId}
  `;
  const staff = staffRows[0];
  const isSuperAdmin = session.user.role === 'SUPERADMIN';
  const allowedRoles = isSuperAdmin ? ['ADMIN', 'SUPERADMIN'] : ['ADMIN'];
  if (!staff || !allowedRoles.includes(staff.role)) {
    return { ok: false, status: 404, message: 'Betreuer ist kein Admin' };
  }

  const { rows: projectRows } = await sql`
    SELECT email, role, mandant_id FROM users WHERE id::text = ${projectId}
  `;
  const project = projectRows[0];
  if (!project || project.role !== 'BENUTZER') {
    return { ok: false, status: 404, message: 'Projekt nicht gefunden' };
  }

  if (!isSuperAdmin) {
    const label = session.user.mandant_id;
    if (!label || staff.mandant_id !== label || project.mandant_id !== label) {
      return { ok: false, status: 403, message: 'Admins dürfen nur Zuweisungen innerhalb ihres eigenen Labels ändern.' };
    }
  }
  return { ok: true, staffEmail: staff.email, projectEmail: project.email };
}

async function readRequest(request: NextRequest, params: Promise<{ id: string }>) {
  const { id: projectId } = await params;
  const session = await auth();
  if (!session || !hasAssignmentPermission(session)) {
    return { error: NextResponse.json({ message: 'Nicht autorisiert. Nur Superadmins oder Admins mit "kann_admins_verwalten" dürfen dies.' }, { status: 403 }) };
  }
  const body = await request.json().catch(() => ({}));
  const staffId = typeof body?.userId === 'string' ? body.userId : '';
  if (!staffId || !projectId) {
    return { error: NextResponse.json({ message: 'Betreuer oder Projekt fehlt' }, { status: 400 }) };
  }
  const check = await checkAssignment(session, staffId, projectId);
  if (!check.ok) return { error: NextResponse.json({ message: check.message }, { status: check.status }) };
  return { projectId, staffId, check };
}

// Weist einem Projekt einen Betreuer zu
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const result = await readRequest(request, props.params);
    if ('error' in result) return result.error;
    const { projectId, staffId, check } = result;

    await sql`
      INSERT INTO project_assignments (user_id, project_id)
      VALUES (${staffId}::uuid, ${projectId}::uuid)
      ON CONFLICT (user_id, project_id) DO NOTHING
    `;
    logger.info(`[Betreuung] ${check.staffEmail} betreut jetzt ${check.projectEmail}`);
    return NextResponse.json({ message: 'Betreuung zugewiesen.' });
  } catch (error) {
    console.error('[POST /api/projects/[id]/assign] Fehler:', error);
    return NextResponse.json({ message: 'Fehler bei der Zuweisung' }, { status: 500 });
  }
}

// Entfernt einen Betreuer von einem Projekt
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const result = await readRequest(request, props.params);
    if ('error' in result) return result.error;
    const { projectId, staffId, check } = result;

    const deleted = await sql`
      DELETE FROM project_assignments
      WHERE user_id::text = ${staffId} AND project_id::text = ${projectId}
    `;
    if (deleted.rowCount === 0) {
      return NextResponse.json({ message: 'Keine Zuweisung gefunden' }, { status: 404 });
    }
    logger.info(`[Betreuung] ${check.staffEmail} betreut ${check.projectEmail} nicht mehr`);
    return NextResponse.json({ message: 'Betreuung entfernt.' });
  } catch (error) {
    console.error('[DELETE /api/projects/[id]/assign] Fehler:', error);
    return NextResponse.json({ message: 'Fehler beim Entfernen der Zuweisung' }, { status: 500 });
  }
}
