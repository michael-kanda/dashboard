const CACHE_TTL_HOURS: Record<string, number> = {
  '7d': 24,
  '30d': 24,
  '3m': 48,
  '6m': 72,
  '12m': 168,
  '18m': 168,
  '24m': 168,
};

export function getDashboardCacheDurationHours(dateRange: string) {
  return CACHE_TTL_HOURS[dateRange] ?? 24;
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
