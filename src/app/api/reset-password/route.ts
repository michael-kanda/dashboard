// src/app/api/reset-password/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { getPasswordError } from '@/lib/password-policy';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger'; // KORRIGIERT: Import von auth

export async function POST(request: Request) {
  try {
    const session = await auth(); // KORRIGIERT: auth() aufgerufen
    
    // Nur Superadmins dürfen Passwörter zurücksetzen
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { email, newPassword } = await request.json();

    if (!email || !newPassword) {
      return NextResponse.json({ 
        message: 'E-Mail und neues Passwort erforderlich' 
      }, { status: 400 });
    }

    const passwordError = getPasswordError(newPassword);
    if (passwordError) {
      return NextResponse.json({ message: passwordError }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    logger.debug('[RESET-PASSWORD] Passwort-Reset für:', normalizedEmail);

    // Prüfe, ob Benutzer existiert
    const { rows: existingUsers } = await sql`
      SELECT id, email, role FROM users WHERE email = ${normalizedEmail}
    `;

    if (existingUsers.length === 0) {
      logger.debug('[RESET-PASSWORD] ❌ Benutzer nicht gefunden');
      return NextResponse.json({ 
        message: 'Benutzer nicht gefunden' 
      }, { status: 404 });
    }

    const user = existingUsers[0];
    logger.debug('[RESET-PASSWORD] Benutzer gefunden:', user.email, 'Rolle:', user.role);

    // Neues Passwort hashen
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    logger.debug('[RESET-PASSWORD] Neues Hash erstellt, Länge:', hashedPassword.length);

    // Passwort in DB aktualisieren
    const { rows: updatedUsers } = await sql`
      UPDATE users
      SET password = ${hashedPassword}
      WHERE email = ${normalizedEmail}
      RETURNING id, email, role;
    `;

    if (updatedUsers.length === 0) {
      logger.debug('[RESET-PASSWORD] ❌ Update fehlgeschlagen');
      return NextResponse.json({ 
        message: 'Passwort-Update fehlgeschlagen' 
      }, { status: 500 });
    }

    logger.info('[RESET-PASSWORD] ✅ Passwort erfolgreich zurückgesetzt');

    return NextResponse.json({ 
      message: `✅ Passwort für ${user.email} erfolgreich zurückgesetzt`,
      benutzer: {
        id: user.id,
        email: user.email,
        rolle: user.role
      },
      neuesPasswort: newPassword,
      hinweis: 'Bitte sofort einloggen und das Passwort ändern'
    }, { status: 200 });

  } catch (error) {
    console.error('[RESET-PASSWORD] Fehler:', error);
    return NextResponse.json(
      { 
        message: 'Fehler beim Zurücksetzen des Passworts',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
}
