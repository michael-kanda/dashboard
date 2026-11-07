import assert from 'node:assert/strict';
import test from 'node:test';
import { isNonBrowserRuntimeEvent } from '../../src/lib/sentry-filter.ts';

const event = (filenames: string[]) => ({
  exception: { values: [{ stacktrace: { frames: filenames.map((filename) => ({ filename })) } }] },
});

test('drops errors from Deno-style runtimes', () => {
  assert.equal(isNonBrowserRuntimeEvent(event(['<script>', 'ext:core/01_core.js'])), true);
});

test('keeps real browser errors', () => {
  assert.equal(isNonBrowserRuntimeEvent(event(['https://www.datapeak.at/_next/static/chunks/app.js'])), false);
  assert.equal(isNonBrowserRuntimeEvent({}), false);
});
