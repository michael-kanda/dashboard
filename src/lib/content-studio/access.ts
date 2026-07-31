import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';
import { UserSchema, type User } from '@/lib/schemas';

type ContentStudioSession = {
  id: string;
  email?: string | null;
  role: 'ADMIN' | 'SUPERADMIN';
};

export class ContentStudioAccessError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function requireContentStudioProject(projectId: string): Promise<{
  sessionUser: ContentStudioSession;
  project: User;
}> {
  const session = await auth();
  const sessionUser = session?.user;

  if (
    !sessionUser?.id ||
    (sessionUser.role !== 'ADMIN' && sessionUser.role !== 'SUPERADMIN')
  ) {
    throw new ContentStudioAccessError('Zugriff verweigert', 403);
  }

  if (sessionUser.role === 'ADMIN') {
    const { rows } = await sql`
      SELECT 1
      FROM project_assignments
      WHERE user_id::text = ${sessionUser.id}
        AND project_id::text = ${projectId}
      LIMIT 1
    `;
    if (rows.length === 0) {
      throw new ContentStudioAccessError('Zugriff auf dieses Projekt verweigert', 403);
    }
  }

  const { rows } = await sql`
    SELECT *
    FROM users
    WHERE id::text = ${projectId}
      AND role = 'BENUTZER'
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new ContentStudioAccessError('Projekt nicht gefunden', 404);
  }

  const parsed = UserSchema.safeParse(rows[0]);
  if (!parsed.success) {
    console.error('[Content Studio] Ungültige Projektdaten:', parsed.error);
    throw new ContentStudioAccessError('Projektdaten sind unvollständig', 500);
  }

  return {
    sessionUser: {
      id: sessionUser.id,
      email: sessionUser.email,
      role: sessionUser.role,
    },
    project: parsed.data,
  };
}
