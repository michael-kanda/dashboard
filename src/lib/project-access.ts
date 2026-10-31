import { sql } from '@vercel/postgres';

type ProjectAccessUser = {
  id?: string | null;
  role?: string | null;
};

// Gleiche Regel wie /api/projects/[id] und /api/data: Superadmins sehen alles,
// Admins nur zugewiesene Projekte, Kunden ausschließlich ihr eigenes Projekt.
export async function canAccessProject(user: ProjectAccessUser | null | undefined, projectId: string) {
  if (!user?.id) return false;
  if (user.role === 'SUPERADMIN') return true;
  if (user.role === 'ADMIN') {
    const { rows } = await sql`
      SELECT 1 FROM project_assignments
      WHERE user_id::text = ${user.id} AND project_id::text = ${projectId}
      LIMIT 1
    `;
    return rows.length > 0;
  }
  return user.id === projectId;
}
