// src/app/api/landingpages/[id]/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth
import { canAccessLandingpage } from '@/lib/project-access';
import { sql } from '@vercel/postgres';

type LogEntry = {
    id: number;
    user_email: string | null;
    action: string;
    timestamp: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: landingpageId } = await params;
    const session = await auth(); // KORRIGIERT: auth() aufgerufen

    // Prüfen, ob der Benutzer eingeloggt ist UND Admin oder Superadmin ist
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: "Zugriff verweigert" }, { status: 403 });
    }

    if (!(await canAccessLandingpage(session.user, landingpageId))) {
      return NextResponse.json({ message: "Zugriff verweigert" }, { status: 403 });
    }

    const { rows } = await sql<LogEntry>`
      SELECT id, user_email, action, timestamp
      FROM landingpage_logs
      WHERE landingpage_id = ${landingpageId}
      ORDER BY timestamp DESC
      LIMIT 50; -- Begrenzung, um nicht zu viele Logs auf einmal zu laden
    `;

    return NextResponse.json(rows);

  } catch (error) {
    console.error('Fehler beim Abrufen der Landingpage-Logs:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
