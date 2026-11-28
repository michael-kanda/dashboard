// Eigenes Passwort ändern. Die eigene Sitzung bleibt, alle anderen enden.

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { auth, unstable_update } from '@/lib/auth';
import { getPasswordError } from '@/lib/password-policy';
import { isLoginLocked, readClientIp, recordLoginFailure } from '@/lib/login-throttle';
import { createPasswordChangeProof, fingerprintPasswordHash } from '@/lib/session-state';
import { recordAccountEvent, revokeResetTokens } from '@/lib/password-reset/repository';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ message: 'Nicht angemeldet' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
  const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ message: 'Bitte aktuelles und neues Passwort eingeben.' }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ message: 'Die Wiederholung stimmt nicht mit dem neuen Passwort überein.' }, { status: 400 });
  }
  const policyError = getPasswordError(newPassword);
  if (policyError) return NextResponse.json({ message: policyError }, { status: 400 });

  const { rows } = await sql<{ id: string; email: string; role: string; password: string | null }>`
    SELECT id::text AS id, email, role, password FROM users WHERE id::text = ${userId} LIMIT 1
  `;
  const user = rows[0];
  if (!user?.password) return NextResponse.json({ message: 'Konto nicht gefunden' }, { status: 404 });

  // Falsche aktuelle Passwörter zählen wie Fehlversuche beim Anmelden und führen zur selben Sperre.
  const ip = readClientIp(request);
  if (await isLoginLocked(user.email, ip)) {
    return NextResponse.json({ message: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.' }, { status: 429 });
  }
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    await recordLoginFailure(user.email, ip);
    return NextResponse.json({ message: 'Das aktuelle Passwort ist nicht korrekt.' }, { status: 400 });
  }
  if (await bcrypt.compare(newPassword, user.password)) {
    return NextResponse.json({ message: 'Das neue Passwort muss sich vom bisherigen unterscheiden.' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  // Nur ändern, wenn das Passwort seit dem Vergleich gleich geblieben ist.
  const updated = await sql`
    UPDATE users SET password = ${passwordHash}
    WHERE id::text = ${userId} AND password = ${user.password}
  `;
  if (updated.rowCount !== 1) {
    return NextResponse.json({ message: 'Das Passwort wurde gerade an anderer Stelle geändert. Bitte neu laden.' }, { status: 409 });
  }

  await revokeResetTokens(user.id);
  await recordAccountEvent(user, 'password_changed');
  logger.info('[Passwort] Geändert für', user.email);

  // Diese Sitzung übernimmt den neuen Fingerabdruck. Gelingt das nicht, endet sie wie die anderen.
  let keptSession = false;
  try {
    const proof = await createPasswordChangeProof(user.id, await fingerprintPasswordHash(passwordHash));
    if (proof) {
      await unstable_update({ passwordChangeProof: proof } as unknown as Parameters<typeof unstable_update>[0]);
      keptSession = true;
    }
  } catch (error) {
    logger.warn('[Passwort] Sitzung nicht aufgefrischt', error);
  }

  return NextResponse.json({ ok: true, keptSession });
}
