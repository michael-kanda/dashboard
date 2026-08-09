export const GA4_KEY_EVENTS_METRIC = 'keyEvents' as const;

export function parseGa4Metric(value: string | null | undefined): number {
  const parsed = Number.parseFloat(value || '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isPaidSearchChannel(value: string | null | undefined): boolean {
  return value?.trim().toLocaleLowerCase('en-US') === 'paid search';
}
