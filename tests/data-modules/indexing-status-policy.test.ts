import assert from 'node:assert/strict';
import test from 'node:test';
import { isBroadSitemapLastmodRefresh } from '../../src/lib/indexing-status-policy.ts';

test('Treats a mass lastmod rewrite as sitemap noise', () => {
  assert.equal(isBroadSitemapLastmodRefresh(33, 33), true);
  assert.equal(isBroadSitemapLastmodRefresh(20, 14), true);
});

test('Keeps isolated page changes eligible for priority inspection', () => {
  assert.equal(isBroadSitemapLastmodRefresh(33, 3), false);
  assert.equal(isBroadSitemapLastmodRefresh(9, 9), false);
});
