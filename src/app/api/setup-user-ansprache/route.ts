import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await auth();
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
    }

    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS ansprache VARCHAR(255);
    `;

    return NextResponse.json({
      message: '✅ Tabelle "users" erfolgreich um "ansprache" erweitert.',
    });
  } catch (error) {
    console.error('Migrations-Fehler:', error);
    return NextResponse.json(
      {
        message: 'Fehler beim Migrieren der Datenbank',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      },
      { status: 500 }
    );
  }
}
