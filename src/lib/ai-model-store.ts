// Gewählte KI-Modelle aus app_settings (Migration 008); ohne Eintrag gelten die Standardmodelle.
import { sql } from '@vercel/postgres';
import { unstable_cache } from 'next/cache';
import { aiModelsSchema, DEFAULT_AI_MODELS, type AiModels } from './ai-model-schema';

export const AI_MODELS_CACHE_TAG = 'ai-models';

export async function readAiModels(): Promise<AiModels> {
  try {
    const { rows } = await sql`SELECT value FROM app_settings WHERE key = 'ai_models'`;
    const parsed = aiModelsSchema.safeParse(rows[0]?.value);
    return parsed.success ? parsed.data : { ...DEFAULT_AI_MODELS };
  } catch (error) {
    console.error('[KI-Modelle] Laden fehlgeschlagen, Standard aktiv:', error);
    return { ...DEFAULT_AI_MODELS };
  }
}

// Für jeden KI-Aufruf: gecacht, beim Speichern über das Tag geleert.
export const getAiModels = unstable_cache(readAiModels, ['ai-models'], {
  tags: [AI_MODELS_CACHE_TAG],
  revalidate: 300,
});

export async function saveAiModels(models: AiModels, updatedBy: string): Promise<void> {
  await sql`
    INSERT INTO app_settings (key, value, updated_by, updated_at)
    VALUES ('ai_models', ${JSON.stringify(models)}::jsonb, ${updatedBy}, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
  `;
}
