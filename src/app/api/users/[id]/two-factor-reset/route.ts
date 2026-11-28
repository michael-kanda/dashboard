// Superadmin setzt die Zwei-Faktor-Anmeldung eines Kontos zurück (z. B. Handy verloren).
// Admins müssen sie beim nächsten Login neu einrichten.

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';
import { clearTwoFactor } from '@/lib/two-factor/repository';
import { logger } from '@/lib/logger';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // Die Rolle ist bei fehlender eigener 2FA herabgestuft: dann ist kein Reset möglich.
  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nur Superadmins dürfen die Zwei-Faktor-Anmeldung zurücksetzen.' }, { status: 403 });
  }
  const { id } = await params;
  const { rows } = await sql`SELECT email FROM users WHERE id::text = ${id}`;
  if (!rows[0]) return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });

  await clearTwoFactor(id);
  logger.info(`[2FA] Zurückgesetzt für Benutzer ${id} durch ${session.user.id}`);
  return NextResponse.json({ message: 'Zwei-Faktor-Anmeldung zurückgesetzt.' });
}
