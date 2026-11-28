// src/app/monatsbericht/abmelden/page.tsx
// Abmeldeseite des Monatsberichts. Bestätigung per Button (POST), damit Link-Scanner in
// Mailprogrammen niemanden versehentlich abmelden.
import type { Metadata } from 'next';
import { sql } from '@vercel/postgres';
import AuthShell, { authButtonClasses } from '@/app/(auth)/login/AuthShell';
import { verifyOptOut } from '@/lib/monthly-report/token';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Monatsbericht abbestellen', robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function projectDomain(projectId: string): Promise<string | null> {
  try {
    const { rows } = await sql`SELECT domain FROM users WHERE id = ${projectId}::uuid`;
    return rows[0]?.domain ?? null;
  } catch {
    return null;
  }
}

export default async function MonthlyReportOptOutPage(props: {
  searchParams: Promise<{ p?: string; r?: string; s?: string; fertig?: string }>;
}) {
  const { p = '', r = '', s = '', fertig } = await props.searchParams;

  if (fertig === '1') {
    return (
      <AuthShell title="Abgemeldet" subtitle="Sie erhalten für dieses Projekt keine Monatsberichte mehr.">
        <p className="text-center text-14 text-muted">Möchten Sie die Berichte wieder erhalten, schreiben Sie Ihrer Betreuung bei DataPeak.</p>
      </AuthShell>
    );
  }

  const valid = UUID.test(p) && verifyOptOut(p, r, s);
  if (!valid) {
    return (
      <AuthShell title="Link ungültig" subtitle="Dieser Abmeldelink ist nicht vollständig oder wurde verändert.">
        <p className="text-center text-14 text-muted">Bitte nutzen Sie den Link aus einer aktuellen Monatsbericht-E-Mail.</p>
      </AuthShell>
    );
  }

  const domain = await projectDomain(p);
  const action = `/api/monatsbericht/abmelden?${new URLSearchParams({ p, r, s }).toString()}`;
  return (
    <AuthShell title="Monatsbericht abbestellen" subtitle={domain ? `Für ${domain}` : 'Für dieses Projekt'}>
      <form method="post" action={action} className="space-y-3">
        <input type="hidden" name="from" value="seite" />
        <p className="text-center text-14 text-muted">Sie erhalten dann keine monatliche E-Mail mit den Kennzahlen mehr. Ihr Zugang zu DataPeak bleibt unverändert.</p>
        <button type="submit" className={authButtonClasses}>Keine Monatsberichte mehr erhalten</button>
      </form>
    </AuthShell>
  );
}
