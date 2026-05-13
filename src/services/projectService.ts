import { sql } from '@vercel/postgres';
import { ProjectStatsSchema, type ProjectStats } from '@/lib/schemas'; // ✅ Import

export async function getProjectsForDashboard(user: { id: string; role: string; mandant_id?: string | null }): Promise<ProjectStats[]> {
  let rows: any[] = [];

  if (user.role === 'SUPERADMIN') {
    const res = await sql`
      SELECT 
        u.id::text as id, u.email, u.role, u.domain, u.mandant_id, u.permissions, u.favicon_url,
        u.project_timeline_active, u.project_start_date, u.project_duration_months, u."createdAt",
        creator.email as creator_email,
        (
          SELECT STRING_AGG(DISTINCT admins.email, ', ')
          FROM project_assignments pa_sub
          JOIN users admins ON pa_sub.user_id = admins.id
          WHERE pa_sub.project_id = u.id
        ) as assigned_admins,
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
    rows = res.rows;
  }

  if (user.role === 'ADMIN') {
    const adminMandantId = user.mandant_id;
    const res = await sql`
      SELECT 
        u.id::text as id, u.email, u.role, u.domain, u.mandant_id, u.permissions, u.favicon_url,
        u.project_timeline_active, u.project_start_date, u.project_duration_months, u."createdAt",
        creator.email as creator_email,
        (
          SELECT STRING_AGG(DISTINCT admins.email, ', ')
          FROM project_assignments pa_sub
          JOIN users admins ON pa_sub.user_id = admins.id
          WHERE pa_sub.project_id = u.id
        ) as assigned_admins,
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
          (u.mandant_id = ${adminMandantId} AND u."createdByAdminId"::text = ${user.id})
          OR EXISTS (
            SELECT 1 FROM project_assignments pa 
            WHERE pa.project_id = u.id AND pa.user_id::text = ${user.id}
          )
        )
      GROUP BY u.id, creator.email
      ORDER BY u.domain ASC, u.email ASC
    `;
    rows = res.rows;
  }

  // ✅ ZOD VALIDIERUNG: Wandelt auch Strings in Numbers um (coerce)
  const parsedProjects = rows.map(row => {
      const result = ProjectStatsSchema.safeParse(row);
      if(!result.success) {
          console.warn("Project Data Validation Warning:", result.error.flatten());
          // Optional: Trotz Fehler versuchen, Teildaten zurückzugeben oder überspringen
          return null; 
      }
      return result.data;
  }).filter(p => p !== null) as ProjectStats[];

  return parsedProjects;
}
