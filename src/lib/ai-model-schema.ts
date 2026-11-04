// KI-Modelle, die der Superadmin unter System wählt: Standard, Format und Prüfung.
import { z } from 'zod';

export const DEFAULT_AI_MODELS = {
  primary: 'gemini-3.5-flash-lite',
  fallback: 'gemini-3.1-flash-lite',
} as const;

// Vorschläge in der Eingabe; jede andere gültige Gemini-ID ist ebenfalls erlaubt.
export const AI_MODEL_SUGGESTIONS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

// Nur Gemini-IDs (der Schlüssel ist ein Gemini-Key), z. B. gemini-3.5-flash-lite oder gemini-2.5-pro-preview-05-06.
const modelId = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^gemini-[a-z0-9][a-z0-9.-]{0,60}$/, 'Modell als Gemini-ID angeben, z. B. gemini-3.5-flash-lite');

export const aiModelsSchema = z.object({
  primary: modelId,
  fallback: modelId,
});

export type AiModels = z.infer<typeof aiModelsSchema>;
