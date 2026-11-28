import assert from 'node:assert/strict';
import test from 'node:test';
import {
  YEAR_OVER_YEAR_VERSION,
  applyComparisonMode,
  assessCoverage,
  calculatePercentChange,
  getGscEarliestAvailableDate,
  getPreviousPeriod,
  getYearOverYearPeriod,
  isPeriodWithinGscRetention,
  parseComparisonMode,
  shiftChartPointsByYears,
  shiftIsoDateByMonths,
  shiftIsoDateByYears,
  type YearOverYearData,
} from '../../src/lib/comparison.ts';
import { getReportingWindow } from '../../src/lib/sync/cache-policy.ts';
import type { ProjectDashboardData } from '../../src/lib/dashboard-shared.ts';

const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

test('reads the comparison mode from the URL and falls back to the previous period', () => {
  assert.equal(parseComparisonMode('vorjahr'), 'vorjahr');
  assert.equal(parseComparisonMode(['vorjahr']), 'vorjahr');
  assert.equal(parseComparisonMode('vorperiode'), 'vorperiode');
  assert.equal(parseComparisonMode('yoy'), 'vorperiode');
  assert.equal(parseComparisonMode(undefined), 'vorperiode');
});

test('shifts dates by one year on the same calendar day', () => {
  assert.equal(shiftIsoDateByYears('2026-11-27', -1), '2025-11-27');
  assert.equal(shiftIsoDateByYears('2025-01-01', -1), '2024-01-01');
  assert.equal(shiftIsoDateByYears('2024-12-31', -1), '2023-12-31');
});

test('maps the leap day to 28 February and keeps 28 February as it is', () => {
  assert.equal(shiftIsoDateByYears('2024-02-29', -1), '2023-02-28');
  assert.equal(shiftIsoDateByYears('2028-02-29', -1), '2027-02-28');
  // Kalendergleich: der 28.02.2025 bleibt der 28.02.2024, der 29.02.2024 fällt nicht hinein.
  assert.equal(shiftIsoDateByYears('2025-02-28', -1), '2024-02-28');
  assert.equal(shiftIsoDateByYears('2025-03-01', -1), '2024-03-01');
});

test('keeps month ends and clamps days that do not exist in the target month', () => {
  assert.equal(shiftIsoDateByYears('2025-03-31', -1), '2024-03-31');
  assert.equal(shiftIsoDateByYears('2025-04-30', -1), '2024-04-30');
  assert.equal(shiftIsoDateByMonths('2025-03-31', -1), '2025-02-28');
  assert.equal(shiftIsoDateByMonths('2024-03-31', -1), '2024-02-29');
  assert.equal(shiftIsoDateByMonths('2026-11-28', -16), '2025-07-28');
  assert.equal(shiftIsoDateByMonths('2025-12-31', 2), '2026-02-28');
});

test('builds the year-over-year window from the reporting window', () => {
  const window = getReportingWindow('30d', new Date('2026-11-28T10:00:00Z'));
  assert.deepEqual(
    getYearOverYearPeriod({ from: window.startDate, to: window.endDate }),
    { from: '2025-10-29', to: '2025-11-27' },
  );
  // Ein Zeitraum mit 29. Februar endet im Vorjahr am 28. Februar.
  assert.deepEqual(
    getYearOverYearPeriod({ from: '2024-02-01', to: '2024-02-29' }),
    { from: '2023-02-01', to: '2023-02-28' },
  );
  assert.deepEqual(
    getYearOverYearPeriod({ from: '2024-03-01', to: '2025-02-28' }),
    { from: '2023-03-01', to: '2024-02-28' },
  );
});

test('previous period matches the window the loader uses', () => {
  for (const range of ['30d', '3m', '6m', '12m', '18m', '24m']) {
    const window = getReportingWindow(range, new Date('2026-03-01T10:00:00Z'));
    assert.deepEqual(
      getPreviousPeriod({ from: window.startDate, to: window.endDate }),
      { from: window.previousStartDate, to: window.previousEndDate },
      range,
    );
  }
});

test('only asks Search Console for year-over-year windows inside its 16 months', () => {
  const today = '2026-11-28';
  assert.equal(getGscEarliestAvailableDate(today), '2025-08-04');
  const now = new Date('2026-11-28T10:00:00Z');
  const yoyFor = (range: string) => {
    const window = getReportingWindow(range, now);
    return getYearOverYearPeriod({ from: window.startDate, to: window.endDate });
  };
  assert.equal(isPeriodWithinGscRetention(yoyFor('30d'), today), true);
  assert.equal(isPeriodWithinGscRetention(yoyFor('3m'), today), true);
  assert.equal(isPeriodWithinGscRetention(yoyFor('6m'), today), false);
  assert.equal(isPeriodWithinGscRetention(yoyFor('12m'), today), false);
  assert.equal(isPeriodWithinGscRetention(yoyFor('24m'), today), false);
});

test('recognizes missing and partial year-over-year data', () => {
  const period = { from: '2025-10-29', to: '2025-11-27' };
  const days = (from: string, count: number, value = 5) =>
    Array.from({ length: count }, (_, index) => ({ date: utc(from) + index * 86_400_000, value }));

  assert.equal(assessCoverage([], 0, period), 'no_data');
  assert.equal(assessCoverage(days('2025-10-29', 30, 0), 0, period), 'no_data');
  assert.equal(assessCoverage(days('2025-10-29', 30), 150, period), 'available');
  // Messung beginnt erst nach drei Wochen: kein ehrlicher Vergleich möglich.
  assert.equal(assessCoverage(days('2025-11-19', 9), 45, period), 'incomplete');
  // Ein paar Tage ohne Daten am Anfang sind normal.
  assert.equal(assessCoverage(days('2025-11-02', 26), 130, period), 'available');
});

test('calculates no percent change without a previous value above zero', () => {
  assert.equal(calculatePercentChange(120, 100), 20);
  assert.equal(calculatePercentChange(80, 100), -20);
  assert.equal(calculatePercentChange(50, 0), null);
  assert.equal(calculatePercentChange(50, Number.NaN), null);
});

test('moves year-over-year chart points onto the current dates and drops the extra leap day', () => {
  const shifted = shiftChartPointsByYears([
    { date: utc('2024-02-27'), value: 1 },
    { date: utc('2024-02-28'), value: 2 },
    { date: utc('2024-02-29'), value: 3 },
    { date: utc('2024-03-01'), value: 4 },
  ], 1);
  assert.deepEqual(shifted, [
    { date: utc('2025-02-27'), value: 1 },
    { date: utc('2025-02-28'), value: 2 },
    { date: utc('2025-03-01'), value: 4 },
  ]);
});

function snapshot(yearOverYear?: YearOverYearData): ProjectDashboardData {
  return {
    reportingPeriod: { from: '2026-10-29', to: '2026-11-27' },
    kpis: {
      clicks: { value: 120, change: 50, previous: 80 },
      impressions: { value: 4000, change: 0 },
      sessions: { value: 300, change: 20 },
      totalUsers: { value: 250, change: -100 },
      conversions: { value: 12, change: 9 },
      genAiImpressions: { value: 0, change: 0 },
    },
    charts: {},
    ...(yearOverYear ? { yearOverYear } : {}),
  };
}

test('previous period mode keeps the stored change and uses the stored previous value', () => {
  const result = applyComparisonMode(snapshot(), 'vorperiode');
  assert.deepEqual(result.kpis?.clicks?.comparison, { mode: 'vorperiode', previous: 80, change: 50 });
  // Ältere Snapshots ohne gespeicherten Vorher-Wert: zurückgerechnet wie bisher.
  assert.equal(result.kpis?.sessions?.comparison?.previous, 250);
  assert.equal(result.kpis?.totalUsers?.comparison?.previous, 0);
  assert.deepEqual(result.comparison?.period, { from: '2026-09-29', to: '2026-10-28' });
  assert.equal(result.comparison?.label, 'Vorperiode');
});

test('year-over-year mode shows a notice instead of 0 % when the data is still missing', () => {
  const result = applyComparisonMode(snapshot(), 'vorjahr');
  const clicks = result.kpis?.clicks?.comparison;
  assert.equal(clicks?.previous, null);
  assert.equal(clicks?.change, null);
  assert.match(clicks?.note ?? '', /nächsten Datenabgleich/);
  // Die gespeicherte Veränderung zur Vorperiode bleibt unangetastet.
  assert.equal(result.kpis?.clicks?.change, 50);
  assert.deepEqual(result.comparison?.period, { from: '2025-10-29', to: '2025-11-27' });
  assert.equal(result.comparison?.notices.length, 1);
});

test('year-over-year mode explains the Search Console limit and still compares GA4', () => {
  const yoy: YearOverYearData = {
    version: YEAR_OVER_YEAR_VERSION,
    period: { from: '2025-10-29', to: '2025-11-27' },
    fetchedAt: '2026-11-28T03:00:00.000Z',
    gsc: 'out_of_range',
    web: 'available',
    values: { sessions: 200, totalUsers: 250, conversions: 0 },
    charts: { sessions: [{ date: utc('2025-11-01'), value: 7 }] },
  };
  const result = applyComparisonMode(snapshot(yoy), 'vorjahr');

  const clicks = result.kpis?.clicks?.comparison;
  assert.equal(clicks?.change, null);
  assert.match(clicks?.note ?? '', /16 Monate/);

  assert.deepEqual(result.kpis?.sessions?.comparison, { mode: 'vorjahr', previous: 200, change: 50 });
  assert.equal(result.kpis?.totalUsers?.comparison?.change, 0);
  // Vorjahr 0: Vorher-Wert zeigen, aber keine erfundene Prozentzahl.
  assert.equal(result.kpis?.conversions?.comparison?.previous, 0);
  assert.equal(result.kpis?.conversions?.comparison?.change, null);
  // Kennzahlen ohne Vorjahreswert bekommen keinen Vergleich.
  assert.equal(result.kpis?.genAiImpressions?.comparison?.change, null);

  assert.equal(result.comparison?.notices.length, 1);
  assert.match(result.comparison?.notices[0] ?? '', /Impressionen, Klicks|Klicks, Impressionen/);
  assert.deepEqual(result.comparison?.chartSeries.sessions, [{ date: utc('2026-11-01'), value: 7 }]);
  assert.equal(result.comparison?.chartSeries.clicks, undefined);
});

test('ignores year-over-year blocks of an older version', () => {
  const yoy = {
    version: YEAR_OVER_YEAR_VERSION + 99,
    period: { from: '2025-10-29', to: '2025-11-27' },
    fetchedAt: '2026-11-28T03:00:00.000Z',
    gsc: 'available',
    web: 'available',
    values: { clicks: 60 },
    charts: {},
  } as YearOverYearData;
  const result = applyComparisonMode(snapshot(yoy), 'vorjahr');
  assert.equal(result.kpis?.clicks?.comparison?.change, null);
  assert.match(result.kpis?.clicks?.comparison?.note ?? '', /nächsten Datenabgleich/);
});

test('demo prior-year lines land exactly on the days of the reporting period', async () => {
  const { buildDemoYearOverYear } = await import('../../src/lib/demo-year-over-year.ts');
  // Zeitstempel mit Uhrzeit wie bei den internen Demo-Projekten.
  const start = Date.parse('2026-02-20T09:30:00Z');
  const clicks = Array.from({ length: 14 }, (_, index) => ({ date: start + index * 86_400_000, value: 40 + index }));
  const data: ProjectDashboardData = { kpis: { clicks: { value: 600, change: 10 } }, charts: { clicks } };
  const yoy = buildDemoYearOverYear(data, { clicks: 450 });
  assert.ok(yoy);
  assert.deepEqual(yoy.period, { from: '2025-02-20', to: '2025-03-05' });
  const result = applyComparisonMode({ ...data, yearOverYear: yoy }, 'vorjahr');
  assert.deepEqual(result.comparison?.chartSeries.clicks?.map((point) => point.date), clicks.map((point) => point.date));
  assert.equal(result.kpis?.clicks?.comparison?.previous, 450);
});
