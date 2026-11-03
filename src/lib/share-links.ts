// Gastlinks anlegen, auflösen und widerrufen (Tabelle project_share_links, Migration 009).
import { sql } from '@vercel/postgres';
import { createShareToken, hashShareToken, isShareTokenFormat, SHARE_LINK_TTL_HOURS } from './share-link-token';

export async function createShareLink(projectId: string, createdBy: string | null) {
  const token = createShareToken();
  const expiresAt = new Date(Date.now() + SHARE_LINK_TTL_HOURS * 60 * 60 * 1000);
  await sql`
    INSERT INTO project_share_links (token_hash, project_id, created_by, expires_at)
    VALUES (${hashShareToken(token)}, ${projectId}::uuid, ${createdBy}::uuid, ${expiresAt.toISOString()})
  `;
  return { token, expiresAt };
}

// Liefert Projekt und Ablauf nur für gültige, nicht widerrufene Links.
export async function resolveShareLink(token: string): Promise<{ projectId: string; expiresAt: Date } | null> {
  if (!isShareTokenFormat(token)) return null;
  const { rows } = await sql`
    SELECT project_id::text AS project_id, expires_at
    FROM project_share_links
    WHERE token_hash = ${hashShareToken(token)}
      AND revoked_at IS NULL
      AND expires_at > NOW()
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return { projectId: String(rows[0].project_id), expiresAt: new Date(rows[0].expires_at) };
}

export async function revokeShareLinks(projectId: string): Promise<number> {
  const { rowCount } = await sql`
    UPDATE project_share_links
    SET revoked_at = NOW()
    WHERE project_id = ${projectId}::uuid AND revoked_at IS NULL AND expires_at > NOW()
  `;
  return rowCount ?? 0;
}
