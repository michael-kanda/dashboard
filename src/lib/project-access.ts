import { sql } from '@vercel/postgres';

type ProjectAccessUser = {
  id?: string | null;
  role?: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Superadmins sehen alles, Admins nur zugewiesene Projekte, Kunden ausschließlich ihr eigenes Projekt.
export async function canAccessProject(user: ProjectAccessUser | null | undefined, projectId: string) {
  if (!user?.id) return false;
  if (user.role === 'SUPERADMIN') return true;
  if (user.role === 'ADMIN') {
    if (!UUID_PATTERN.test(user.id) || !UUID_PATTERN.test(projectId)) return false;
    const { rows } = await sql`
      SELECT 1 FROM project_assignments
      WHERE user_id = ${user.id}::uuid AND project_id = ${projectId}::uuid
      LIMIT 1
    `;
    return rows.length > 0;
  }
  return user.id === projectId;
}
