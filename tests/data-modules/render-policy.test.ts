import assert from 'node:assert/strict';
import test from 'node:test';
import type { DashboardWidgetVisibility } from '../../src/lib/dashboard-widget-visibility.ts';
import { buildDashboardRenderPolicy } from '../../src/components/dashboard/render-policy.ts';

function visibility(value: boolean): DashboardWidgetVisibility {
  return new Proxy({} as DashboardWidgetVisibility, {
    get: () => value,
  });
}

test('Dashboard users only receive enabled and available widgets', () => {
  const policy = buildDashboardRenderPolicy({
    userRole: 'BENUTZER',
    visibility: visibility(false),
    hasGoogleAds: true,
    hasLocalSeo: true,
    hasIndexingStatus: true,
    hasPromptTracking: true,
    semrushTrackingId: 'campaign-1',
  });

  assert.equal(policy.isAdmin, false);
  assert.equal(policy.render.googleAds, false);
  assert.equal(policy.render.localSeo, false);
  assert.equal(policy.render.promptTracking, false);
  assert.equal(policy.render.semrush, false);
});

test('Dashboard admins override visibility but not missing source data', () => {
  const policy = buildDashboardRenderPolicy({
    userRole: 'SUPERADMIN',
    visibility: visibility(false),
    hasGoogleAds: false,
    hasLocalSeo: true,
    hasIndexingStatus: true,
    hasPromptTracking: true,
    semrushTrackingId02: 'campaign-2',
  });

  assert.equal(policy.isAdmin, true);
  assert.equal(policy.render.googleAds, false);
  assert.equal(policy.render.localSeo, true);
  assert.equal(policy.render.indexing, true);
  assert.equal(policy.render.promptTracking, true);
  assert.equal(policy.render.semrushSecondary, true);
});
