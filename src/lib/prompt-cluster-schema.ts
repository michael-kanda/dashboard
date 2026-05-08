// src/lib/prompt-cluster-schema.ts
//
// Zod-Schema + Types für KI-basierte Cluster-Analyse der Prompt-Tracking-Queries.
// Wird sowohl von der API-Route (Server) als auch der UI-Komponente (Client) benutzt.

import { z } from 'zod';

// ── Intent-Kategorien ─────────────────────────────────────────────
export const PromptIntentEnum = z.enum([
  'informational',  // "Wie funktioniert X?"
  'transactional',  // "X kaufen / bestellen"
  'comparative',    // "X vs Y", "Alternative zu X"
  'navigational',   // "Brand homepage / login"
  'commercial',     // "Beste X für Y", Erfahrungen, Bewertungen
]);
export type PromptIntent = z.infer<typeof PromptIntentEnum>;

// ── Einzelner Cluster ─────────────────────────────────────────────
export const PromptClusterEntrySchema = z.object({
  theme: z
    .string()
    .min(2)
    .max(80)
    .describe('Kurzer thematischer Titel des Clusters (max. 5 Wörter, Deutsch)'),

  intent: PromptIntentEnum.describe('Dominanter Intent dieses Clusters'),

  description: z
    .string()
    .min(20)
    .max(400)
    .describe('1–2 Sätze auf Deutsch, was diese Queries gemeinsam haben (Suchintention, Kontext)'),

  queryIndices: z
    .array(z.number().int().nonnegative())
    .min(1)
    .describe('Indizes (0-basiert) der ursprünglichen Queries, die zu diesem Cluster gehören'),

  topAttributes: z
    .array(z.string().min(1).max(40))
    .min(1)
    .max(6)
    .describe('3–5 wiederkehrende Attribute, Eigenschaften oder Entscheidungsfaktoren (z.B. "Preis", "Lieferzeit", "Vergleich zu Wettbewerber")'),
});
export type PromptClusterEntry = z.infer<typeof PromptClusterEntrySchema>;

// ── Aggregierte Insights über alle Cluster ───────────────────────
export const PromptClusterInsightsSchema = z.object({
  dominantIntent: z
    .string()
    .describe('Welcher Intent dominiert insgesamt – kurz beschrieben'),

  dominantAttributes: z
    .array(z.string())
    .min(1)
    .max(8)
    .describe('Top 3–5 dominante Attribute / Themen über alle Queries hinweg'),

  summary: z
    .string()
    .min(40)
    .max(800)
    .describe('2–4 Sätze Gesamtfazit auf Deutsch: Was sagen diese Prompts über die Zielgruppe / Marke?'),

  contentGaps: z
    .array(z.string().min(5).max(200))
    .min(1)
    .max(8)
    .describe('Konkrete Content-Lücken oder Optimierungsempfehlungen (FAQ, Vergleichsseiten, Use-Case-Artikel etc.)'),
});
export type PromptClusterInsights = z.infer<typeof PromptClusterInsightsSchema>;

// ── Vollständiges Result ──────────────────────────────────────────
export const PromptClusterResultSchema = z.object({
  clusters: z
    .array(PromptClusterEntrySchema)
    .min(1)
    .max(10)
    .describe('3–8 thematische Cluster (max. 10), nach Größe absteigend sortiert'),

  insights: PromptClusterInsightsSchema,
});
export type PromptClusterResult = z.infer<typeof PromptClusterResultSchema>;

// ── API-Request-Body ──────────────────────────────────────────────
export const PromptClusterRequestSchema = z.object({
  domain: z.string().optional(),
  dateRange: z.string().optional(),
  queries: z
    .array(
      z.object({
        query: z.string(),
        clicks: z.number(),
        impressions: z.number(),
      })
    )
    .min(5, 'Mindestens 5 Queries für eine sinnvolle Cluster-Analyse')
    .max(300, 'Maximal 300 Queries pro Request (Token-Limit)'),
});
export type PromptClusterRequest = z.infer<typeof PromptClusterRequestSchema>;

// ── Erweiterte Response (mit Metadaten) ──────────────────────────
export interface PromptClusterApiResponse extends PromptClusterResult {
  meta: {
    model: string;
    queriesAnalyzed: number;
    generatedAt: string;
    elapsedMs: number;
  };
}

// ── Intent-Labels für UI ──────────────────────────────────────────
export const INTENT_LABELS: Record<PromptIntent, { label: string; emoji: string; color: string }> = {
  informational: { label: 'Informational',  emoji: '📚', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  transactional: { label: 'Transactional',  emoji: '🛒', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  comparative:   { label: 'Vergleichend',   emoji: '⚖️', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  navigational:  { label: 'Navigational',   emoji: '🧭', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  commercial:    { label: 'Commercial',     emoji: '💼', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
};
