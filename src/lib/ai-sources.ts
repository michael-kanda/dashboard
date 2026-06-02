// src/lib/ai-sources.ts
// Zentrale Definition der KI-Traffic-Erkennung: Quell-Domains, Normalisierung
// und der kombinierte GA4-Dimensionsfilter. Single Source of Truth — vorher
// waren AI_SOURCES/normalizeSource in google-api, ai-traffic-extended (v1) und
// ai-traffic-extended-v2 dupliziert und drifteten auseinander.

import type { analyticsdata_v1beta } from 'googleapis';

/**
 * Bekannte KI-Assistenten-Referrer (Matching über sessionSource, CONTAINS).
 * Wird mit GA4s nativem "AI Assistant"-Channel kombiniert (siehe
 * buildAiTrafficDimensionFilter): Die Liste fängt Quellen, die GA4 (noch)
 * nicht als AI Assistant klassifiziert; der native Channel fängt neue/künftige
 * Tools ohne Pflegeaufwand.
 */
export const AI_SOURCES = [
  'chatgpt.com', 'chat.openai.com', 'openai.com',
  'claude.ai', 'anthropic.com',
  'gemini.google.com', 'bard.google.com',
  'perplexity.ai',
  'bing.com/chat', 'copilot.microsoft.com',
  'you.com',
  'poe.com',
  'character.ai',
];

/** GA4 Default-Channel-Group-Wert für KI-Assistenten (nativ seit 13.05.2026). */
export const AI_ASSISTANT_CHANNEL = 'AI Assistant';

/** Gruppiert verwandte Roh-Quellen auf einen kanonischen Anzeige-Key. */
export function normalizeSource(source: string): string {
  const lower = source.toLowerCase();
  if (lower.includes('chatgpt') || lower.includes('openai')) return 'chatgpt.com';
  if (lower.includes('claude') || lower.includes('anthropic')) return 'claude.ai';
  if (lower.includes('perplexity')) return 'perplexity.ai';
  if (lower.includes('gemini') || lower.includes('bard')) return 'gemini.google.com';
  if (lower.includes('copilot') || lower.includes('bing')) return 'copilot.microsoft.com';
  if (lower.includes('you.com')) return 'you.com';
  if (lower.includes('poe')) return 'poe.com';
  if (lower.includes('character')) return 'character.ai';
  return source;
}

/**
 * Kombinierter Dimensionsfilter für KI-Traffic: Eine Session zählt, wenn
 * ENTWEDER die sessionSource eine bekannte KI-Domain enthält ODER GA4 sie dem
 * nativen "AI Assistant"-Channel zugeordnet hat. Per OR verknüpft — daher kein
 * Doppelzählen: Jede Session erscheint pro Abfrage genau einmal, unabhängig
 * davon, ob sie eine oder beide Bedingungen erfüllt.
 *
 * Hinweis: Der native Channel verliert Sessions ohne Referrer-Header an
 * "Direct" (z. B. In-App-Browser mancher Assistenten); die CONTAINS-Liste fängt
 * solche Fälle teils auf. Die Kombination ist daher abdeckender als jede
 * Methode allein.
 */
export function buildAiTrafficDimensionFilter(): analyticsdata_v1beta.Schema$FilterExpression {
  return {
    orGroup: {
      expressions: [
        ...AI_SOURCES.map((source) => ({
          filter: {
            fieldName: 'sessionSource',
            stringFilter: {
              matchType: 'CONTAINS' as const,
              value: source,
              caseSensitive: false,
            },
          },
        })),
        {
          filter: {
            fieldName: 'sessionDefaultChannelGroup',
            stringFilter: {
              matchType: 'EXACT' as const,
              value: AI_ASSISTANT_CHANNEL,
            },
          },
        },
      ],
    },
  };
}
