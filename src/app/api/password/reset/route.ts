// Einlösen des Links aus „Passwort vergessen?“. Öffentlich (siehe scripts/audit-code.mjs):
// Wer den 256-Bit-Token aus der E-Mail hat, darf einmal ein neues Passwort setzen.
// Danach enden alle Sitzungen (neuer Passwort-Fingerabdruck), angemeldet wird nicht automatisch:
// Mit aktiver Zwei-Faktor-Anmeldung bleibt beim nächsten Login der Code Pflicht.

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPasswordError } from '@/lib/password-policy';
import { hashResetToken, isResetTokenUsable, looksLikeResetToken } from '@/lib/password-reset/token';
import { consumeResetToken, findResetToken, recordAccountEvent, revokeResetTokens } from '@/lib/password-reset/repository';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const INVALID_LINK = 'Dieser Link ist abgelaufen oder wurde schon benutzt. Bitte fordern Sie einen neuen an.';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token: unknown = body?.token;
  if (!looksLikeResetToken(token)) {
    return NextResponse.json({ message: INVALID_LINK }, { status: 400 });
  }
  const tokenHash = hashResetToken(token);

  try {
    // Erst prüfen, dann bcrypt: Unbekannte Tokens kosten so keine Rechenzeit.
    if (!isResetTokenUsable(await findResetToken(tokenHash))) {
      return NextResponse.json({ message: INVALID_LINK }, { status: 400 });
    }

    // Ohne Passwort nur die Prüfung, damit die Seite einen alten Link gleich erkennt.
    if (body?.password === undefined) return NextResponse.json({ ok: true });

    const password = typeof body.password === 'string' ? body.password : '';
    if (password !== body.confirmPassword) {
      return NextResponse.json({ message: 'Die Wiederholung stimmt nicht mit dem neuen Passwort überein.' }, { status: 400 });
    }
    const policyError = getPasswordError(password);
    if (policyError) return NextResponse.json({ message: policyError }, { status: 400 });

    const user = await consumeResetToken(tokenHash, await bcrypt.hash(password, 10));
    if (!user) return NextResponse.json({ message: INVALID_LINK }, { status: 400 });

    await revokeResetTokens(user.id);
    await recordAccountEvent(user, 'password_reset');
    logger.info('[Passwort] Über Link zurückgesetzt für Benutzer', user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Passwort] Zurücksetzen fehlgeschlagen:', error instanceof Error ? error.message : error);
    return NextResponse.json({ message: 'Das Passwort konnte gerade nicht gesetzt werden. Bitte später erneut versuchen.' }, { status: 500 });
  }
}
