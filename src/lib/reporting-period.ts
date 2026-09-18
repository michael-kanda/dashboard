export interface ReportingPeriod {
  from: string;
  to: string;
}

function formatIsoDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.toISOString().slice(0, 10) !== value) return null;
  return `${day}.${month}.${year}`;
}

export function formatReportingPeriod(period?: ReportingPeriod | null): string {
  if (!period) return '';
  const from = formatIsoDate(period.from);
  const to = formatIsoDate(period.to);
  return from && to && period.from <= period.to ? `${from} – ${to}` : '';
}
