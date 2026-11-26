// Schlanker Client für die Vercel Web Analytics REST-API
// (https://vercel.com/docs/rest-api/web-analytics).

import { requestBudgetOptions } from '../sync/request-budget.ts';

const API_BASE = 'https://api.vercel.com/v1/query/web-analytics';
const REQUEST_TIMEOUT_MS = 20_000;

export interface VercelAnalyticsTarget {
  projectId: string;
  /** Team-ID (team_…) oder Team-Slug; leer = VERCEL_ANALYTICS_TEAM_ID. */
  teamId?: string | null;
}

export interface VisitsCount {
  visitors: number;
  pageviews: number;
}

export type AggregateRow = Record<string, string | number | null | undefined> & {
  timestamp?: string;
  visitors?: number;
  pageviews?: number;
  count?: number;
};

export class VercelAnalyticsError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'VercelAnalyticsError';
    this.status = status;
  }
}

/**
 * Meldungen enthalten die Stichworte, nach denen classifyGoogleApiError
 * einstuft (rate limit / network / forbidden …). So schützt dieselbe Logik wie
 * bei GA4 einen guten Snapshot vor einem vorübergehenden Fehler.
 */
export function describeVercelAnalyticsStatus(status: number, body: string): string {
  const detail = body.replace(/\s+/g, ' ').trim().slice(0, 160);
  if (status === 429) return `Vercel Analytics: rate limit erreicht (HTTP 429)`;
  if (status >= 500) return `Vercel Analytics vorübergehend nicht erreichbar (network, HTTP ${status})`;
  if (status === 401) return 'Vercel Analytics: unauthorized – Token ungültig oder abgelaufen (HTTP 401)';
  if (status === 403) return 'Vercel Analytics: forbidden – Token hat keinen Zugriff auf dieses Projekt oder Team (HTTP 403)';
  if (status === 404) return 'Vercel Analytics: Projekt not found oder Web Analytics nicht aktiviert (HTTP 404)';
  return `Vercel Analytics: invalid argument (HTTP ${status})${detail ? ` – ${detail}` : ''}`;
}

function getToken(): string {
  const token = process.env.VERCEL_ANALYTICS_TOKEN?.trim();
  if (!token) {
    throw new VercelAnalyticsError(
      'Vercel Analytics: unauthorized – VERCEL_ANALYTICS_TOKEN ist nicht gesetzt',
      null,
    );
  }
  return token;
}

function teamParams(target: VercelAnalyticsTarget): Record<string, string> {
  const team = target.teamId?.trim() || process.env.VERCEL_ANALYTICS_TEAM_ID?.trim();
  if (!team) return {};
  return team.startsWith('team_') ? { teamId: team } : { slug: team };
}

async function request<T>(
  path: string,
  target: VercelAnalyticsTarget,
  params: Record<string, string | string[] | undefined>,
): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`);
  url.searchParams.set('projectId', target.projectId);
  for (const [key, value] of Object.entries({ ...teamParams(target), ...params })) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, item);
  }

  const budget = requestBudgetOptions();
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = budget.signal ? AbortSignal.any([budget.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${getToken()}` },
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if (error instanceof VercelAnalyticsError) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new VercelAnalyticsError(`Vercel Analytics: network timeout oder Verbindungsfehler (${reason})`, null);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    // Projekt und Team in der Meldung: ein 404 entsteht meist durch falsches Projekt oder fehlendes Team.
    const team = target.teamId?.trim() || process.env.VERCEL_ANALYTICS_TEAM_ID?.trim() || 'kein Team gesetzt';
    throw new VercelAnalyticsError(
      `${describeVercelAnalyticsStatus(response.status, body)} [Projekt: ${target.projectId}, Team: ${team}]`,
      response.status,
    );
  }
  const payload = await response.json() as { data?: T };
  return (payload.data ?? ([] as unknown as T));
}

export interface QueryRange {
  /** YYYY-MM-DD, inklusive */
  since: string;
  /** YYYY-MM-DD, inklusive */
  until: string;
}

// Die API rundet das Ende je Endpunkt unterschiedlich (geprüft am 26.11.2026):
// count rundet auf den Tagesbeginn ab, aggregate auf den nächsten Tag auf.
// Beide Varianten schließen so genau den letzten Tag ein, aber nicht heute.
function countRange(range: QueryRange) {
  const next = new Date(`${range.until}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { since: `${range.since}T00:00:00.000Z`, until: next.toISOString() };
}

function aggregateRange(range: QueryRange) {
  return { since: `${range.since}T00:00:00.000Z`, until: `${range.until}T23:59:59.999Z` };
}

export function countVisits(target: VercelAnalyticsTarget, range: QueryRange, filter?: string) {
  return request<VisitsCount>('visits/count', target, { ...countRange(range), filter });
}

export function aggregateVisits(
  target: VercelAnalyticsTarget,
  range: QueryRange,
  by: string[],
  options: { filter?: string; limit?: number } = {},
) {
  return request<AggregateRow[]>('visits/aggregate', target, {
    ...aggregateRange(range),
    by,
    filter: options.filter,
    limit: options.limit ? String(options.limit) : undefined,
  });
}

export function aggregateEvents(
  target: VercelAnalyticsTarget,
  range: QueryRange,
  by: string[],
  options: { filter?: string; limit?: number } = {},
) {
  return request<AggregateRow[]>('events/aggregate', target, {
    ...aggregateRange(range),
    by,
    filter: options.filter,
    limit: options.limit ? String(options.limit) : undefined,
  });
}
