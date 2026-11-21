import assert from 'node:assert/strict';
import test from 'node:test';
import { withFreshMarker } from '../../src/lib/sync/fresh-sql.ts';

function tag(strings: TemplateStringsArray, ..._values: unknown[]) {
  return strings;
}

test('fresh marker makes identical statements unique without touching parameters', () => {
  const strings = tag`SELECT * FROM project_sync_jobs WHERE id = ${1} AND job_type = ${'dashboard'}`;
  const a = withFreshMarker(strings, 'a');
  const b = withFreshMarker(strings, 'b');
  assert.equal(a.length, strings.length);
  assert.equal(a.raw.length, strings.raw.length);
  assert.ok(Array.isArray(a.raw));
  assert.notEqual(a[a.length - 1], b[b.length - 1]);
  assert.match(a[a.length - 1], /\/\* fresh:a \*\/$/);
  assert.equal(a[0], strings[0]);
});
