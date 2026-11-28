// src/app/api/projects/[id]/monthly-report/route.ts
// Monatsbericht eines Projekts: Status lesen (GET), ein-/ausschalten (PATCH),
// Testbericht an die eigene Adresse senden (POST). Nur Admins mit Zugriff auf das Projekt.
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';
import { canAccessProject } from '@/lib/project-access';
import { sendTestReport } from '@/lib/monthly-report/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function authorize(context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== 'ADMIN' && role !== 'SUPERADMIN')) {
    return { error: NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 }) };
  }
  const { id: projectId } = await context.params;
  if (!(await canAccessProject(session.user, projectId))) {
    return { error: NextResponse.json({ message: 'Keine Berechtigung für dieses Projekt.' }, { status: 403 }) };
  }
  return { session, projectId };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const result = await authorize(context);
  if ('error' in result) return result.error;
  try {
    const { rows } = await sql`SELECT monthly_report_enabled FROM users WHERE id = ${result.projectId}::uuid`;
    if (rows.length === 0) return NextResponse.json({ message: 'Projekt nicht gefunden.' }, { status: 404 });
    const { rows: runs } = await sql`
      SELECT period, status, recipient_count, created_at FROM monthly_report_runs
      WHERE project_id = ${result.projectId}::uuid ORDER BY period DESC LIMIT 3
    `;
    return NextResponse.json({ enabled: rows[0].monthly_report_enabled === true, runs });
  } catch (error) {
    console.error('[Monatsbericht] Status lesen fehlgeschlagen:', error);
    return NextResponse.json({ message: 'Status nicht lesbar. Ist Migration 018 ausgeführt?' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const result = await authorize(context);
  if ('error' in result) return result.error;
  const body = await request.json().catch(() => null);
  if (typeof body?.enabled !== 'boolean') return NextResponse.json({ message: 'enabled fehlt' }, { status: 400 });
  try {
    const { rows } = await sql`
      UPDATE users SET monthly_report_enabled = ${body.enabled}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${result.projectId}::uuid AND role = 'BENUTZER'
      RETURNING monthly_report_enabled
    `;
    if (rows.length === 0) return NextResponse.json({ message: 'Projekt nicht gefunden.' }, { status: 404 });
    return NextResponse.json({ enabled: rows[0].monthly_report_enabled === true });
  } catch (error) {
    console.error('[Monatsbericht] Speichern fehlgeschlagen:', error);
    return NextResponse.json({ message: 'Speichern fehlgeschlagen' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const result = await authorize(context);
  if ('error' in result) return result.error;
  const email = result.session.user.email;
  if (!email) return NextResponse.json({ message: 'Ihr Konto hat keine E-Mail-Adresse.' }, { status: 400 });
  try {
    const sent = await sendTestReport(result.projectId, email);
    return sent.ok
      ? NextResponse.json({ message: 'Testbericht an Ihre Adresse gesendet.' })
      : NextResponse.json({ message: sent.message }, { status: 422 });
  } catch (error) {
    console.error('[Monatsbericht] Testversand fehlgeschlagen:', error);
    return NextResponse.json({ message: 'Testversand fehlgeschlagen' }, { status: 500 });
  }
}
