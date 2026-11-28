// Zwei-Faktor-Anmeldung des eigenen Kontos: Status, Einrichtung, Aktivierung, Abschalten.

import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { auth } from '@/lib/auth';
import { loadSessionState } from '@/lib/session-state';
import { isTwoFactorRequired } from '@/lib/two-factor/policy';
import {
  clearTwoFactor,
  enableTwoFactor,
  loadTwoFactorState,
  startTwoFactorSetup,
  verifySecondFactor,
} from '@/lib/two-factor/repository';
import { totpUri } from '@/lib/two-factor/totp';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function currentAccount() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  // Die Rolle aus der Datenbank: die Sitzung ist bis zur Einrichtung herabgestuft.
  const state = await loadSessionState(session.user.id);
  if (!state) return null;
  return { id: session.user.id, email: session.user.email, required: isTwoFactorRequired(state.role) };
}

export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ message: 'Nicht angemeldet' }, { status: 401 });
  const state = await loadTwoFactorState(account.id);
  return NextResponse.json({ ...state, required: account.required, email: account.email });
}

export async function POST(request: NextRequest) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ message: 'Nicht angemeldet' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = typeof body?.action === 'string' ? body.action : '';
  const code = typeof body?.code === 'string' ? body.code : '';

  if (action === 'setup') {
    const result = await startTwoFactorSetup(account.id);
    if ('error' in result) return NextResponse.json({ message: result.error }, { status: 409 });
    const uri = totpUri(result.secret, account.email);
    const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
    return NextResponse.json({ secret: result.secret, uri, qrDataUrl });
  }

  if (action === 'enable') {
    const result = await enableTwoFactor(account.id, code);
    if ('error' in result) return NextResponse.json({ message: result.error }, { status: 400 });
    logger.info('[2FA] Aktiviert für Benutzer', account.id);
    return NextResponse.json({ recoveryCodes: result.recoveryCodes });
  }

  if (action === 'disable') {
    if (account.required) {
      return NextResponse.json({ message: 'Für Admins ist die Zwei-Faktor-Anmeldung Pflicht.' }, { status: 403 });
    }
    if (!(await verifySecondFactor(account.id, code))) {
      return NextResponse.json({ message: 'Der Code stimmt nicht.' }, { status: 400 });
    }
    await clearTwoFactor(account.id);
    logger.info('[2FA] Abgeschaltet für Benutzer', account.id);
    return NextResponse.json({ message: 'Zwei-Faktor-Anmeldung abgeschaltet.' });
  }

  return NextResponse.json({ message: 'Unbekannte Aktion' }, { status: 400 });
}
