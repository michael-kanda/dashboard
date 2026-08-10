const CACHE_TTL_HOURS: Record<string, number> = {
  '7d': 24,
  '30d': 24,
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

export const GSC_DATA_LAG_DAYS = 2;

export function getDashboardCacheDurationHours(dateRange: string) {
  return CACHE_TTL_HOURS[dateRange] ?? 24;
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
  lagDays = GSC_DATA_LAG_DAYS,
): ReportingWindow {
  const days = getDateRangeDays(dateRange);
  const end = new Date(now);
  end.setDate(end.getDate() - lagDays);
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousEnd.getDate() - (days - 1));

  return {
    startDate: toDateString(start),
    endDate: toDateString(end),
    previousStartDate: toDateString(previousStart),
    previousEndDate: toDateString(previousEnd),
    days,
  };
}
