// src/app/api/users/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { User } from '@/types';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await auth();

  // --- DEMO-SCHUTZ START ---
  if (session?.user?.is_demo) {
    return NextResponse.json(
      { message: 'Im Demo-Modus können keine neuen Projekte angelegt werden.' }, 
      { status: 403 }
    );
  }
  // --- DEMO-SCHUTZ ENDE ---

  if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const onlyCustomers = searchParams.get('onlyCustomers') === 'true';

  try {
    let result;

    // --- SUPERADMIN Logik ---
    if (session.user.role === 'SUPERADMIN') {
      if (onlyCustomers) {
        // 1. Projekt-Übersicht (Nur Kunden)
        // ✅ UPDATE: SUM(lp.gsc_impressionen_change) hinzugefügt
        result = await sql`
          SELECT 
            u.id::text as id, u.email, u.role, u.domain, u.mandant_id, u.ansprache, u.permissions, u.favicon_url,
            u.project_timeline_active, u.project_start_date, u.project_duration_months,
            creator.email as creator_email,
            (
              SELECT STRING_AGG(DISTINCT admins.email, ', ')
              FROM project_assignments pa_sub
              JOIN users admins ON pa_sub.user_id = admins.id
              WHERE pa_sub.project_id = u.id
            ) as assigned_admins,
            (
              SELECT STRING_AGG(DISTINCT p.domain, ', ')
              FROM project_assignments pa_sub2
              JOIN users p ON pa_sub2.project_id = p.id
              WHERE pa_sub2.user_id = u.id
            ) as assigned_projects,
            COUNT(lp.id) as landingpages_count,
            SUM(CASE WHEN lp.status = 'Offen' THEN 1 ELSE 0 END) as landingpages_offen,
            SUM(CASE WHEN lp.status = 'In Prüfung' THEN 1 ELSE 0 END) as landingpages_in_pruefung,
            SUM(CASE WHEN lp.status = 'Freigegeben' THEN 1 ELSE 0 END) as landingpages_freigegeben,
            SUM(CASE WHEN lp.status = 'Gesperrt' THEN 1 ELSE 0 END) as landingpages_gesperrt,
            SUM(lp.gsc_impressionen_change) as total_impression_change
          FROM users u
          LEFT JOIN users creator ON u."createdByAdminId" = creator.id
          LEFT JOIN landingpages lp ON u.id = lp.user_id
          WHERE u.role = 'BENUTZER'
          GROUP BY u.id, creator.email
          ORDER BY u.mandant_id ASC, u.domain ASC, u.email ASC
        `;
      } else {
        // 2. Admin-Panel (Benutzerverwaltung) - bleibt unverändert
        result = await sql`
          SELECT 
            u.id::text as id, 
            u.email, 
            u.role, 
            u.domain, 
            u.mandant_id, 
            u.ansprache,
            u.permissions, 
            u.favicon_url,
            (
              SELECT STRING_AGG(DISTINCT admins.email, ', ')
              FROM project_assignments pa_sub
              JOIN users admins ON pa_sub.user_id = admins.id
              WHERE pa_sub.project_id = u.id
            ) as assigned_admins,
            (
              SELECT STRING_AGG(DISTINCT p.domain, ', ')
              FROM project_assignments pa_sub2
              JOIN users p ON pa_sub2.project_id = p.id
              WHERE pa_sub2.user_id = u.id
            ) as assigned_projects
          FROM users u
          WHERE u.role != 'SUPERADMIN'
          ORDER BY u.mandant_id ASC, u.role DESC, u.email ASC
        `;
      }
    }

    // --- ADMIN Logik ---
    if (session.user.role === 'ADMIN') {
      const adminId = session.user.id;
      const adminMandantId = session.user.mandant_id; // Label des Admins
      
      if (onlyCustomers) {
        // 3. Projekt-Übersicht für Admin
        // ✅ UPDATE: SUM(lp.gsc_impressionen_change) hinzugefügt
        result = await sql`
          SELECT 
            u.id::text as id, u.email, u.role, u.domain, u.mandant_id, u.ansprache, u.permissions, u.favicon_url,
            u.project_timeline_active, u.project_start_date, u.project_duration_months,
            creator.email as creator_email,
            (
              SELECT STRING_AGG(DISTINCT admins.email, ', ')
              FROM project_assignments pa_sub
              JOIN users admins ON pa_sub.user_id = admins.id
              WHERE pa_sub.project_id = u.id
            ) as assigned_admins,
            (
              SELECT STRING_AGG(DISTINCT p.domain, ', ')
              FROM project_assignments pa_sub2
              JOIN users p ON pa_sub2.project_id = p.id
              WHERE pa_sub2.user_id = u.id
            ) as assigned_projects,
            COUNT(lp.id) as landingpages_count,
            SUM(CASE WHEN lp.status = 'Offen' THEN 1 ELSE 0 END) as landingpages_offen,
            SUM(CASE WHEN lp.status = 'In Prüfung' THEN 1 ELSE 0 END) as landingpages_in_pruefung,
            SUM(CASE WHEN lp.status = 'Freigegeben' THEN 1 ELSE 0 END) as landingpages_freigegeben,
            SUM(CASE WHEN lp.status = 'Gesperrt' THEN 1 ELSE 0 END) as landingpages_gesperrt,
            SUM(lp.gsc_impressionen_change) as total_impression_change
          FROM users u
          LEFT JOIN users creator ON u."createdByAdminId" = creator.id
          LEFT JOIN landingpages lp ON u.id = lp.user_id
          WHERE u.role = 'BENUTZER'
            AND (
              (u.mandant_id = ${adminMandantId} AND u."createdByAdminId"::text = ${adminId})
              OR EXISTS (
                SELECT 1 FROM project_assignments pa 
                WHERE pa.project_id = u.id AND pa.user_id::text = ${adminId}
              )
            )
          GROUP BY u.id, creator.email
          ORDER BY u.domain ASC, u.email ASC
        `;
      } else {
        // 4. Admin-Panel: Benutzerverwaltung - bleibt unverändert
        const kannAdminsVerwalten = session.user.permissions?.includes('kann_admins_verwalten');

        const kundenRes = await sql`
          SELECT DISTINCT 
            u.id::text as id, u.email, u.role, u.domain, u.mandant_id, u.ansprache, u.permissions, u.favicon_url,
            (
              SELECT STRING_AGG(DISTINCT admins.email, ', ')
              FROM project_assignments pa_sub
              JOIN users admins ON pa_sub.user_id = admins.id
              WHERE pa_sub.project_id = u.id
            ) as assigned_admins,
            (
              SELECT STRING_AGG(DISTINCT p.domain, ', ')
              FROM project_assignments pa_sub2
              JOIN users p ON pa_sub2.project_id = p.id
              WHERE pa_sub2.user_id = u.id
            ) as assigned_projects
          FROM users u
          WHERE u.role = 'BENUTZER' 
            AND (
              (u.mandant_id = ${adminMandantId} AND u."createdByAdminId"::text = ${adminId})
              OR EXISTS (
                SELECT 1 FROM project_assignments pa 
                WHERE pa.project_id = u.id AND pa.user_id::text = ${adminId}
              )
            )
        `;
        let rows = kundenRes.rows;

        if (kannAdminsVerwalten && adminMandantId) {
          const adminsRes = await sql`
            SELECT 
              u.id::text as id, u.email, u.role, u.domain, u.mandant_id, u.ansprache, u.permissions, u.favicon_url,
              (
                SELECT STRING_AGG(DISTINCT admins.email, ', ')
                FROM project_assignments pa_sub
                JOIN users admins ON pa_sub.user_id = admins.id
                WHERE pa_sub.project_id = u.id
              ) as assigned_admins,
              (
                SELECT STRING_AGG(DISTINCT p.domain, ', ')
                FROM project_assignments pa_sub2
                JOIN users p ON pa_sub2.project_id = p.id
                WHERE pa_sub2.user_id = u.id
              ) as assigned_projects
            FROM users u
            WHERE u.mandant_id = ${adminMandantId}
              AND u.role = 'ADMIN'
              AND u.id::text != ${adminId}
          `;
          rows = [...rows, ...adminsRes.rows];
        }
        
        result = { rows };
        
        result.rows.sort((a, b) => (a.role > b.role) ? -1 : (a.role === b.role) ? a.email.localeCompare(b.email) : 1);
      }
    }

    if (!result) {
       return NextResponse.json({ message: "Unbekannter Fehler" }, { status: 500 });
    }

    // Zahlen-Konvertierung für Stats
    const rows = result.rows.map(r => ({
      ...r,
      landingpages_count: Number(r.landingpages_count || 0),
      landingpages_offen: Number(r.landingpages_offen || 0),
      landingpages_in_pruefung: Number(r.landingpages_in_pruefung || 0),
      landingpages_freigegeben: Number(r.landingpages_freigegeben || 0),
      landingpages_gesperrt: Number(r.landingpages_gesperrt || 0),
      // ✅ NEU: Konvertierung
      total_impression_change: Number(r.total_impression_change || 0),
    }));

    return NextResponse.json(rows);

  } catch (error) {
    console.error('[/api/users] Fehler beim Abrufen der Benutzer:', error);
    return NextResponse.json({
      message: 'Interner Serverfehler',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}

// POST Methode bleibt unverändert...
// (Ich lasse den Rest der Datei hier weg, da er sich nicht ändert, aber er muss natürlich in der Datei bleiben)
export async function POST(req: NextRequest) {
  const session = await auth(); 

  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: "Zugriff verweigert" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const createdByAdminId = session.user.id;
    const { 
      email, password, role, mandant_id, ansprache, permissions, domain, gsc_site_url, ga4_property_id,
      semrush_project_id, semrush_tracking_id, semrush_tracking_id_02, favicon_url,
      project_start_date, project_duration_months, project_timeline_active,
      settings_show_prompt_tracking
    } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ message: 'E-Mail, Passwort und Rolle sind erforderlich' }, { status: 400 });
    }
    
    const loggedInUserRole = session.user.role;
    const loggedInUserMandantId = session.user.mandant_id;
    const roleToCreate = role;

    if (roleToCreate === 'SUPERADMIN') return NextResponse.json({ message: 'Keine Berechtigung' }, { status: 403 });
    
    let effective_mandant_id = mandant_id;

    if (loggedInUserRole === 'ADMIN') {
      if (roleToCreate !== 'BENUTZER') return NextResponse.json({ message: 'Admins dürfen nur Kunden erstellen.' }, { status: 403 });
      effective_mandant_id = loggedInUserMandantId; 
      if (!effective_mandant_id) return NextResponse.json({ message: 'Kein Label vorhanden.' }, { status: 400 });
      if (permissions && permissions.length > 0) return NextResponse.json({ message: 'Keine Berechtigung für Klassen.' }, { status: 403 });
    }
    
    if (roleToCreate !== 'SUPERADMIN' && !effective_mandant_id) return NextResponse.json({ message: 'Label erforderlich' }, { status: 400 });

    const { rows } = await sql<User>`SELECT * FROM users WHERE email = ${email}`;
    if (rows.length > 0) return NextResponse.json({ message: 'Benutzer existiert bereits' }, { status: 409 });

    const hashedPassword = await bcrypt.hash(password, 10);
    const permissionsArray = Array.isArray(permissions) ? permissions : [];
    const permissionsPgString = `{${permissionsArray.join(',')}}`;

    const duration = project_duration_months ? parseInt(String(project_duration_months), 10) : 6;
    const startDate = project_start_date ? new Date(project_start_date).toISOString() : new Date().toISOString();
    const timelineActive = typeof project_timeline_active === 'boolean' ? project_timeline_active : false;
    const promptTrackingVisible = typeof settings_show_prompt_tracking === 'boolean'
      ? settings_show_prompt_tracking
      : false;

    const { rows: newUsers } = await sql<User>`
      INSERT INTO users (
        email, password, role, mandant_id, permissions,
        ansprache,
        domain, gsc_site_url, ga4_property_id,
        semrush_project_id, semrush_tracking_id, semrush_tracking_id_02,
        favicon_url,
        project_start_date, project_duration_months, project_timeline_active,
        settings_show_prompt_tracking,
        "createdByAdminId"
      )
      VALUES (
        ${email}, ${hashedPassword}, ${roleToCreate}, 
        ${effective_mandant_id || null}, 
        ${permissionsPgString},
        ${typeof ansprache === 'string' && ansprache.trim() ? ansprache.trim() : null},
        ${domain || null}, ${gsc_site_url || null}, ${ga4_property_id || null},
        ${semrush_project_id || null}, ${semrush_tracking_id || null}, ${semrush_tracking_id_02 || null},
        ${favicon_url || null},
        ${startDate}, ${duration}, ${timelineActive},
        ${promptTrackingVisible},
        ${createdByAdminId}
      )
      RETURNING id, email, role, domain, mandant_id, ansprache, permissions, favicon_url`;
      
    const newUser = newUsers[0];

    if (loggedInUserRole === 'ADMIN' && roleToCreate === 'BENUTZER') {
      try {
        await sql`INSERT INTO project_assignments (user_id, project_id) VALUES (${createdByAdminId}::uuid, ${newUser.id}::uuid)`;
      } catch (e) { console.error(e); }
    }

    return NextResponse.json(newUser, { status: 201 });

  } catch (error) {
    return NextResponse.json({ message: 'Serverfehler', error: error instanceof Error ? error.message : 'Unbekannter Fehler' }, { status: 500 });
  }
}
