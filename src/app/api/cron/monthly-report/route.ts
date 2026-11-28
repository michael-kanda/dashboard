// src/app/api/cron/monthly-report/route.ts
// Monatsbericht per E-Mail: läuft am 1. jedes Monats stündlich von 06:15 bis 12:15 UTC
// (vercel.json). Wer schon versendet ist, wird übersprungen; der letzte Lauf versendet auch mit
// älterem Snapshot bzw. vermerkt „keine Daten“.
import { NextRequest, NextResponse } from 'next/server';
import { runMonthlyReports } from '@/lib/monthly-report/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const FINAL_HOUR_UTC = 12;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ message: 'CRON_SECRET nicht konfiguriert' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  if (now.getUTCDate() !== 1) return NextResponse.json({ skipped: 'Nur am 1. des Monats' });

  try {
    const summary = await runMonthlyReports({ now, finalAttempt: now.getUTCHours() >= FINAL_HOUR_UTC });
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[Monatsbericht] Cron fehlgeschlagen:', error);
    return NextResponse.json({ message: 'Fehler beim Monatsbericht' }, { status: 500 });
  }
}
