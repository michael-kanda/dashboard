// src/app/api/admin/ai-models/route.ts
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { generateText } from 'ai';
import { auth } from '@/lib/auth';
import { google } from '@/lib/ai-config';
import { aiModelsSchema } from '@/lib/ai-model-schema';
import { AI_MODELS_CACHE_TAG, saveAiModels } from '@/lib/ai-model-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function testModel(modelId: string): Promise<string | null> {
  try {
    await generateText({ model: google(modelId), prompt: 'Antworte exakt mit OK.', temperature: 0, maxOutputTokens: 8 });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * PUT: Haupt- und Ersatzmodell für alle KI-Funktionen setzen (Nur für Superadmin).
 * Beide Modelle werden vorher live getestet, damit kein ungültiges Modell gespeichert wird.
 */
export async function PUT(req: Request) {
  const session = await auth();
  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nur Superadmins können das KI-Modell ändern' }, { status: 403 });
  }

  const parsed = aiModelsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? 'Ungültige Modelle' }, { status: 400 });
  }
  const models = parsed.data;

  const [primaryError, fallbackError] = await Promise.all([
    testModel(models.primary),
    models.fallback === models.primary ? Promise.resolve(null) : testModel(models.fallback),
  ]);
  if (primaryError || fallbackError) {
    const failed = primaryError ? `Hauptmodell ${models.primary}` : `Ersatzmodell ${models.fallback}`;
    return NextResponse.json(
      { message: `${failed} antwortet nicht: ${(primaryError || fallbackError)!.slice(0, 200)}` },
      { status: 422 },
    );
  }

  try {
    await saveAiModels(models, session.user.email ?? 'superadmin');
  } catch (error) {
    if ((error as { code?: string } | null)?.code === '42P01') {
      return NextResponse.json({ message: 'Tabelle app_settings fehlt. Bitte zuerst Migration 008 ausführen.' }, { status: 500 });
    }
    console.error('[KI-Modelle] Speichern fehlgeschlagen:', error);
    return NextResponse.json({ message: 'KI-Modell konnte nicht gespeichert werden' }, { status: 500 });
  }

  revalidateTag(AI_MODELS_CACHE_TAG);
  return NextResponse.json({ models });
}
