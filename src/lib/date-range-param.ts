// Zeitraum aus ?range= nur aus der festen Liste übernehmen, sonst 30 Tage.
import type { DateRangeOption } from '@/types/date-range';

const DATE_RANGES: DateRangeOption[] = ['30d', '3m', '6m', '12m', '18m', '24m'];

export function parseDateRange(value?: string): DateRangeOption {
  return DATE_RANGES.includes(value as DateRangeOption) ? (value as DateRangeOption) : '30d';
}
