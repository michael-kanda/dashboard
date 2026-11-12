import type { analyticsdata_v1beta } from 'googleapis';
import { sql } from '@vercel/postgres';
import { requestBudgetOptions } from '../sync/request-budget';
import { getGa4PropertyLockKeyFromCacheKey, releaseGa4RequestLock, tryAcquireGa4RequestLock } from '@/lib/ga4-request-lock';
import { logger } from '@/lib/logger';

function vercelWaitUntil(task: Promise<unknown>): void {
  try {
    const ctx = (globalThis as any)[Symbol.for('@vercel/request-context')]?.get?.();
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(task);
    }
  } catch {
    // Best-Effort: Task läuft als fire-and-forget weiter.
  }
}

const GA4_RESULT_CACHE_TTL_MS = 30 * 60 * 1000;

const GA4_RESULT_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const ga4RefreshesInFlight = new Set<string>();

function scheduleGa4BackgroundRefresh<T>(cacheKey: string, fetcher: () => Promise<T>): void {
  const lockKey = getGa4PropertyLockKeyFromCacheKey(cacheKey);
  if (ga4RefreshesInFlight.has(lockKey)) return;
  ga4RefreshesInFlight.add(lockKey);
  const task = (async () => {
    const lock = await tryAcquireGa4RequestLock(lockKey);
    if (!lock) {
      logger.debug(`[GA4 Lock] Hintergrund-Refresh übersprungen, bereits aktiv: ${lockKey}`);
      ga4RefreshesInFlight.delete(lockKey);
      return;
    }

    try {
      const fresh = await fetcher();
      await writeGa4ResultCache(cacheKey, fresh);
      logger.debug(`[GA4 Cache] Hintergrund-Refresh OK: ${cacheKey}`);
    } catch (err) {
      console.warn(
        `[GA4 Cache] Hintergrund-Refresh fehlgeschlagen (${cacheKey}):`,
        err instanceof Error ? err.message : err
      );
    } finally {
      await releaseGa4RequestLock(lock);
      ga4RefreshesInFlight.delete(lockKey);
    }
  })();
  // Hält die Function nach der Response am Leben, bis der Refresh fertig ist
  // (auf Vercel); sonst Best-Effort fire-and-forget.
  vercelWaitUntil(task);
}

async function waitForGa4ResultCache<T>(cacheKey: string, maxWaitMs = 8000): Promise<T | null> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const cached = await readGa4ResultCache(cacheKey);
    if (cached) return cached.payload as T;
  }

  return null;
}

export async function withGa4ResultCache<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = await readGa4ResultCache(cacheKey);

  // 1) Frisch -> direkt raus.
  if (cached && cached.ageMs < GA4_RESULT_CACHE_TTL_MS) {
    return cached.payload as T;
  }

  // 2) Stale, aber brauchbar -> sofort ausliefern, Refresh im Hintergrund.
  if (cached && cached.ageMs < GA4_RESULT_CACHE_MAX_AGE_MS) {
    scheduleGa4BackgroundRefresh(cacheKey, fetcher);
    return cached.payload as T;
  }

  // 3) Kein brauchbarer Cache -> synchron laden (Erstaufruf, kann dauern).
  const lockKey = `ga4-cache:${cacheKey}`;
  const lock = await tryAcquireGa4RequestLock(lockKey);
  if (!lock) {
    const filledCache = await waitForGa4ResultCache<T>(cacheKey);
    if (filledCache) return filledCache;
    throw new Error(`[GA4 Lock] Refresh läuft bereits für ${lockKey}; noch kein Cache für ${cacheKey}`);
  }

  try {
    const fresh = await fetcher();
    await writeGa4ResultCache(cacheKey, fresh);
    return fresh;
  } catch (error) {
    if (cached) {
      console.warn(
        `[GA4 Cache] Frischer Load fehlgeschlagen — liefere Stale-Cache (${Math.round(cached.ageMs / 60000)} Min alt) für ${cacheKey}:`,
        error instanceof Error ? error.message : error
      );
      return cached.payload as T;
    }
    // SELBSTHEILUNG: Auch ohne Cache einen Hintergrund-Refresh anstoßen.
    // Sonst entsteht ein Henne-Ei-Problem: Scheitert der Erstaufruf immer
    // wieder (sehr langsame Property), füllt sich der Cache nie und JEDER
    // Aufruf bleibt ein scheiternder "Erstaufruf". Der Hintergrundversuch
    // läuft nach der Response weiter und befüllt den Cache für das nächste
    // Mal. Ausnahme: Quota-Fehler — da würde ein sofortiger Retry nur
    // weitere Tokens verbrennen.
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
    const isQuotaError = msg.includes('quota') || msg.includes('resource_exhausted');
    const isAbortError = msg.includes('aborted') || (error as any)?.error?.type === 'aborted' || (error as any)?.cause?.type === 'aborted';
    if (!isQuotaError && !isAbortError) {
      console.warn(`[GA4 Cache] Erstaufruf fehlgeschlagen — starte Selbstheilungs-Refresh für ${cacheKey}`);
      scheduleGa4BackgroundRefresh(cacheKey, fetcher);
    }
    throw error;
  } finally {
    await releaseGa4RequestLock(lock);
  }
}

async function readGa4ResultCache(cacheKey: string): Promise<{ payload: any; ageMs: number } | null> {
  try {
    const { rows } = await sql`
      SELECT payload, created_at FROM ga4_ai_traffic_cache WHERE cache_key = ${cacheKey}
    `;
    if (rows.length === 0) return null;
    return {
      payload: rows[0].payload,
      ageMs: Date.now() - new Date(rows[0].created_at).getTime(),
    };
  } catch (err) {
    console.warn('[GA4 Cache] Lookup fehlgeschlagen:', err);
    return null;
  }
}

async function writeGa4ResultCache(cacheKey: string, payload: any): Promise<void> {
  try {
    await sql`
      INSERT INTO ga4_ai_traffic_cache (cache_key, payload, created_at)
      VALUES (${cacheKey}, ${JSON.stringify(payload)}::jsonb, now())
      ON CONFLICT (cache_key)
      DO UPDATE SET payload = EXCLUDED.payload, created_at = EXCLUDED.created_at
    `;
  } catch (err) {
    console.warn('[GA4 Cache] Schreiben fehlgeschlagen:', err);
  }
}

export const GA4_MAX_CONCURRENT = 3;

export const GA4_TIMEOUT_MS = 55_000;

export const GA4_CALL_BUDGET_MS = 60_000;

const GA4_MIN_TIMEOUT_MS = 5_000;

let ga4ActiveSlots = 0;

const ga4SlotQueue: Array<() => void> = [];

function acquireGa4Slot(): Promise<void> {
  if (ga4ActiveSlots < GA4_MAX_CONCURRENT) {
    ga4ActiveSlots++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => ga4SlotQueue.push(resolve));
}

function releaseGa4Slot(): void {
  const next = ga4SlotQueue.shift();
  if (next) {
    // Slot direkt an den nächsten Wartenden weitergeben (Zähler bleibt gleich).
    next();
  } else {
    ga4ActiveSlots--;
  }
}

export function isGa4AbortError(error: unknown): boolean {
  const err = error as any;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.toLowerCase().includes('aborted') ||
    err?.error?.type === 'aborted' ||
    err?.cause?.type === 'aborted' ||
    err?.config?.signal?.aborted === true
  );
}

export function getShortGoogleError(error: unknown): string {
  const err = error as any;
  return (
    err?.cause?.message ||
    err?.response?.data?.error?.message ||
    (error instanceof Error ? error.message : String(error))
  );
}

const GA4_REQUEST_OPTIONS = {
  retryConfig: {
    retry: 1,
    retryDelay: 500,
    httpMethodsToRetry: ['POST'],
    statusCodesToRetry: [[408, 408]],
    noResponseRetries: 1,
  },
};

export async function ga4RunReport(
  analytics: analyticsdata_v1beta.Analyticsdata,
  request: analyticsdata_v1beta.Params$Resource$Properties$Runreport
): Promise<{ data: analyticsdata_v1beta.Schema$RunReportResponse }> {
  const enqueuedAt = Date.now();
  requestBudgetOptions();
  await acquireGa4Slot();
  try {
    const remainingMs = GA4_CALL_BUDGET_MS - (Date.now() - enqueuedAt);
    if (remainingMs < GA4_MIN_TIMEOUT_MS) {
      // Fail-Fast: lieber dieser eine Report leer als die ganze Function in
      // den Vercel-Runtime-Timeout. Caller fangen das per try/catch /
      // allSettled ab und degradieren das betroffene Widget.
      throw new Error(
        `[GA4] Zeitbudget erschöpft (${Math.round((Date.now() - enqueuedAt) / 1000)}s in Warteschlange) — Report übersprungen.`
      );
    }
    const timeout = Math.min(GA4_TIMEOUT_MS, remainingMs);
    return (await analytics.properties.runReport(
      request,
      { ...GA4_REQUEST_OPTIONS, timeout, ...requestBudgetOptions() } as any
    )) as unknown as { data: analyticsdata_v1beta.Schema$RunReportResponse };
  } finally {
    releaseGa4Slot();
  }
}
