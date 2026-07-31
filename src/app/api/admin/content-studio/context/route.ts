import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireContentStudioProject, ContentStudioAccessError } from '@/lib/content-studio/access';
import { buildContentContext } from '@/lib/content-studio/context';
import type { ContentBrief } from '@/lib/content-studio/types';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  projectId: z.string().uuid(),
  contentType: z.enum(['landingpage', 'article']),
  mode: z.enum(['new', 'optimize']),
  targetUrl: z.string().min(1),
  topic: z.string().min(2),
  region: z.string().max(100).default('Österreich'),
  targetAudience: z.string().max(300).default(''),
  conversionGoal: z.string().max(300).default(''),
  brandMode: z.enum(['with-brand', 'without-brand']).default('with-brand'),
  tone: z.enum(['professional', 'approachable', 'technical']).default('professional'),
  facts: z.string().max(10_000).default(''),
  dateRange: z.enum(['30d', '3m', '6m']).default('3m'),
});

export async function GET(request: NextRequest) {
  try {
    const parsed = QuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { project } = await requireContentStudioProject(parsed.projectId);
    const context = await buildContentContext(project, parsed as ContentBrief);
    return NextResponse.json({ context });
  } catch (error) {
    if (error instanceof ContentStudioAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Bitte Setup-Felder vollständig ausfüllen.', details: error.issues }, { status: 400 });
    }
    console.error('[Content Studio Context]', error);
    return NextResponse.json({
      message: error instanceof Error ? error.message : 'Content-Kontext konnte nicht geladen werden.',
    }, { status: 500 });
  }
}
