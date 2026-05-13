// src/app/api/projects/[id]/assign/route.ts

import { NextRequest, NextResponse } from 'next/server';
// KORREKTUR: 'Session' importieren und auth
import { type Session } from 'next-auth'; 
import { auth } from '@/lib/auth'; // KORRIGIERT
import { sql } from '@vercel/postgres';

// Berechtigungsprüfung: Darf der eingeloggte Admin Zuweisungen ändern?
// KORREKTUR: 'any' ersetzt durch 'Session | null'
async function hasAssignmentPermission(session: Session | null) {
  if (!session?.user) return false;
  if (session.user.role === 'SUPERADMIN') return true;
  if (session.user.role === 'ADMIN' && session.user.permissions?.includes('kann_admins_verwalten')) {
    return true;
  }
  return false;
}

// Weist einen Benutzer (Admin) einem Projekt zu
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const session = await auth(); // KORRIGIERT: auth() aufgerufen
    
    console.log('[POST /api/projects/[id]/assign] Start');
    
    // KORREKTUR: Prüft auf 'kann_admins_verwalten' oder SUPERADMIN
    if (!(await hasAssignmentPermission(session))) {
      console.warn('[POST] ❌ Nicht autorisiert - Rolle:', session?.user?.role);
      return NextResponse.json({ message: 'Nicht autorisiert. Nur Superadmins oder Admins mit "kann_admins_verwalten" dürfen dies.' }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body; // Der Admin, der zugewiesen wird
    
    console.log('[POST] User ID (Admin):', userId);
    console.log('[POST] Project ID (Kunde):', projectId);


    if (!userId || !projectId) {
      return NextResponse.json({ message: 'Benutzer-ID oder Projekt-ID fehlt' }, { status: 400 });
    }

    // Validiere, dass beide IDs existieren
    const { rows: adminCheck } = await sql`
      SELECT id, email, role, mandant_id FROM users WHERE id::text = ${userId};
    `;
    if (adminCheck.length === 0 || adminCheck[0].role !== 'ADMIN') {
      return NextResponse.json({ message: 'Ziel-Benutzer ist kein Admin' }, { status: 404 });
    }

    const { rows: projectCheck } = await sql`
      SELECT id, email, role, mandant_id FROM users WHERE id::text = ${projectId};
    `;
    if (projectCheck.length === 0 || projectCheck[0].role !== 'BENUTZER') {
      return NextResponse.json({ message: 'Ziel-Projekt ist kein Benutzer (Kunde)' }, { status: 404 });
    }

    if (session?.user?.role === 'ADMIN') {
      const adminMandantId = session.user.mandant_id;
      const targetAdminMandantId = adminCheck[0].mandant_id;
      const projectMandantId = projectCheck[0].mandant_id;

      if (!adminMandantId || targetAdminMandantId !== adminMandantId || projectMandantId !== adminMandantId) {
        return NextResponse.json(
          { message: 'Admins dürfen nur Projektzuweisungen innerhalb ihres eigenen Labels ändern.' },
          { status: 403 }
        );
      }
    }

    console.log('[POST] ✅ Validierung erfolgreich');
    console.log('[POST] Admin:', adminCheck[0].email);
    console.log('[POST] Projekt:', projectCheck[0].email);

    // Führe die Zuweisung durch
    await sql`
      INSERT INTO project_assignments (user_id, project_id)
      VALUES (${userId}::uuid, ${projectId}::uuid)
      ON CONFLICT (user_id, project_id) DO NOTHING;
    `;

    console.log('[POST] ✅ Zuweisung erfolgreich erstellt');

    return NextResponse.json({ 
      message: 'Admin erfolgreich zugewiesen.',
      admin: adminCheck[0].email,
      project: projectCheck[0].email
    }, { status: 200 });

  } catch (error) {
    console.error('[POST] ❌ Fehler bei der Zuweisung:', error);
    return NextResponse.json({ 
      message: 'Fehler bei der Zuweisung',
      error: error instanceof Error ? error.message : 'Ein unbekannter Fehler'
    }, { status: 500 });
  }
}

// Entfernt die Zuweisung eines Benutzers (Admin) von einem Projekt
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const session = await auth(); // KORRIGIERT: auth() aufgerufen
    
    console.log('[DELETE /api/projects/[id]/assign] Start');

    // KORREKTUR: Prüft auf 'kann_admins_verwalten' oder SUPERADMIN
    if (!(await hasAssignmentPermission(session))) {
      console.warn('[DELETE] ❌ Nicht autorisiert');
      return NextResponse.json({ message: 'Nicht autorisiert. Nur Superadmins oder Admins mit "kann_admins_verwalten" dürfen dies.' }, { status: 403 });
    }
    
    const body = await request.json();
    const { userId } = body; // Der Admin, dessen Zuweisung entfernt wird
    
    console.log('[DELETE] User ID (Admin):', userId);
    
    if (!userId) {
      return NextResponse.json({ message: 'Benutzer-ID fehlt' }, { status: 400 });
    }

    const result = await sql`
      DELETE FROM project_assignments
      WHERE user_id::text = ${userId} AND project_id::text = ${projectId}
      RETURNING user_id, project_id;
    `;

    if (result.rowCount === 0) {
      return NextResponse.json({ message: 'Keine Zuweisung gefunden' }, { status: 404 });
    }

    console.log('[DELETE] ✅ Zuweisung erfolgreich entfernt');

    return NextResponse.json({ message: 'Zuweisung erfolgreich entfernt.' }, { status: 200 });

  } catch (error) {
    console.error('[DELETE] ❌ Fehler:', error);
    return NextResponse.json({ 
      message: 'Fehler beim Entfernen der Zuweisung',
      error: error instanceof Error ? error.message : 'Ein unbekannter Fehler'
    }, { status: 500 });
  }
}
