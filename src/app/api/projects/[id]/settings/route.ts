// src/app/api/projects/[id]/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { canAccessProject } from '@/lib/project-access';
import { sql } from '@vercel/postgres';
import { logger } from '@/lib/logger';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    // 1. Authentifizierungs-Check
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht authentifiziert' }, { status: 401 });
    }

    // 2. Berechtigungs-Check (Nur Admins/Superadmins)
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Keine Berechtigung' }, { status: 403 });
    }
    if (!(await canAccessProject(session.user, params.id))) {
      return NextResponse.json({ message: 'Keine Berechtigung' }, { status: 403 });
    }

    // ==========================================
    // 3. DEMO-SCHUTZ (NEU)
    // ==========================================
    if (session.user.is_demo) {
      logger.debug('[Settings] Blockiere Schreibzugriff für Demo-User:', session.user.email);
      return NextResponse.json(
        { message: 'Im Demo-Modus können Projekteinstellungen nicht geändert werden.' },
        { status: 403 }
      );
    }
    // ==========================================

    const { showLandingPages } = await req.json();

    // 4. Update durchführen
    await sql`
      UPDATE users 
      SET settings_show_landingpages = ${showLandingPages}
      WHERE id = ${params.id}
    `;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ message: 'Error updating settings' }, { status: 500 });
  }
}
