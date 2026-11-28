// Fiktive Vorjahreswerte für Demo-Daten, damit der Umschalter Vorperiode/Vorjahr
// auch ohne Google-Zugang etwas zeigt. Nur für Demos, nie für echte Projekte.
import {
  YEAR_OVER_YEAR_VERSION,
  getYearOverYearPeriod,
  shiftIsoDateByYears,
  YOY_KPI_KEYS,
  type YearOverYearData,
  type YoyKpiKey,
} from './comparison.ts';
import type { ChartPoint, ProjectDashboardData } from './dashboard-shared.ts';

const RATE_KEYS: ReadonlySet<YoyKpiKey> = new Set(['engagementRate', 'bounceRate', 'avgEngagementTime']);

function isoDay(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * Baut einen Vorjahresblock aus den aktuellen Demo-Daten. Der Vorjahresverlauf
 * schwankt um das Vorjahresniveau (ruhigere Wochenenden, leichte Welle) statt den
 * aktuellen Anstieg zu kopieren.
 */
export function buildDemoYearOverYear(
  data: ProjectDashboardData,
  previousValues: Partial<Record<YoyKpiKey, number>>,
): YearOverYearData | undefined {
  const reference = data.charts?.clicks ?? data.charts?.sessions ?? [];
  const dates = reference.map((point) => point.date).filter(Number.isFinite);
  const period = data.reportingPeriod
    ?? (dates.length ? { from: isoDay(Math.min(...dates)), to: isoDay(Math.max(...dates)) } : undefined);
  if (!period) return undefined;

  const charts: YearOverYearData['charts'] = {};
  for (const key of YOY_KPI_KEYS) {
    const current = data.charts?.[key];
    const currentValue = data.kpis?.[key]?.value;
    const previousValue = previousValues[key];
    if (!current?.length || !currentValue || previousValue === undefined) continue;
    const mean = current.reduce((sum, point) => sum + point.value, 0) / current.length;
    const level = mean * (previousValue / currentValue);
    charts[key] = current.map((point, index): ChartPoint => {
      // Uhrzeit-Anteil erhalten, damit die Linie nach dem Zurückschieben genau auf den Tagen liegt.
      const offset = point.date - Date.parse(`${isoDay(point.date)}T00:00:00Z`);
      const shifted = Date.parse(`${shiftIsoDateByYears(isoDay(point.date), -1)}T00:00:00Z`) + offset;
      const weekday = new Date(shifted).getUTCDay();
      const weekFactor = RATE_KEYS.has(key) ? 1 : weekday === 0 ? 0.76 : weekday === 6 ? 0.82 : 1.07;
      const wave = 1 + (RATE_KEYS.has(key) ? 0.02 : 0.06) * Math.sin(index / 2.3);
      const value = level * weekFactor * wave;
      // Zählwerte ganzzahlig, Raten (0–1 oder Prozent) und Sekunden mit Nachkommastellen.
      const rounded = !RATE_KEYS.has(key)
        ? Math.round(value)
        : level < 2 ? Number(value.toFixed(4)) : Math.round(value * 10) / 10;
      return { date: shifted, value: rounded };
    });
  }

  return {
    version: YEAR_OVER_YEAR_VERSION,
    period: getYearOverYearPeriod(period),
    fetchedAt: new Date(0).toISOString(),
    gsc: 'available',
    web: 'available',
    sourceIds: { gsc: 'demo', web: 'demo' },
    values: previousValues,
    charts,
  };
}
