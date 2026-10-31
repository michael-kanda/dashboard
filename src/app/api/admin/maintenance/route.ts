// src/app/api/admin/maintenance/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { canAccessProject } from '@/lib/project-access';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// GET - Status abrufen
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const checkSelf = searchParams.get('checkSelf') === 'true';
    
    // 1. Header-Check: Prüfen ob der eigene User gesperrt ist
    if (checkSelf) {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ isInMaintenance: false });
      }
      const { rows } = await sql`
        SELECT maintenance_mode FROM users WHERE id = ${session.user.id}::uuid
      `;
      return NextResponse.json({ 
        isInMaintenance: rows[0]?.maintenance_mode === true 
      });
    }
    
    // 2. Admin-Panel: Liste ALLER User abrufen (nicht nur die gesperrten)
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Wir laden alle User außer SUPERADMINS (um Self-Lockout zu verhindern)
    // Wenn der User "nur" ADMIN ist, sieht er nur User seines Mandanten (optional, hier vereinfacht für System-View)
    let query;
    
    if (session.user.role === 'SUPERADMIN') {
        // Superadmin sieht alle (außer andere Superadmins)
        query = sql`
            SELECT id::text as id, email, role, domain, maintenance_mode
            FROM users
            WHERE role != 'SUPERADMIN'
            ORDER BY maintenance_mode DESC, email ASC
        `;
    } else {
        // Admin sieht nur User seines Mandanten
        query = sql`
            SELECT id::text as id, email, role, domain, maintenance_mode
            FROM users
            WHERE role != 'SUPERADMIN' 
            AND mandant_id = ${session.user.mandant_id}
            ORDER BY maintenance_mode DESC, email ASC
        `;
    }

    const { rows } = await query;
    
    // Zähle, wie viele aktuell gesperrt sind
    const lockedCount = rows.filter(r => r.maintenance_mode === true).length;

    return NextResponse.json({ 
      users: rows,          // Alle User für die Liste
      count: lockedCount    // Anzahl der Gesperrten für Badge
    });
    
  } catch (error) {
    console.error('Maintenance GET error:', error);
    return NextResponse.json({ users: [], count: 0 });
  }
}

// POST - Wartungsmodus umschalten (Bleibt gleich, ist aber hier der Vollständigkeit halber wichtig)
export async function POST(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, isActive } = body;

    if (!userId) {
      return NextResponse.json({ message: 'userId ist erforderlich' }, { status: 400 });
    }

    // Sicherheitschecks
    const { rows: targetUser } = await sql`SELECT id, role, mandant_id FROM users WHERE id = ${userId}::uuid`;

    if (targetUser.length === 0) return NextResponse.json({ message: 'User nicht gefunden' }, { status: 404 });
    if (targetUser[0].role === 'SUPERADMIN') return NextResponse.json({ message: 'Superadmins sind geschützt' }, { status: 403 });
    // Admins schalten nur zugewiesene Projekte; andere Admins verwaltet ausschließlich der Superadmin.
    if (!(await canAccessProject(session.user, String(targetUser[0].id)))) {
      return NextResponse.json({ message: 'Keine Berechtigung für diesen Benutzer' }, { status: 403 });
    }

    // Update
    await sql`
      UPDATE users 
      SET maintenance_mode = ${isActive === true}
      WHERE id = ${userId}::uuid
    `;

    return NextResponse.json({ success: true, userId, isActive: isActive === true });

  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
