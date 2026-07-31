import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { streamTextSafe } from '@/lib/ai-config';
import { requireContentStudioProject, ContentStudioAccessError } from '@/lib/content-studio/access';
import {
  buildDraftPrompt,
  buildOutlinePrompt,
  parseOutlineResponse,
} from '@/lib/content-studio/generator';
import { resolveProjectUrl } from '@/lib/content-studio/context';
import type {
  ContentBrief,
  ContentContext,
  ContentOutline,
  InternalLinkCandidate,
} from '@/lib/content-studio/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

const RequestSchema = z.object({
  action: z.enum(['outline', 'draft']),
  brief: z.object({
    projectId: z.string().uuid(),
    contentType: z.enum(['landingpage', 'article']),
    mode: z.enum(['new', 'optimize']),
    targetUrl: z.string().min(1),
    topic: z.string().min(2),
    region: z.string(),
    targetAudience: z.string(),
    conversionGoal: z.string(),
    brandMode: z.enum(['with-brand', 'without-brand']),
    tone: z.enum(['professional', 'approachable', 'technical']),
    facts: z.string().max(10_000),
    dateRange: z.enum(['30d', '3m', '6m']),
  }),
  context: z.custom<ContentContext>((value) => Boolean(value && typeof value === 'object')),
  outline: z.custom<ContentOutline>().optional(),
  selectedLinks: z.array(z.custom<InternalLinkCandidate>()).max(12).default([]),
});

export async function POST(request: NextRequest) {
  try {
    const body = RequestSchema.parse(await request.json());
    const { project } = await requireContentStudioProject(body.brief.projectId);
    const targetUrl = resolveProjectUrl(project, body.brief.targetUrl);
    if (body.context.project.id !== project.id) {
      return NextResponse.json({ message: 'Das Datenbriefing gehört nicht zu diesem Projekt.' }, { status: 400 });
    }

    const brief = { ...body.brief, targetUrl } as ContentBrief;
    const context: ContentContext = {
      ...body.context,
      project: {
        id: project.id,
        domain: project.domain || new URL(targetUrl).hostname,
        brandKeywords: project.brand_keywords || [],
      },
      targetUrl,
    };
    const selectedLinks = body.selectedLinks.map((link) => ({
      ...link,
      url: resolveProjectUrl(project, link.url),
    }));

    if (body.action === 'outline') {
      const result = await streamTextSafe({
        prompt: buildOutlinePrompt(brief, context, selectedLinks),
        temperature: 0.2,
      });
      const outline = parseOutlineResponse(await result.text);
      return NextResponse.json({ outline, model: result._modelName });
    }

    if (!body.outline) {
      return NextResponse.json({ message: 'Vor dem Entwurf ist eine Gliederung erforderlich.' }, { status: 400 });
    }

    const result = await streamTextSafe({
      prompt: buildDraftPrompt(brief, context, body.outline, selectedLinks),
      temperature: 0.45,
    });
    return result.toTextStreamResponse({
      headers: { 'X-AI-Model': result._modelName },
    });
  } catch (error) {
    if (error instanceof ContentStudioAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Ungültige Generierungsdaten', details: error.issues }, { status: 400 });
    }
    console.error('[Content Studio Generate]', error);
    return NextResponse.json({
      message: error instanceof Error ? error.message : 'Generierung fehlgeschlagen',
    }, { status: 500 });
  }
}
