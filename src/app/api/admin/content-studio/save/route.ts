import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { z } from 'zod';
import { requireContentStudioProject, ContentStudioAccessError } from '@/lib/content-studio/access';
import { resolveProjectUrl } from '@/lib/content-studio/context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SaveSchema = z.object({
  projectId: z.string().uuid(),
  contentType: z.enum(['landingpage', 'article']),
  targetUrl: z.string().min(1),
  brief: z.record(z.string(), z.unknown()),
  outline: z.record(z.string(), z.unknown()),
  contentMarkdown: z.string().min(20),
  metaTitle: z.string().max(180),
  metaDescription: z.string().max(500),
  primaryKeyword: z.string().max(300),
  secondaryKeywords: z.array(z.string()).max(30),
  internalLinks: z.array(z.record(z.string(), z.unknown())).max(20),
  dataSources: z.array(z.string()).max(20),
});

export async function GET(request: NextRequest) {
  try {
    const projectId = z.string().uuid().parse(request.nextUrl.searchParams.get('projectId'));
    await requireContentStudioProject(projectId);
    const { rows } = await sql`
      SELECT
        id,
        inputs,
        content_brief AS "contentBrief",
        result_text AS "resultText",
        data_sources AS "dataSources",
        created_at AS "createdAt"
      FROM ki_tool_runs
      WHERE project_id = ${projectId}::uuid
        AND tool LIKE 'Content Studio%'
      ORDER BY created_at DESC
      LIMIT 20
    `;
    return NextResponse.json({ versions: rows });
  } catch (error) {
    if (error instanceof ContentStudioAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Versionen konnten nicht geladen werden.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = SaveSchema.parse(await request.json());
    const { project, sessionUser } = await requireContentStudioProject(body.projectId);
    const targetUrl = resolveProjectUrl(project, body.targetUrl);
    const client = await sql.connect();

    try {
      await client.query('BEGIN');
      const landingpageResult = await client.query(
        `
          INSERT INTO landingpages (
            user_id, url, haupt_keyword, weitere_keywords, status,
            content_type, content_markdown, content_outline, meta_title,
            meta_description, internal_links, content_brief, updated_at
          )
          VALUES (
            $1::uuid, $2, $3, $4, 'Offen', $5, $6, $7::jsonb, $8,
            $9, $10::jsonb, $11::jsonb, NOW()
          )
          ON CONFLICT (url, user_id) DO UPDATE SET
            haupt_keyword = EXCLUDED.haupt_keyword,
            weitere_keywords = EXCLUDED.weitere_keywords,
            content_type = EXCLUDED.content_type,
            content_markdown = EXCLUDED.content_markdown,
            content_outline = EXCLUDED.content_outline,
            meta_title = EXCLUDED.meta_title,
            meta_description = EXCLUDED.meta_description,
            internal_links = EXCLUDED.internal_links,
            content_brief = EXCLUDED.content_brief,
            updated_at = NOW()
          RETURNING id
        `,
        [
          body.projectId,
          targetUrl,
          body.primaryKeyword,
          body.secondaryKeywords.join(', '),
          body.contentType,
          body.contentMarkdown,
          JSON.stringify(body.outline),
          body.metaTitle,
          body.metaDescription,
          JSON.stringify(body.internalLinks),
          JSON.stringify(body.brief),
        ]
      );

      const inputs = {
        landingpageId: landingpageResult.rows[0].id,
        contentType: body.contentType,
        targetUrl,
        outline: body.outline,
        metaTitle: body.metaTitle,
        metaDescription: body.metaDescription,
        internalLinks: body.internalLinks,
      };
      const runResult = await client.query(
        `
          INSERT INTO ki_tool_runs (
            project_id, created_by, tool, inputs, data_sources,
            content_brief, result_text, status
          )
          VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5::text[], $6::jsonb, $7, 'success')
          RETURNING id, created_at AS "createdAt"
        `,
        [
          body.projectId,
          sessionUser.id,
          `Content Studio · ${body.contentType === 'landingpage' ? 'Landingpage' : 'Artikel'}`,
          JSON.stringify(inputs),
          body.dataSources,
          JSON.stringify(body.brief),
          body.contentMarkdown,
        ]
      );

      await client.query('COMMIT');
      return NextResponse.json({
        landingpageId: landingpageResult.rows[0].id,
        version: runResult.rows[0],
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof ContentStudioAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Entwurf ist unvollständig.', details: error.issues }, { status: 400 });
    }
    console.error('[Content Studio Save]', error);
    return NextResponse.json({
      message: error instanceof Error ? error.message : 'Entwurf konnte nicht gespeichert werden.',
    }, { status: 500 });
  }
}
