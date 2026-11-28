// src/lib/http-get.ts
// Schlanker Ersatz für axios.get mit fetch (Semrush, Bing). Verhalten wie bisher mit axios:
// - Query-Parameter werden an die URL gehängt
// - Zeitlimit in Millisekunden, zusätzlich ein optionales AbortSignal (z. B. Zeitbudget der Synchronisierung)
// - Antwort als JSON, wenn sie sich als JSON lesen lässt, sonst als Text
// - HTTP-Status außerhalb von 2xx wirft HttpError mit status und data (wie error.response bei axios)

export class HttpError extends Error {
  readonly status: number;
  readonly data: unknown;
  /** Gleiche Form wie bei axios, damit errorFields() in src/lib/errors.ts weiter greift. */
  readonly response: { status: number; data: unknown };

  constructor(status: number, data: unknown, url: string) {
    super(`HTTP ${status} bei ${new URL(url).origin}${new URL(url).pathname}`);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
    this.response = { status, data };
  }
}

export interface HttpGetOptions {
  params?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export function buildUrl(url: string, params?: HttpGetOptions['params']): string {
  if (!params) return url;
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) target.searchParams.set(key, String(value));
  }
  return target.toString();
}

export function parseBody(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return text;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return text;
    }
  }
  return text;
}

export async function httpGet<T = unknown>(url: string, options: HttpGetOptions = {}): Promise<{ status: number; data: T }> {
  const target = buildUrl(url, options.params);
  const signals = [options.signal, options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined]
    .filter((signal): signal is AbortSignal => Boolean(signal));
  const response = await fetch(target, {
    method: 'GET',
    headers: options.headers,
    signal: signals.length > 1 ? AbortSignal.any(signals) : signals[0],
    cache: 'no-store',
  });
  const data = parseBody(await response.text());
  if (!response.ok) throw new HttpError(response.status, data, target);
  return { status: response.status, data: data as T };
}
