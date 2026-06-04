import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type ToolRunPayload = {
  projectId?: string;
  tool?: string;
  inputs?: Record<string, unknown>;
  dataSources?: string[];
  contentBrief?: Record<string, unknown>;
  resultText?: string;
};

async function ensureKiToolRunsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS ki_tool_runs (
      id SERIAL PRIMARY KEY,
      project_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      tool VARCHAR(80) NOT NULL,
      inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
      data_sources TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      content_brief JSONB NOT NULL DEFAULT '{}'::jsonb,
      result_text TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'success',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_ki_tool_runs_project_created
    ON ki_tool_runs(project_id, created_at DESC);
  `;
}

function canUseKiSuite(role?: string) {
  return role === 'ADMIN' || role === 'SUPERADMIN';
}

async function canAccessProject(projectId: string, userId: string, role?: string) {
  if (role === 'SUPERADMIN') return true;
  if (role !== 'ADMIN') return false;

  const { rows } = await sql`
    SELECT 1
    FROM project_assignments
    WHERE user_id::text = ${userId}
      AND project_id = ${projectId}::uuid
    LIMIT 1
  `;

  return rows.length > 0;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!canUseKiSuite(session?.user?.role) || !session?.user?.id) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const projectId = request.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ message: 'projectId ist erforderlich' }, { status: 400 });
    }

    if (!(await canAccessProject(projectId, session.user.id, session.user.role))) {
      return NextResponse.json({ message: 'Zugriff auf dieses Projekt verweigert' }, { status: 403 });
    }

    await ensureKiToolRunsTable();

    const { rows } = await sql`
      SELECT
        id,
        project_id::text as "projectId",
        created_by::text as "createdBy",
        tool,
        inputs,
        data_sources as "dataSources",
        content_brief as "contentBrief",
        LEFT(COALESCE(result_text, ''), 800) as "resultPreview",
        status,
        created_at as "createdAt"
      FROM ki_tool_runs
      WHERE project_id = ${projectId}::uuid
      ORDER BY created_at DESC
      LIMIT 12
    `;

    return NextResponse.json({ runs: rows });
  } catch (error) {
    console.error('[ki-tool-runs] GET error:', error);
    return NextResponse.json(
      { message: 'KI-Tool-Verlauf konnte nicht geladen werden' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!canUseKiSuite(session?.user?.role) || !session?.user?.id) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const body = (await request.json()) as ToolRunPayload;
    const projectId = body.projectId;
    const tool = body.tool?.trim();

    if (!projectId || !tool) {
      return NextResponse.json({ message: 'projectId und tool sind erforderlich' }, { status: 400 });
    }

    if (!(await canAccessProject(projectId, session.user.id, session.user.role))) {
      return NextResponse.json({ message: 'Zugriff auf dieses Projekt verweigert' }, { status: 403 });
    }

    await ensureKiToolRunsTable();

    const client = await sql.connect();
    try {
      const result = await client.query(
        `
          INSERT INTO ki_tool_runs
            (project_id, created_by, tool, inputs, data_sources, content_brief, result_text, status)
          VALUES
            ($1::uuid, $2::uuid, $3, $4::jsonb, $5::text[], $6::jsonb, $7, 'success')
          RETURNING
            id,
            project_id::text as "projectId",
            created_by::text as "createdBy",
            tool,
            inputs,
            data_sources as "dataSources",
            content_brief as "contentBrief",
            LEFT(COALESCE(result_text, ''), 800) as "resultPreview",
            status,
            created_at as "createdAt"
        `,
        [
          projectId,
          session.user.id,
          tool,
          JSON.stringify(body.inputs ?? {}),
          body.dataSources ?? [],
          JSON.stringify(body.contentBrief ?? {}),
          body.resultText ?? '',
        ]
      );

      return NextResponse.json({ run: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[ki-tool-runs] POST error:', error);
    return NextResponse.json(
      { message: 'KI-Tool-Lauf konnte nicht gespeichert werden' },
      { status: 500 }
    );
  }
}
