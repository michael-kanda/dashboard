// Vergleichsart der Kennzahlen: der direkt vorhergehende, gleich lange Zeitraum
// ("Vorperiode") oder derselbe Kalenderzeitraum ein Jahr früher ("Vorjahr").
// Reine Funktionen ohne Laufzeit-Imports, damit Tests sie direkt laden können.
import type { ChartPoint, KpiComparison, ProjectDashboardData } from './dashboard-shared.ts';

export type ComparisonMode = 'vorperiode' | 'vorjahr';

export const DEFAULT_COMPARISON_MODE: ComparisonMode = 'vorperiode';

export const COMPARISON_LABELS: Record<ComparisonMode, string> = {
  vorperiode: 'Vorperiode',
  vorjahr: 'Vorjahr',
};

/** Wert aus ?vergleich= übernehmen; alles Unbekannte bedeutet Vorperiode. */
export function parseComparisonMode(value?: string | string[] | null): ComparisonMode {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'vorjahr' ? 'vorjahr' : 'vorperiode';
}

// ════════════════════════════════════════════════════════════════════
// Datum
// ════════════════════════════════════════════════════════════════════

export interface DatePeriod {
  from: string;
  to: string;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function toIso(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function parseIso(value: string) {
  const match = ISO_DATE.exec(value);
  if (!match) throw new Error(`Ungültiges Datum: ${value}`);
  return { year: Number(match[1]), monthIndex: Number(match[2]) - 1, day: Number(match[3]) };
}

/**
 * Verschiebt ein Datum um ganze Monate, kalendergleich. Gibt es den Tag im Zielmonat
 * nicht (29. Februar, 31. eines kurzen Monats), gilt der letzte Tag des Zielmonats.
 */
export function shiftIsoDateByMonths(value: string, months: number): string {
  const { year, monthIndex, day } = parseIso(value);
  const target = new Date(Date.UTC(year, monthIndex + months, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth();
  return toIso(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

/** Kalendergleich um Jahre verschieben: 29.02.2024 → 28.02.2023, 31.03.2025 → 31.03.2024. */
export function shiftIsoDateByYears(value: string, years: number): string {
  return shiftIsoDateByMonths(value, years * 12);
}

function addIsoDays(value: string, days: number): string {
  const { year, monthIndex, day } = parseIso(value);
  return toIso(year, monthIndex, day + days);
}

/** Derselbe Zeitraum ein Jahr früher, Start und Ende jeweils kalendergleich. */
export function getYearOverYearPeriod(period: DatePeriod): DatePeriod {
  return {
    from: shiftIsoDateByYears(period.from, -1),
    to: shiftIsoDateByYears(period.to, -1),
  };
}

/** Direkt vorhergehender Zeitraum mit derselben Anzahl Tage. */
export function getPreviousPeriod(period: DatePeriod): DatePeriod {
  const days = countPeriodDays(period);
  const to = addIsoDays(period.from, -1);
  return { from: addIsoDays(to, -(days - 1)), to };
}

export function countPeriodDays(period: DatePeriod): number {
  const from = parseIso(period.from);
  const to = parseIso(period.to);
  const diff = Date.UTC(to.year, to.monthIndex, to.day) - Date.UTC(from.year, from.monthIndex, from.day);
  return Math.round(diff / DAY_MS) + 1;
}

/** Search Console hält Leistungsdaten 16 Monate vor. */
export const GSC_RETENTION_MONTHS = 16;
/** Sicherheitsabstand zur Grenze, damit der erste Tag nicht schon gelöscht ist. */
export const GSC_RETENTION_SAFETY_DAYS = 7;

/** Frühester Tag, für den Search Console noch sicher vollständige Daten liefert. */
export function getGscEarliestAvailableDate(today: string): string {
  return addIsoDays(shiftIsoDateByMonths(today, -GSC_RETENTION_MONTHS), GSC_RETENTION_SAFETY_DAYS);
}

export function isPeriodWithinGscRetention(period: DatePeriod, today: string): boolean {
  return period.from >= getGscEarliestAvailableDate(today);
}

// ════════════════════════════════════════════════════════════════════
// Vorjahresdaten im Snapshot
// ════════════════════════════════════════════════════════════════════

/** Kennzahlen mit Vorjahreswert. KI-Traffic, Google GenAI und Paid Search haben keinen. */
export const YOY_KPI_KEYS = [
  'clicks',
  'impressions',
  'sessions',
  'totalUsers',
  'newUsers',
  'conversions',
  'engagementRate',
  'bounceRate',
  'avgEngagementTime',
] as const;

export type YoyKpiKey = (typeof YOY_KPI_KEYS)[number];

const GSC_KPI_KEYS: ReadonlySet<string> = new Set(['clicks', 'impressions']);

export function getYoySource(key: YoyKpiKey): 'gsc' | 'web' {
  return GSC_KPI_KEYS.has(key) ? 'gsc' : 'web';
}

export type YoySourceStatus =
  | 'available'
  | 'out_of_range'
  | 'incomplete'
  | 'no_data'
  | 'error'
  | 'not_supported'
  | 'not_configured';

/** Wird erhöht, wenn sich Aufbau oder Berechnung des Vorjahresblocks ändern. */
export const YEAR_OVER_YEAR_VERSION = 1;

export interface YearOverYearData {
  version: number;
  /** Vorjahreszeitraum, kalendergleich zum Berichtszeitraum. */
  period: DatePeriod;
  fetchedAt: string;
  gsc: YoySourceStatus;
  /** GA4 oder Vercel Web Analytics. */
  web: YoySourceStatus;
  /** Abgefragte Quellen; ändern sie sich, wird der Block neu geladen. */
  sourceIds?: { gsc: string | null; web: string | null };
  /** Summen bzw. Raten des Vorjahres, in derselben Einheit wie kpis[...].value. */
  values: Partial<Record<YoyKpiKey, number>>;
  /** Tageswerte des Vorjahres mit ihren eigenen Datumswerten (Rohwerte wie charts). */
  charts: Partial<Record<YoyKpiKey, ChartPoint[]>>;
}

/** Wie viele Tage am Rand des Zeitraums ohne Daten noch als vollständig gelten. */
export const COVERAGE_TOLERANCE_DAYS = 7;

/**
 * Prüft, ob Tageswerte den Zeitraum abdecken. Beginnt die Messung erst mitten im
 * Vorjahreszeitraum (Property später angelegt, Website später in der Search Console),
 * wäre ein Vergleich verzerrt.
 */
export function assessCoverage(
  daily: ChartPoint[] | undefined,
  total: number,
  period: DatePeriod,
  toleranceDays = COVERAGE_TOLERANCE_DAYS,
): 'available' | 'incomplete' | 'no_data' {
  const withData = (daily ?? []).filter((point) => Number.isFinite(point.date) && point.value > 0);
  if (!(total > 0) || withData.length === 0) return 'no_data';
  const first = Math.min(...withData.map((point) => point.date));
  const last = Math.max(...withData.map((point) => point.date));
  const start = Date.parse(`${period.from}T00:00:00Z`);
  const end = Date.parse(`${period.to}T00:00:00Z`);
  // ±1 Tag Puffer für Zeitstempel in lokaler Zeit statt UTC.
  const tolerance = (toleranceDays + 1) * DAY_MS;
  if (first > start + tolerance || last < end - tolerance) return 'incomplete';
  return 'available';
}

const SOURCE_NAMES = { gsc: 'Search Console', web: 'Webanalyse' } as const;

/** Ehrlicher Hinweis, warum es keinen Vorjahreswert gibt. */
export function describeMissingYoy(
  status: YoySourceStatus | 'pending',
  source: 'gsc' | 'web',
): string {
  switch (status) {
    case 'pending':
      return 'Die Vorjahreswerte werden beim nächsten Datenabgleich geladen.';
    case 'out_of_range':
      return source === 'gsc'
        ? `Die Search Console speichert nur ${GSC_RETENTION_MONTHS} Monate. Der Vorjahreszeitraum liegt ganz oder teilweise davor.`
        : 'Der Vorjahreszeitraum liegt außerhalb der gespeicherten Daten.';
    case 'incomplete':
      return `Die ${SOURCE_NAMES[source]} hat nur für einen Teil des Vorjahreszeitraums Daten, etwa weil die Messung später begann. Ein Vergleich wäre verzerrt.`;
    case 'no_data':
      return `Die ${SOURCE_NAMES[source]} hat für den Vorjahreszeitraum keine Daten.`;
    case 'error':
      return 'Die Vorjahreswerte konnten nicht geladen werden. Der nächste Datenabgleich versucht es erneut.';
    case 'not_supported':
      return 'Vercel Web Analytics liefert keine Vorjahreswerte.';
    case 'not_configured':
      return `Die ${SOURCE_NAMES[source]} ist nicht verbunden.`;
    default:
      return '';
  }
}

// ════════════════════════════════════════════════════════════════════
// Vergleich anwenden
// ════════════════════════════════════════════════════════════════════

export interface DashboardComparison {
  mode: ComparisonMode;
  label: string;
  /** Vergleichszeitraum, soweit bekannt. */
  period?: DatePeriod;
  /** Hinweise für fehlende Vergleichswerte, je Quelle höchstens einer. */
  notices: string[];
  /** Vorjahres-Tageswerte, auf die Daten des Berichtszeitraums verschoben. */
  chartSeries: Partial<Record<YoyKpiKey, ChartPoint[]>>;
}

/** Veränderung in Prozent; ohne Vergleichswert über 0 gibt es keine. */
export function calculatePercentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Vorher-Wert der Vorperiode: gespeichert oder, bei älteren Snapshots, aus der Änderung zurückgerechnet. */
function previousPeriodValue(kpi: { value: number; change: number; previous?: number }): number | null {
  if (typeof kpi.previous === 'number' && Number.isFinite(kpi.previous)) return kpi.previous;
  if (!Number.isFinite(kpi.value) || !Number.isFinite(kpi.change)) return null;
  if (kpi.change === -100) return 0;
  return kpi.value / (1 + kpi.change / 100);
}

/**
 * Verschiebt Vorjahres-Tageswerte um ein Jahr nach vorne, damit sie im Verlauf
 * unter den passenden Tagen des Berichtszeitraums liegen. Fällt ein 29. Februar
 * auf den 28., bleibt der echte 28. stehen.
 */
export function shiftChartPointsByYears(points: ChartPoint[], years: number): ChartPoint[] {
  const byDate = new Map<number, ChartPoint>();
  const clampedPoints: ChartPoint[] = [];
  for (const point of points) {
    if (!Number.isFinite(point.date)) continue;
    const date = new Date(point.date);
    const iso = toIso(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    // Uhrzeit-Anteil erhalten (GA4-Zeitstempel sind lokale Mitternacht).
    const offset = point.date - Date.parse(`${iso}T00:00:00Z`);
    const shiftedIso = shiftIsoDateByYears(iso, years);
    const shifted = { date: Date.parse(`${shiftedIso}T00:00:00Z`) + offset, value: point.value };
    if (shiftedIso.slice(5) !== iso.slice(5)) clampedPoints.push(shifted);
    else byDate.set(shifted.date, shifted);
  }
  for (const point of clampedPoints) {
    if (!byDate.has(point.date)) byDate.set(point.date, point);
  }
  return Array.from(byDate.values()).sort((a, b) => a.date - b.date);
}

const KPI_LABELS: Record<YoyKpiKey, string> = {
  clicks: 'Klicks',
  impressions: 'Impressionen',
  sessions: 'Sitzungen',
  totalUsers: 'Besucher',
  newUsers: 'Neue Besucher',
  conversions: 'Conversions',
  engagementRate: 'Interaktionsrate',
  bounceRate: 'Absprungrate',
  avgEngagementTime: 'Verweildauer',
};

/**
 * Ergänzt jede Kennzahl um `comparison` (Vorher-Wert und Veränderung der gewählten
 * Vergleichsart) und das Dashboard um `comparison`. `change` bleibt die Veränderung
 * zur Vorperiode, damit Stellen ohne Umschalter korrekt beschriftet bleiben.
 */
export function applyComparisonMode(
  data: ProjectDashboardData,
  mode: ComparisonMode,
): ProjectDashboardData {
  const kpis = data.kpis;
  const reportingPeriod = data.reportingPeriod;

  if (mode === 'vorperiode') {
    const nextKpis = kpis
      ? Object.fromEntries(Object.entries(kpis).map(([key, kpi]) => {
          if (!kpi) return [key, kpi];
          const previous = previousPeriodValue(kpi);
          const comparison: KpiComparison = {
            mode,
            previous,
            change: Number.isFinite(kpi.change) ? kpi.change : null,
          };
          return [key, { ...kpi, comparison }];
        }))
      : undefined;
    return {
      ...data,
      kpis: nextKpis as ProjectDashboardData['kpis'],
      comparison: {
        mode,
        label: COMPARISON_LABELS.vorperiode,
        period: reportingPeriod ? getPreviousPeriod(reportingPeriod) : undefined,
        notices: [],
        chartSeries: {},
      },
    };
  }

  const yoy = data.yearOverYear && data.yearOverYear.version === YEAR_OVER_YEAR_VERSION
    ? data.yearOverYear
    : undefined;
  const missingBySource: Record<'gsc' | 'web', YoyKpiKey[]> = { gsc: [], web: [] };
  const nextKpis: Record<string, unknown> = { ...(kpis ?? {}) };

  if (kpis) {
    for (const [key, kpi] of Object.entries(kpis)) {
      if (!kpi) continue;
      const yoyKey = (YOY_KPI_KEYS as readonly string[]).includes(key) ? key as YoyKpiKey : null;
      if (!yoyKey) {
        nextKpis[key] = {
          ...kpi,
          comparison: { mode, previous: null, change: null, note: 'Für diese Kennzahl gibt es keinen Vorjahresvergleich.' },
        };
        continue;
      }
      const source = getYoySource(yoyKey);
      const status: YoySourceStatus | 'pending' = yoy ? yoy[source] : 'pending';
      const previous = yoy?.values[yoyKey];
      if (status !== 'available' || typeof previous !== 'number' || !Number.isFinite(previous)) {
        const reason = status === 'available' ? 'no_data' : status;
        missingBySource[source].push(yoyKey);
        nextKpis[key] = {
          ...kpi,
          comparison: { mode, previous: null, change: null, note: describeMissingYoy(reason, source) },
        };
        continue;
      }
      const change = calculatePercentChange(kpi.value, previous);
      nextKpis[key] = {
        ...kpi,
        comparison: {
          mode,
          previous,
          change,
          ...(change === null ? { note: 'Im Vorjahr lag der Wert bei 0, deshalb gibt es keine prozentuale Veränderung.' } : {}),
        },
      };
    }
  }

  const notices: string[] = [];
  for (const source of ['gsc', 'web'] as const) {
    const missing = missingBySource[source];
    if (missing.length === 0) continue;
    const status: YoySourceStatus | 'pending' = yoy ? yoy[source] : 'pending';
    const reason = describeMissingYoy(status === 'available' ? 'no_data' : status, source);
    if (status === 'pending') {
      if (!notices.includes(reason)) notices.push(reason);
      continue;
    }
    notices.push(`Kein Vorjahreswert für ${missing.map((key) => KPI_LABELS[key]).join(', ')}: ${reason}`);
  }

  const chartSeries: Partial<Record<YoyKpiKey, ChartPoint[]>> = {};
  if (yoy) {
    for (const key of YOY_KPI_KEYS) {
      if (yoy[getYoySource(key)] !== 'available') continue;
      const points = yoy.charts[key];
      if (points?.length) chartSeries[key] = shiftChartPointsByYears(points, 1);
    }
  }

  return {
    ...data,
    kpis: nextKpis as ProjectDashboardData['kpis'],
    comparison: {
      mode,
      label: COMPARISON_LABELS.vorjahr,
      period: yoy?.period ?? (reportingPeriod ? getYearOverYearPeriod(reportingPeriod) : undefined),
      notices,
      chartSeries,
    },
  };
}
