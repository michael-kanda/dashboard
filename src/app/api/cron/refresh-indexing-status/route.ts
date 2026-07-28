import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import {
  ensureIndexingStatusSchema,
  syncProjectIndexingStatus,
} from '@/lib/indexing-status';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  await ensureIndexingStatusSchema();
  const { rows: projects } = await sql<{ id: string; email: string }>`
    SELECT u.id::text, u.email
    FROM users u
    LEFT JOIN project_indexing_sync s ON s.user_id = u.id
    WHERE u.role = 'BENUTZER'
      AND u.gsc_site_url IS NOT NULL
      AND (
        s.user_id IS NULL
        OR s.next_sync_at IS NULL
        OR s.next_sync_at <= NOW()
      )
    ORDER BY
      CASE WHEN s.status = 'partial' THEN 0 ELSE 1 END,
      s.completed_at ASC NULLS FIRST
    LIMIT 5
  `;

  const results: Array<{ projectId: string; email: string; success: boolean; message: string }> = [];
  for (const project of projects) {
    try {
      const status = await syncProjectIndexingStatus(project.id, {
        maxInspections: 120,
      });
      results.push({
        projectId: project.id,
        email: project.email,
        success: true,
        message: `${status.indexedUrls}/${status.totalUrls} URLs indexiert`,
      });
    } catch (error) {
      results.push({
        projectId: project.id,
        email: project.email,
        success: false,
        message: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    }
  }

  return NextResponse.json({
    processed: results.length,
    success: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success).length,
    results,
  });
}
