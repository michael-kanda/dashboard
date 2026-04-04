// src/app/api/users/[id]/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth'; 
import { User } from '@/types';
export const revalidate = 0;

// Handler zum Abrufen eines einzelnen Benutzers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params; 
  try {
    const session = await auth(); 
    
    // Berechtigungsprüfung: Admins ODER der Benutzer selbst
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { 
      role: sessionRole, 
      id: sessionId, 
      mandant_id: sessionMandantId, 
      permissions: sessionPermissions
    } = session.user;
    
    const isAdmin = sessionRole === 'ADMIN' || sessionRole === 'SUPERADMIN';
    const isOwnProfile = sessionId === targetUserId;

    if (!isAdmin && !isOwnProfile) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    // Lade Zieldaten - INKL. maintenance_mode
    const { rows } = await sql<User>`
      SELECT
        id::text as id,
        email,
        role,
        domain,
        gsc_site_url,
        ga4_property_id,
        semrush_project_id,
        semrush_tracking_id,
        semrush_tracking_id_02,
        google_ads_sheet_id,
        mandant_id,
        permissions,
        favicon_url,
        project_start_date,      
        project_duration_months,
        project_timeline_active::boolean as project_timeline_active,
        maintenance_mode::boolean as maintenance_mode
      FROM users
      WHERE id = ${targetUserId}::uuid;
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }
    
    const userToGet = rows[0];

    // --- BERECHTIGUNGSPRÜFUNG ---
    if (sessionRole === 'ADMIN') {
      if (userToGet.mandant_id !== sessionMandantId) {
         return NextResponse.json({ message: 'Zugriff auf diesen Mandanten verweigert' }, { status: 403 });
      }
      const kannAdminsVerwalten = sessionPermissions?.includes('kann_admins_verwalten');
      if (userToGet.role === 'ADMIN' && !isOwnProfile && !kannAdminsVerwalten) {
          return NextResponse.json({ message: 'Sie haben keine Berechtigung, diesen Admin anzuzeigen' }, { status: 403 });
      }
    }
    
    return NextResponse.json(userToGet);
  } catch (error) {
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// Handler zum Aktualisieren eines Benutzers
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  try {
    const session = await auth(); 
    
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { 
      role: sessionRole, 
      id: sessionId, 
      mandant_id: sessionMandantId,
      permissions: sessionPermissions
    } = session.user;
    
    const isOwnProfile = sessionId === targetUserId;

    if (sessionRole !== 'ADMIN' && sessionRole !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }
    
    const body = await request.json();

    const {
        email,
        domain,
        gsc_site_url,
        ga4_property_id,
        semrush_project_id,
        semrush_tracking_id,
        semrush_tracking_id_02,
        google_ads_sheet_id,
        password,
        mandant_id, 
        permissions,  
        favicon_url,
        project_start_date,
        project_duration_months,
        project_timeline_active,
        maintenance_mode // NEU
    } = body;

    if (!email) {
      return NextResponse.json({ message: 'E-Mail ist erforderlich' }, { status: 400 });
    }

    const { rows: existingUsers } = await sql`
      SELECT role, mandant_id FROM users WHERE id = ${targetUserId}::uuid
    `;
    if (existingUsers.length === 0) {
      return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }
    const targetUser = existingUsers[0];

    // --- BERECHTIGUNGSPRÜFUNG ---
    if (sessionRole === 'ADMIN') {
      if (targetUser.role === 'SUPERADMIN') {
        return NextResponse.json({ message: 'Admins dürfen keine Superadmins bearbeiten' }, { status: 403 });
      }
      if (targetUser.mandant_id !== sessionMandantId) {
        return NextResponse.json({ message: 'Sie dürfen nur Benutzer Ihres eigenen Mandanten bearbeiten' }, { status: 403 });
      }
      const kannAdminsVerwalten = sessionPermissions?.includes('kann_admins_verwalten');
      if (targetUser.role === 'ADMIN' && !isOwnProfile && !kannAdminsVerwalten) {
         return NextResponse.json({ message: 'Sie haben keine Berechtigung, andere Admins zu bearbeiten' }, { status: 403 });
      }
      if ((body.mandant_id !== targetUser.mandant_id || body.permissions) && !kannAdminsVerwalten) {
         if (body.mandant_id || body.permissions) {
            return NextResponse.json({ message: 'Nur Superadmins (oder Admins mit Sonderrechten) dürfen Mandanten und Berechtigungen ändern' }, { status: 403 });
         }
      }
    }
    if (sessionRole === 'SUPERADMIN') {
      if (targetUser.role !== 'SUPERADMIN' && body.role === 'SUPERADMIN') {
         return NextResponse.json({ message: 'Die Zuweisung der SUPERADMIN-Rolle ist über die API nicht gestattet.' }, { status: 403 });
      }
      if (isOwnProfile) {
         return NextResponse.json({ message: 'Superadmins können sich nicht selbst über die API bearbeiten.' }, { status: 403 });
      }
    }

    // SUPERADMIN darf nicht in Wartungsmodus gesetzt werden
    if (targetUser.role === 'SUPERADMIN' && maintenance_mode === true) {
      return NextResponse.json({ 
        message: 'Superadmins können nicht in den Wartungsmodus gesetzt werden' 
      }, { status: 403 });
    }
    // --- ENDE BERECHTIGUNGSPRÜFUNG ---

    const normalizedEmail = email.toLowerCase().trim();

    const { rows: emailCheck } = await sql`
      SELECT id FROM users
      WHERE email = ${normalizedEmail} AND id::text != ${targetUserId};
    `;
    if (emailCheck.length > 0) {
      return NextResponse.json({
        message: 'Diese E-Mail-Adresse wird bereits von einem anderen Benutzer verwendet'
      }, { status: 409 });
    }
    
    console.log(`[PUT /api/users/${targetUserId}] Update-Anfrage...`);
    
    const permissionsArray = Array.isArray(permissions) ? permissions : [];
    const permissionsPgString = `{${permissionsArray.join(',')}}`;

    const duration = project_duration_months ? parseInt(String(project_duration_months), 10) : null;
    const startDate = project_start_date ? new Date(project_start_date).toISOString() : null;
    const timelineActive = typeof project_timeline_active === 'boolean' ? project_timeline_active : false;
    // NEU: maintenance_mode
    const maintenanceActive = typeof maintenance_mode === 'boolean' ? maintenance_mode : false;

    const { rows } = password && password.trim().length > 0
      ? // Query MIT Passwort
        await sql<User>`
          UPDATE users
          SET 
            email = ${normalizedEmail},
            domain = ${domain || null},
            gsc_site_url = ${gsc_site_url || null},
            ga4_property_id = ${ga4_property_id || null},
            semrush_project_id = ${semrush_project_id || null},
            semrush_tracking_id = ${semrush_tracking_id || null},
            semrush_tracking_id_02 = ${semrush_tracking_id_02 || null},
            google_ads_sheet_id = ${google_ads_sheet_id || null},
            mandant_id = ${mandant_id || null},
            permissions = ${permissionsPgString},
            favicon_url = ${favicon_url || null},
            project_start_date = ${startDate},
            project_duration_months = ${duration},
            project_timeline_active = ${timelineActive},
            maintenance_mode = ${maintenanceActive},
            password = ${await bcrypt.hash(password, 10)}
          WHERE id = ${targetUserId}::uuid
          RETURNING
            id::text as id, email, role, domain, 
            gsc_site_url, ga4_property_id, 
            semrush_project_id, semrush_tracking_id, semrush_tracking_id_02,
            google_ads_sheet_id,
            mandant_id, permissions, favicon_url,
            project_start_date, project_duration_months, project_timeline_active,
            maintenance_mode;
        `
      : // Query OHNE Passwort
        await sql<User>`
          UPDATE users
          SET 
            email = ${normalizedEmail},
            domain = ${domain || null},
            gsc_site_url = ${gsc_site_url || null},
            ga4_property_id = ${ga4_property_id || null},
            semrush_project_id = ${semrush_project_id || null},
            semrush_tracking_id = ${semrush_tracking_id || null},
            semrush_tracking_id_02 = ${semrush_tracking_id_02 || null},
            google_ads_sheet_id = ${google_ads_sheet_id || null},
            mandant_id = ${mandant_id || null},
            permissions = ${permissionsPgString},
            favicon_url = ${favicon_url || null},
            project_start_date = ${startDate},
            project_duration_months = ${duration},
            project_timeline_active = ${timelineActive},
            maintenance_mode = ${maintenanceActive}
          WHERE id = ${targetUserId}::uuid
          RETURNING
            id::text as id, email, role, domain, 
            gsc_site_url, ga4_property_id, 
            semrush_project_id, semrush_tracking_id, semrush_tracking_id_02,
            google_ads_sheet_id,
            mandant_id, permissions, favicon_url,
            project_start_date, project_duration_months, project_timeline_active,
            maintenance_mode;
        `;

    if (rows.length === 0) {
      return NextResponse.json({ message: "Update fehlgeschlagen. Benutzer nicht gefunden." }, { status: 404 });
    }

    console.log(`✅ [PUT /api/users/${targetUserId}] Benutzer erfolgreich aktualisiert:`, rows[0].email);
    
    return NextResponse.json({
      ...rows[0],
      message: 'Benutzer erfolgreich aktualisiert'
    });

  } catch (error) {
    console.error(`[PUT /api/users/${targetUserId}] Fehler:`, error);
    return NextResponse.json({
      message: 'Interner Serverfehler',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}

// Handler zum Löschen eines Benutzers (unverändert)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  try {
    const session = await auth(); 
    
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { 
      role: sessionRole, 
      id: sessionId, 
      mandant_id: sessionMandantId,
      permissions: sessionPermissions
    } = session.user;
    
    const isOwnProfile = sessionId === targetUserId;


    if (sessionRole !== 'ADMIN' && sessionRole !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    console.log(`[DELETE /api/users/${targetUserId}] Lösche Benutzer...`);

    const { rows: existingUsers } = await sql`
      SELECT role, mandant_id FROM users WHERE id = ${targetUserId}::uuid
    `;
    if (existingUsers.length === 0) {
      return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }
    const targetUser = existingUsers[0];

    // --- BERECHTIGUNGSPRÜFUNG ---
    if (sessionRole === 'ADMIN') {
      if (targetUser.role === 'SUPERADMIN') {
        return NextResponse.json({ message: 'Admins dürfen keine Superadmins löschen' }, { status: 403 });
      }
      if (targetUser.mandant_id !== sessionMandantId) {
        return NextResponse.json({ message: 'Sie dürfen nur Benutzer Ihres eigenen Mandanten löschen' }, { status: 403 });
      }
      const kannAdminsVerwalten = sessionPermissions?.includes('kann_admins_verwalten');
      if (targetUser.role === 'ADMIN' && !isOwnProfile && !kannAdminsVerwalten) {
         return NextResponse.json({ message: 'Sie haben keine Berechtigung, andere Admins zu löschen' }, { status: 403 });
      }
      if (isOwnProfile) {
         return NextResponse.json({ message: 'Admins können sich nicht selbst löschen.' }, { status: 403 });
      }
    }

    if (sessionRole === 'SUPERADMIN') {
      if (targetUser.role === 'SUPERADMIN' || isOwnProfile) {
         return NextResponse.json({ message: 'Superadmins können nicht sich selbst oder andere Superadmins löschen.' }, { status: 403 });
      }
    }
    // --- ENDE BERECHTIGUNGSPRÜFUNG ---

    const result = await sql`
      DELETE FROM users WHERE id = ${targetUserId}::uuid;
    `;

    if (result.rowCount === 0) {
      return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }

    console.log(`✅ [DELETE /api/users/${targetUserId}] Benutzer erfolgreich gelöscht`);
    return NextResponse.json({ message: 'Benutzer erfolgreich gelöscht' });
  } catch (error) {
    console.error(`[DELETE /api/users/${targetUserId}] Fehler:`, error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
