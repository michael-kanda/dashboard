// src/app/api/monatsbericht/abmelden/route.ts
// Abmelden vom Monatsbericht: aus dem Formular der Abmeldeseite oder per Ein-Klick-Abmeldung
// im Mailprogramm (List-Unsubscribe-Post). Nur mit gültiger Signatur aus der E-Mail.
import { NextRequest, NextResponse } from 'next/server';
import { recordOptOut } from '@/lib/monthly-report/service';
import { verifyOptOut } from '@/lib/monthly-report/token';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const projectId = params.get('p') ?? '';
  const recipientHash = params.get('r') ?? '';
  const signature = params.get('s') ?? '';
  if (!UUID.test(projectId) || !verifyOptOut(projectId, recipientHash, signature)) {
    return NextResponse.json({ message: 'Der Abmeldelink ist ungültig.' }, { status: 400 });
  }
  try {
    await recordOptOut(projectId, recipientHash);
  } catch (error) {
    console.error('[Monatsbericht] Abmeldung fehlgeschlagen:', error);
    return NextResponse.json({ message: 'Abmeldung fehlgeschlagen. Bitte später erneut versuchen.' }, { status: 500 });
  }
  // Formular der Abmeldeseite: zurück mit Bestätigung; Mailprogramme werten nur den Status aus.
  if (request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')
    && (await request.formData().catch(() => null))?.get('from') === 'seite') {
    const done = new URL('/monatsbericht/abmelden', request.nextUrl);
    done.searchParams.set('fertig', '1');
    return NextResponse.redirect(done, 303);
  }
  return NextResponse.json({ message: 'Abgemeldet.' });
}
