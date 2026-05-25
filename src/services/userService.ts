import { sql } from '@vercel/postgres';
import { UserSchema, type User } from '@/lib/schemas'; // ✅ Import aus Schema

interface UserSession {
  id: string;
  role: string;
  mandant_id?: string | null;
  permissions?: string[];
}

export async function getUsersForManagement(user: UserSession): Promise<User[]> {
  try {
    let rows: any[] = [];

    // --- SUPERADMIN ---
    if (user.role === 'SUPERADMIN') {
      const result = await sql`
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
        WHERE u.role != 'SUPERADMIN'
        ORDER BY u.mandant_id ASC, u.role DESC, u.email ASC
      `;
      rows = result.rows;
    }

    // --- ADMIN ---
    else if (user.role === 'ADMIN') {
      const adminId = user.id;
      const adminMandantId = user.mandant_id;
      const kannAdminsVerwalten = user.permissions?.includes('kann_admins_verwalten');

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
      rows = kundenRes.rows;

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
      
      rows.sort((a, b) => (a.role > b.role) ? -1 : (a.role === b.role) ? a.email.localeCompare(b.email) : 1);
    }

    // ✅ VALIDIERUNG: Zod parst die Daten und wirft Fehler, wenn das Format falsch ist
    // .safeParse() verhindert Abstürze, wir filtern ungültige Einträge einfach raus oder loggen sie
    const parsedUsers = rows.map(row => {
        const result = UserSchema.safeParse(row);
        if (!result.success) {
            console.error("User Validation Error:", result.error, row);
            return null;
        }
        return result.data;
    }).filter(u => u !== null) as User[];

    return parsedUsers;

  } catch (error) {
    console.error('[UserService] Fehler beim Laden der Benutzer:', error);
    return [];
  }
}
