// Reine Umrechnung von Vercel-Web-Analytics-Zeilen in die Dashboard-Strukturen,
// die sonst aus GA4 kommen. Ohne Netzwerk, damit sie testbar bleiben.

import type { ChartPoint } from '../../types/dashboard';
import type { AiTrafficData } from '../../types/ai-traffic';
import type { ChartEntry, ConvertingPageData } from '../dashboard-shared';
import { normalizeSource } from '../ai-sources.ts';
import type { AggregateRow } from './client';

/** Referrer-Hosts von KI-Assistenten (ohne Pfad-Einträge wie bing.com/chat). */
export const AI_REFERRER_HOSTS = [
  'chatgpt.com', 'chat.openai.com', 'openai.com',
  'claude.ai', 'anthropic.com',
  'gemini.google.com', 'bard.google.com',
  'perplexity.ai', 'www.perplexity.ai',
  'deepseek.com', 'chat.deepseek.com',
  'grok.com', 'x.ai',
  'copilot.microsoft.com',
  'you.com', 'poe.com', 'character.ai',
];

const PAID_MEDIUMS = ['cpc', 'ppc', 'paid', 'paidsearch', 'paid_search', 'paid-search', 'sem'];
const EMAIL_MEDIUMS = ['email', 'e-mail', 'newsletter'];
const SEARCH_HOST_PATTERN = /(^|\.)(google|bing|duckduckgo|ecosia|yahoo|startpage|qwant|yandex|baidu)\.|^search\.brave\.com$/;
const SOCIAL_HOST_PATTERN = /(^|\.)(facebook|instagram|linkedin|lnkd|twitter|youtube|pinterest|tiktok|reddit|xing|threads|bsky)\.|^t\.co$|^x\.com$|^l\.facebook\.com$/;

/** Vercel fasst bei begrenzter Ergebnismenge den Rest als "Others" zusammen. */
export function isOthersGroup(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'others';
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isAiReferrer(host: string): boolean {
  const normalized = text(host).replace(/^www\./, '');
  return AI_REFERRER_HOSTS.some((candidate) => normalized === candidate.replace(/^www\./, ''));
}

export function isPaidMedium(medium: string): boolean {
  return PAID_MEDIUMS.includes(text(medium));
}

/** Kanal im Stil der GA4-Default-Channel-Group, damit bestehende Widgets passen. */
export function classifyChannel(referrerHost: unknown, utmMedium: unknown): string {
  const host = text(referrerHost);
  const medium = text(utmMedium);
  if (isPaidMedium(medium)) return 'Paid Search';
  if (EMAIL_MEDIUMS.includes(medium)) return 'Email';
  if (host && isAiReferrer(host)) return 'AI Assistant';
  if (!host) return 'Direct';
  if (SEARCH_HOST_PATTERN.test(host)) return 'Organic Search';
  if (SOCIAL_HOST_PATTERN.test(host)) return 'Organic Social';
  return 'Referral';
}

/** OData-Filter für eine Liste von Werten einer Dimension. */
export function buildInFilter(dimension: string, values: string[]): string {
  const quoted = values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');
  return `${dimension} in (${quoted})`;
}

export const AI_REFERRER_FILTER = buildInFilter('referrerHostname', AI_REFERRER_HOSTS);

export function toDailyPoints(rows: AggregateRow[], field: 'visitors' | 'pageviews' | 'count'): ChartPoint[] {
  const byDay = new Map<number, number>();
  for (const row of rows) {
    const date = row.timestamp ? Date.parse(String(row.timestamp)) : NaN;
    if (!Number.isFinite(date)) continue;
    byDay.set(date, (byDay.get(date) ?? 0) + num(row[field]));
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a - b)
    .map(([date, value]) => ({ date, value }));
}

function withChartColors(entries: Array<{ name: string; value: number }>): ChartEntry[] {
  return entries
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((entry, index) => ({ ...entry, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
}

export function buildChannels(rows: AggregateRow[]): ChartEntry[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const channel = classifyChannel(row.referrerHostname, row.utmMedium);
    totals.set(channel, (totals.get(channel) ?? 0) + num(row.visitors));
  }
  return withChartColors(Array.from(totals, ([name, value]) => ({ name, value })));
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['de'], { type: 'region' });
  } catch {
    return null;
  }
})();

export function countryName(code: unknown): string {
  const raw = typeof code === 'string' ? code.trim() : '';
  if (!raw) return '(unbekannt)';
  if (isOthersGroup(raw)) return 'Sonstige';
  if (/^[A-Za-z]{2}$/.test(raw)) {
    try {
      return regionNames?.of(raw.toUpperCase()) ?? raw.toUpperCase();
    } catch {
      return raw.toUpperCase();
    }
  }
  return raw;
}

export function buildDimension(rows: AggregateRow[], dimension: string, label: (value: unknown) => string): ChartEntry[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const name = label(row[dimension]);
    totals.set(name, (totals.get(name) ?? 0) + num(row.visitors));
  }
  return withChartColors(Array.from(totals, ([name, value]) => ({ name, value })));
}

export function deviceName(value: unknown): string {
  const name = text(value);
  if (isOthersGroup(name)) return 'Sonstige';
  return name || '(unbekannt)';
}

export function buildAiTraffic(
  sourceRows: AggregateRow[],
  trendRows: AggregateRow[],
  previousVisitors: number | null,
): AiTrafficData {
  const bySource = new Map<string, number>();
  for (const row of sourceRows) {
    const host = text(row.referrerHostname);
    if (!host || !isAiReferrer(host)) continue;
    const source = normalizeSource(host);
    bySource.set(source, (bySource.get(source) ?? 0) + num(row.visitors));
  }
  const total = Array.from(bySource.values()).reduce((sum, value) => sum + value, 0);
  const change = previousVisitors === null
    ? undefined
    : previousVisitors > 0 ? ((total - previousVisitors) / previousVisitors) * 100 : total > 0 ? 100 : 0;
  return {
    totalSessions: total,
    totalUsers: total,
    totalSessionsChange: change,
    totalUsersChange: change,
    sessionsBySource: Object.fromEntries(bySource),
    topAiSources: Array.from(bySource, ([source, visitors]) => ({
      source,
      sessions: visitors,
      users: visitors,
      percentage: total > 0 ? (visitors / total) * 100 : 0,
    })).sort((a, b) => b.sessions - a.sessions),
    trend: toDailyPoints(trendRows, 'visitors').map((point) => ({ date: point.date, sessions: point.value })),
  };
}

export function buildLandingPages(
  pageRows: AggregateRow[],
  conversionRows: AggregateRow[],
): ConvertingPageData[] {
  const conversionsByPath = new Map<string, number>();
  for (const row of conversionRows) {
    const path = typeof row.requestPath === 'string' ? row.requestPath : '';
    if (path) conversionsByPath.set(path, (conversionsByPath.get(path) ?? 0) + num(row.count));
  }
  return pageRows
    .filter((row) => typeof row.requestPath === 'string' && row.requestPath.startsWith('/') && num(row.visitors) > 0)
    .map((row) => {
      const path = String(row.requestPath);
      const visitors = num(row.visitors);
      const conversions = conversionsByPath.get(path) ?? 0;
      return {
        path,
        sessions: visitors,
        conversions,
        conversionRate: visitors > 0 ? Number(((conversions / visitors) * 100).toFixed(2)) : 0,
      };
    });
}

export function sumField(rows: AggregateRow[], field: 'visitors' | 'pageviews' | 'count'): number {
  return rows.reduce((sum, row) => sum + num(row[field]), 0);
}
