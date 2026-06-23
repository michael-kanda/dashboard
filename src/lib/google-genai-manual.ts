import type { GoogleGenAiPerformanceData, GoogleGenAiBreakdownItem } from '@/lib/dashboard-shared';
import { GOOGLE_GENAI_DATA_VERSION } from '@/lib/google-api';

interface ManualGenAiInput {
  totalImpressions?: number | string;
  impressions?: number | string;
  startDate?: string;
  endDate?: string;
  dateRange?: string;
  importedAt?: string;
  trend?: Array<{ date?: string | number; key?: string; impressions?: number | string }>;
  topPages?: Array<{ key?: string; page?: string; url?: string; impressions?: number | string }>;
  countries?: Array<{ key?: string; country?: string; impressions?: number | string }>;
  devices?: Array<{ key?: string; device?: string; impressions?: number | string }>;
  csv?: string;
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== 'string') return 0;
  const normalized = value
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function parseDate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return new Date(`${normalized}T00:00:00Z`).getTime();
  const germanMatch = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (germanMatch) {
    const [, day, month, rawYear] = germanMatch;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`).getTime();
  }
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeItems(
  items: ManualGenAiInput['topPages'],
  fallbackKey: 'page' | 'country' | 'device' = 'page',
): GoogleGenAiBreakdownItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const key = item.key || (item as any)[fallbackKey] || item.url || '';
      const impressions = parseNumber(item.impressions);
      return key && impressions > 0 ? { key, impressions } : null;
    })
    .filter((item): item is GoogleGenAiBreakdownItem => Boolean(item))
    .sort((a, b) => b.impressions - a.impressions);
}

function parseCsvRows(csv: string): { topPages: GoogleGenAiBreakdownItem[]; totalImpressions: number } {
  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(line.includes(';') ? ';' : ',').map((cell) => cell.trim().replace(/^"|"$/g, '')));

  const header = rows[0]?.map((cell) => cell.toLowerCase()) || [];
  const pageIndex = header.findIndex((cell) => ['seite', 'seiten', 'page', 'url'].some((needle) => cell.includes(needle)));
  const impressionsIndex = header.findIndex((cell) => cell.includes('impression') || cell.includes('impr'));
  if (pageIndex < 0 || impressionsIndex < 0) return { topPages: [], totalImpressions: 0 };

  const topPages = rows.slice(1)
    .map((row) => ({
      key: row[pageIndex],
      impressions: parseNumber(row[impressionsIndex]),
    }))
    .filter((item) => item.key && item.impressions > 0)
    .sort((a, b) => b.impressions - a.impressions);

  return {
    topPages,
    totalImpressions: topPages.reduce((sum, item) => sum + item.impressions, 0),
  };
}

export function normalizeManualGoogleGenAiData(raw: unknown): GoogleGenAiPerformanceData | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as ManualGenAiInput;
  const csvParsed = typeof input.csv === 'string' ? parseCsvRows(input.csv) : { topPages: [], totalImpressions: 0 };
  const topPages = normalizeItems(input.topPages).length > 0
    ? normalizeItems(input.topPages)
    : csvParsed.topPages;
  const countries = normalizeItems(input.countries as any, 'country');
  const devices = normalizeItems(input.devices as any, 'device');
  const trend = Array.isArray(input.trend)
    ? input.trend
      .map((point) => {
        const date = parseDate(point.date || point.key);
        const impressions = parseNumber(point.impressions);
        return date && impressions > 0 ? { date, impressions } : null;
      })
      .filter((point): point is { date: number; impressions: number } => Boolean(point))
      .sort((a, b) => a.date - b.date)
    : [];

  const explicitTotal = parseNumber(input.totalImpressions ?? input.impressions);
  const totalImpressions = explicitTotal || trend.reduce((sum, point) => sum + point.impressions, 0) || csvParsed.totalImpressions;
  if (totalImpressions <= 0) return null;

  const dateRange = input.dateRange || [input.startDate, input.endDate].filter(Boolean).join(' - ');

  return {
    status: 'available',
    message: 'Google-GenAI-Daten aus manuellem Search-Console-Export, weil die Search Analytics API fuer diese Property noch keine GenAI-Search-Appearance liefert.',
    totalImpressions,
    trend,
    topPages: topPages.slice(0, 10),
    countries: countries.slice(0, 10),
    devices: devices.slice(0, 10),
    detectedAppearances: ['GSC Export'],
    source: 'gsc-manual-export',
    dataVersion: GOOGLE_GENAI_DATA_VERSION,
    manualSource: {
      importedAt: input.importedAt || new Date().toISOString(),
      dateRange: dateRange || undefined,
    },
  };
}
