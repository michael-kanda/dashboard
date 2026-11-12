// src/app/api/admin/login-logs/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth statt getServerSession
import { unstable_noStore as noStore } from 'next/cache';

// Typdefinition für die Rückgabe
type LoginLogEntry = {
  id: number;
  user_email: string | null;
  user_role: string | null;
  timestamp: string;
};

export async function GET(_request: Request) {
  // Verhindert Caching, damit die Logs immer aktuell sind
  noStore();
  
  try {
    const session = await auth(); // KORRIGIERT: auth() aufgerufen

    // Nur Superadmins dürfen dieses Logbuch sehen
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
    }

    // Die letzten 100 Login-Ereignisse abrufen
    const { rows } = await sql<LoginLogEntry>`
      SELECT id, user_email, user_role, timestamp
      FROM login_logs
      ORDER BY timestamp DESC
      LIMIT 100;
    `;

    return NextResponse.json(rows);

  } catch (error) {
    console.error('Fehler beim Abrufen der Login-Logs:', error);
    return NextResponse.json(
      {
        message: 'Fehler beim Laden der Login-Logs',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      },
      { status: 500 }
    );
  }
}
