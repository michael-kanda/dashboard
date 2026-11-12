// src/lib/logger.ts
//
// Schlanker Logger mit Log-Level. Gibt ueber die console-Methoden aus, damit
// Vercel-Logs und Sentry unveraendert funktionieren.
//
// Schwelle:
//   - Server: LOG_LEVEL, im Browser: NEXT_PUBLIC_LOG_LEVEL (debug | info | warn | error | silent)
//   - Standard: in Produktion "info", sonst "debug"
//
// debug-Ausgaben (frueher console.log fuer Ablauf-Traces) erscheinen damit in
// Produktion nur noch, wenn LOG_LEVEL=debug gesetzt ist.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

function isLogLevel(value: string): value is LogLevel {
  return Object.prototype.hasOwnProperty.call(ORDER, value);
}

export function resolveLogLevel(
  configured: string | undefined,
  nodeEnv: string | undefined
): LogLevel {
  const normalized = configured?.trim().toLowerCase();
  if (normalized && isLogLevel(normalized)) return normalized;
  return nodeEnv === 'production' ? 'info' : 'debug';
}

function currentLevel(): LogLevel {
  if (typeof process === 'undefined') return 'info';
  const configured = typeof window === 'undefined'
    ? process.env.LOG_LEVEL
    : process.env.NEXT_PUBLIC_LOG_LEVEL;
  return resolveLogLevel(configured, process.env.NODE_ENV);
}

const threshold = ORDER[currentLevel()];

function enabled(level: Exclude<LogLevel, 'silent'>): boolean {
  return ORDER[level] >= threshold;
}

/* eslint-disable no-console -- einzige Stelle, die direkt auf console schreibt */
export const logger = {
  debug: (...args: unknown[]) => {
    if (enabled('debug')) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (enabled('info')) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (enabled('warn')) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (enabled('error')) console.error(...args);
  },
};
/* eslint-enable no-console */
