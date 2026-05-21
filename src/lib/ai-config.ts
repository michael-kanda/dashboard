// src/lib/ai-config.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

// ============================================================================
// ZENTRALE AI-KONFIGURATION
// ============================================================================

export const AI_CONFIG = {
  // Modell-Kette: Beste zuerst, dann Fallbacks
  models: [
    'gemini-3.1-flash-lite',  // Primary (Free Tier, beste Qualität, aber 20 Req/Tag Limit)
    'gemini-2.5-flash',        // Fallback 1 (Pay-as-you-go verfügbar)
    'gemini-2.0-flash',        // Fallback 2 (günstigster Paid, sehr stabil)
  ] as const,
  
  // Shortcuts für direkten Zugriff (Rückwärtskompatibilität)
  primaryModel: 'gemini-flash-latest' as const,
  fallbackModel: 'gemini-2.5-flash' as const,
  lastResortModel: 'gemini-2.0-flash' as const,
  
  // Temperature-Presets
  settings: {
    strict: { temperature: 0.1 },    // Für JSON, Code, Fakten
    balanced: { temperature: 0.7 },  // Standard
    creative: { temperature: 0.9 },  // Für Content, Brainstorming
  },
  
  // Default Temperature
  temperature: 0.7,
};

// ============================================================================
// GOOGLE AI PROVIDER
// ============================================================================

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export { google };

// ============================================================================
// TYPEN
// ============================================================================

type ModelStatus = 'primary' | 'fallback' | 'lastResort';

// Metadata die wir zum Result hinzufügen
interface AIMetadata {
  _modelName: string;
  _status: ModelStatus;
}

// Typ für das erweiterte Result (StreamTextResult + unsere Metadata)
type EnhancedStreamResult = Awaited<ReturnType<typeof streamText>> & AIMetadata;

// ============================================================================
// HELPER: Rate-Limit-Erkennung
// ============================================================================

function isRateLimitError(error: unknown): boolean {
  const errorStr = String(error).toLowerCase();
  return (
    errorStr.includes('429') ||
    errorStr.includes('quota') ||
    errorStr.includes('rate limit') ||
    errorStr.includes('too many requests') ||
    errorStr.includes('resource exhausted') ||
    errorStr.includes('exceeded')
  );
}

function getErrorType(error: unknown): 'rateLimit' | 'serverError' | 'unknown' {
  if (isRateLimitError(error)) return 'rateLimit';
  
  const errorStr = String(error).toLowerCase();
  if (errorStr.includes('500') || errorStr.includes('503') || errorStr.includes('internal')) {
    return 'serverError';
  }
  
  return 'unknown';
}

// ============================================================================
// HAUPTFUNKTION: streamTextSafe mit Multi-Fallback
// ============================================================================

/**
 * Führt streamText mit automatischem Multi-Fallback aus.
 * Versucht alle Modelle in der Reihenfolge: Primary → Fallback → LastResort
 * 
 * RÜCKWÄRTSKOMPATIBEL: Gibt direkt das StreamTextResult zurück,
 * mit zusätzlichen Properties _modelName und _status.
 * 
 * @example
 * const result = await streamTextSafe({
 *   prompt: 'Analysiere diese Daten...',
 *   temperature: 0.3,
 * });
 * return result.toTextStreamResponse(); // Funktioniert direkt!
 */
export async function streamTextSafe(
  params: Omit<Parameters<typeof streamText>[0], 'model'>
): Promise<EnhancedStreamResult> {
  
  const models = AI_CONFIG.models;
  const statusMap: Record<number, ModelStatus> = {
    0: 'primary',
    1: 'fallback', 
    2: 'lastResort'
  };
  
  let lastError: Error | null = null;

  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    const status = statusMap[i] || 'lastResort';
    
    try {
      // Logging nur bei Fallback
      if (i === 0) {
        console.log(`🤖 AI-Manager: Starte mit ${modelName}`);
      } else {
        console.log(`🔄 AI-Manager: Fallback auf ${modelName}...`);
      }
      
      const result = await streamText({
        ...params,
        model: google(modelName),
      } as any);

      // Erfolg!
      if (i > 0) {
        console.log(`✅ AI-Manager: ${modelName} erfolgreich (nach ${i} Fallback${i > 1 ? 's' : ''})`);
      }
      
      // Füge Metadata zum Result hinzu (für optionales Tracking)
      // Cast über unknown nötig, da wir Properties zu einem bestehenden Objekt hinzufügen
      const enhancedResult = result as unknown as EnhancedStreamResult;
      enhancedResult._modelName = modelName;
      enhancedResult._status = status;
      
      return enhancedResult;
      
    } catch (error) {
      lastError = error as Error;
      const errorType = getErrorType(error);
      
      // Detailliertes Logging
      if (errorType === 'rateLimit') {
        console.warn(`⏳ AI-Manager: Rate Limit bei ${modelName}`);
      } else if (errorType === 'serverError') {
        console.warn(`🔥 AI-Manager: Server Error bei ${modelName}`);
      } else {
        console.warn(`⚠️ AI-Manager: ${modelName} fehlgeschlagen:`, error);
      }
    }
  }

  // Alle Modelle fehlgeschlagen
  const finalError = new Error(
    `Alle AI-Modelle fehlgeschlagen (${models.join(' → ')}). ` +
    `Letzter Fehler: ${lastError?.message || 'Unbekannt'}`
  );
  
  console.error('❌ AI-Manager: Alle Modelle erschöpft!', finalError);
  throw finalError;
}

// ============================================================================
// CONVENIENCE: Response mit Headers erstellen
// ============================================================================

/**
 * Erstellt eine Text Stream Response mit AI-Status-Headers
 * Optional - kann verwendet werden, um Model-Info im Response-Header zu haben
 * 
 * @example
 * const result = await streamTextSafe({ prompt: '...' });
 * return createAIStreamResponse(result);
 */
export function createAIStreamResponse(
  result: EnhancedStreamResult,
  additionalHeaders?: Record<string, string>
): Response {
  return result.toTextStreamResponse({
    headers: {
      'X-AI-Model': result._modelName || 'unknown',
      'X-AI-Status': result._status || 'unknown',
      ...additionalHeaders,
    },
  });
}
