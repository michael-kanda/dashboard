// src/app/api/projects/route.ts
// (KORRIGIERT: Nutzt jetzt 'project_assignments' für Admins)

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger'; // KORRIGIERT: Import von auth

export async function GET(_request: NextRequest) {
  try {
    const session = await auth(); // KORRIGIERT: auth() aufgerufen
    const user = session?.user;

    logger.debug('[/api/projects] GET Request');
    logger.debug('[/api/projects] User:', user?.email, 'Role:', user?.role);

    if (!user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // Nur Admins und Superadmins dürfen Projekte sehen
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    let result;

    if (user.role === 'SUPERADMIN') {
      // Superadmins sehen alle Projekte (= alle Benutzer mit Rolle BENUTZER)
      logger.debug('[/api/projects] SUPERADMIN - Lade alle Projekte (Kunden)');
      
      result = await sql`
        SELECT 
          id::text as id, 
          email, 
          role, 
          domain,
          gsc_site_url,
          ga4_property_id,
          mandant_id
        FROM users
        WHERE role = 'BENUTZER'
        ORDER BY mandant_id ASC NULLS LAST, domain ASC NULLS LAST, email ASC
      `;

      logger.debug('[/api/projects] Gefunden:', result.rows.length, 'Projekte');

    } else if (user.role === 'ADMIN') {
      // KORREKTUR: Admins sehen nur ihre zugewiesenen Projekte
      logger.debug('[/api/projects] ADMIN - Lade zugewiesene Projekte aus project_assignments');
      
      result = await sql`
        SELECT 
          u.id::text as id, 
          u.email, 
          u.role, 
          u.domain,
          u.gsc_site_url,
          u.ga4_property_id,
          u.mandant_id
        FROM users u
        INNER JOIN project_assignments pa ON u.id = pa.project_id
        WHERE pa.user_id::text = ${user.id}
        AND u.role = 'BENUTZER'
        ORDER BY u.mandant_id ASC, u.domain ASC NULLS LAST, u.email ASC
      `;

      logger.debug('[/api/projects] Gefunden:', result.rows.length, 'zugewiesene Projekte');
    } else {
      // Andere Rollen haben keinen Zugriff
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    // WICHTIG: Rückgabe im Format { projects: [...] } wie von der Homepage erwartet
    return NextResponse.json({ projects: result.rows }, { status: 200 });

  } catch (error) {
    console.error('[/api/projects] Fehler beim Laden der Projekte:', error);
    return NextResponse.json({ 
      message: 'Fehler beim Laden der Projekte',
      error: 'Unbekannter Fehler'
    }, { status: 500 });
  }
}
