const CACHE_TTL_HOURS: Record<string, number> = {
  '7d': 48,
  '30d': 48,
  '3m': 48,
  '6m': 72,
  '12m': 168,
  '18m': 168,
  '24m': 168,
};

const RANGE_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '3m': 90,
  '6m': 180,
  '12m': 365,
  '18m': 548,
  '24m': 730,
};

/**
 * Alle Quellen (GSC, GA4, Google-Ads-Sheet) zeigen Daten bis zum Vortag.
 * GSC wird dafür mit dataState "all" abgefragt (frische, noch nicht finale Werte).
 */
export const REPORTING_LAG_DAYS = 1;
/** @deprecated Alter Name, entspricht REPORTING_LAG_DAYS. */
export const GSC_DATA_LAG_DAYS = REPORTING_LAG_DAYS;
/** "Heute" und "gestern" gelten nach österreichischer Zeit, nicht nach Server-UTC. */
export const REPORTING_TIME_ZONE = 'Europe/Vienna';
export const INVALIDATED_CACHE_TIMESTAMP = '1970-01-01T00:00:00.000Z';

export function getDashboardCacheDurationHours(dateRange: string) {
  return CACHE_TTL_HOURS[dateRange] ?? 48;
}

export function getDateRangeDays(dateRange: string) {
  return RANGE_DAYS[dateRange] ?? 30;
}

export function isDashboardSnapshotStale(
  dateRange: string,
  lastFetchedAt: string | Date | null | undefined,
  now = Date.now(),
) {
  if (!lastFetchedAt) return true;
  const fetchedAt = new Date(lastFetchedAt).getTime();
  if (!Number.isFinite(fetchedAt)) return true;
  return now - fetchedAt >= getDashboardCacheDurationHours(dateRange) * 60 * 60 * 1000;
}

function toDateString(value: Date) {
  return value.toISOString().split('T')[0];
}

/** Kalendertag in Wien als UTC-Mitternacht (für Tagesrechnung ohne Zeitzonen-Sprünge). */
function reportingToday(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORTING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export interface ReportingWindow {
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  days: number;
}

export function getReportingWindow(
  dateRange: string,
  now = new Date(),
  lagDays = REPORTING_LAG_DAYS,
): ReportingWindow {
  const days = getDateRangeDays(dateRange);
  const end = addDays(reportingToday(now), -lagDays);
  const start = addDays(end, -(days - 1));
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(days - 1));

  return {
    startDate: toDateString(start),
    endDate: toDateString(end),
    previousStartDate: toDateString(previousStart),
    previousEndDate: toDateString(previousEnd),
    days,
  };
}

/**
 * Ein Snapshot ist veraltet, sobald sein Enddatum vor dem Vortag liegt –
 * unabhängig von der TTL. So zeigt das Dashboard jeden Tag Daten bis gestern.
 */
export function isDashboardSnapshotBehind(
  dateRange: string,
  reportingPeriodTo: string | null | undefined,
  now = new Date(),
) {
  if (!reportingPeriodTo) return true;
  return reportingPeriodTo < getReportingWindow(dateRange, now).endDate;
}
