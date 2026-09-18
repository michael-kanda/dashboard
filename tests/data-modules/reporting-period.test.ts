import assert from 'node:assert/strict';
import test from 'node:test';
import { formatReportingPeriod } from '../../src/lib/reporting-period.ts';

test('formats the stored reporting period instead of the current date', () => {
  assert.equal(
    formatReportingPeriod({ from: '2026-08-10', to: '2026-09-08' }),
    '10.08.2026 – 08.09.2026',
  );
});

test('does not display an invented period for missing or invalid dates', () => {
  assert.equal(formatReportingPeriod(), '');
  assert.equal(formatReportingPeriod({ from: '2026-09-31', to: '2026-10-01' }), '');
  assert.equal(formatReportingPeriod({ from: '2026-09-18', to: '2026-09-08' }), '');
});
