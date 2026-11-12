import { GA4_MAX_CONCURRENT, GA4_TIMEOUT_MS, GA4_CALL_BUDGET_MS } from './ga4-runtime';
import { google } from 'googleapis';
import { requestBudgetOptions } from '../sync/request-budget';
import { createGoogleAuth, GOOGLE_SCOPES } from '@/lib/google-auth';
import { logger } from '@/lib/logger';
import { errorFields } from '@/lib/errors';

google.options({
  retry: true,
  retryConfig: {
    retry: 1,
    retryDelay: 500,
    httpMethodsToRetry: ['GET', 'HEAD', 'PUT', 'OPTIONS', 'DELETE', 'POST'],
    statusCodesToRetry: [[100, 199], [500, 599]],
    // Echte Netzwerkfehler (ECONNRESET etc.) einmal wiederholen — die schlagen
    // schnell fehl und kosten kein Zeitbudget. Timeout-Aborts retried gaxios
    // ohnehin nicht (siehe oben).
    noResponseRetries: 1,
    onRetryAttempt: (err) => {
      const code = err?.response?.status ?? err?.code ?? errorFields(err).error?.type ?? 'no-response';
      const attempt = err?.config?.retryConfig?.currentRetryAttempt ?? '?';
      console.warn(`[Google API] Retry nach ${code} (Versuch ${attempt})`);
    },
  },
  // Per-Versuch-Timeout (Timeouts werden nicht retried, s.o.). 30 s statt der
  // alten 20 s — genug Luft für schwere Reports, aber klein genug, dass
  // mehrere (teils wartende) Calls zusammen nicht die 60-s-Function-Wall-Time
  // sprengen. GA4-Calls bekommen unten zusätzlich ein hartes Gesamtbudget
  // pro Call (Wartezeit + Request) über ga4RunReport.
  timeout: 30_000,
});

logger.debug(
  `[google-api] GA4-Layer v4 aktiv (Timeout ${GA4_TIMEOUT_MS / 1000}s, ` +
  `Call-Budget ${GA4_CALL_BUDGET_MS / 1000}s, ${GA4_MAX_CONCURRENT} Slots, ` +
  `Cache+SWR+Selbstheilung inkl. Dimension-Reports)`
);

export function createAuth() {
  requestBudgetOptions();
  return createGoogleAuth([
    GOOGLE_SCOPES.searchConsole,
    GOOGLE_SCOPES.analytics,
    GOOGLE_SCOPES.sheets,
  ]);
}
