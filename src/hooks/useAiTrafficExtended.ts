// src/hooks/useAiTrafficExtended.ts
'use client';

import { useEffect, useState, useCallback } from 'react';
import type { AiTrafficExtendedData } from '@/lib/ai-traffic-extended-v2';

/**
 * Geteilter Hook für KI-Traffic Detail-Daten.
 * - Module-Level-Cache pro (projectId, dateRange) verhindert Doppel-Fetch,
 *   wenn AiTrafficCard und AiTrafficModelTrendChart parallel geladen sind.
 * - Pending-Promises werden geteilt: zweiter Aufruf bekommt das laufende Promise.
 */

interface CacheEntry {
  data?: AiTrafficExtendedData | null;
  promise?: Promise<AiTrafficExtendedData | null | undefined>;
  error?: string;
  timestamp: number;
  retryAfterMs?: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 1 min — selber Visit, gleicher Filter → kein Refetch
const QUOTA_CACHE_TTL_MS = 55 * 60 * 1000;

function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error) {
    return error.name === 'AbortError' || error.message.toLowerCase().includes('aborted');
  }
  return false;
}

function cacheKey(projectId: string | undefined, dateRange: string): string {
  return `${projectId ?? 'default'}::${dateRange}`;
}

async function fetchExtended(projectId: string | undefined, dateRange: string): Promise<AiTrafficExtendedData | null | undefined> {
  const params = new URLSearchParams({ dateRange });
  if (projectId) params.set('projectId', projectId);
  const response = await fetch(`/api/ai-traffic-detail-v2?${params.toString()}`);

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error(`Server lieferte kein JSON (Status: ${response.status})`);
  }
  const result = await response.json();
  if (result?.quotaLimited) {
    return null;
  }
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result.data || undefined;
}

export function useAiTrafficExtended(projectId: string | undefined, dateRange: string) {
  const [data, setData] = useState<AiTrafficExtendedData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async (force = false) => {
    if (!projectId) {
      setData(undefined);
      setError(undefined);
      setIsLoading(false);
      return;
    }

    const key = cacheKey(projectId, dateRange);
    const cached = cache.get(key);
    const now = Date.now();

    // Frischer Cache → sofort liefern, kein Fetch
    if (!force && cached?.data !== undefined && now - cached.timestamp < CACHE_TTL_MS) {
      setData(cached.data || undefined);
      setError(undefined);
      setIsLoading(false);
      return;
    }

    if (!force && cached?.retryAfterMs && now - cached.timestamp < Math.max(cached.retryAfterMs, QUOTA_CACHE_TTL_MS)) {
      setData(undefined);
      setError(undefined);
      setIsLoading(false);
      return;
    }

    // Laufender Fetch → an Promise hängen
    if (!force && cached?.promise) {
      setIsLoading(true);
      try {
        const result = await cached.promise;
        setData(result || undefined);
        setError(undefined);
      } catch (err) {
        if (isAbortError(err)) return;
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Frischer Fetch
    setIsLoading(true);
    setError(undefined);
    const promise = fetchExtended(projectId, dateRange);
    cache.set(key, { promise, timestamp: now });

    try {
      const result = await promise;
      const cacheEntry: CacheEntry = { timestamp: Date.now() };
      if (result !== undefined) cacheEntry.data = result;
      if (result === null) cacheEntry.retryAfterMs = QUOTA_CACHE_TTL_MS;
      cache.set(key, cacheEntry);
      setData(result || undefined);
      setError(undefined);
    } catch (err) {
      if (isAbortError(err)) {
        cache.delete(key);
        return;
      }
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      cache.set(key, { error: msg, timestamp: Date.now() });
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, dateRange]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, isLoading, error, refresh: () => load(true) };
}
