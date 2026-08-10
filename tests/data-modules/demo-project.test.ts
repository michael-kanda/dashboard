import assert from 'node:assert/strict';
import test from 'node:test';
import { isDemoProject } from '../../src/lib/demo-project.ts';

test('uses the explicit demo flag and exact legacy domain only', () => {
  assert.equal(isDemoProject({ is_demo: true, domain: 'kunde.at' }), true);
  assert.equal(isDemoProject({ domain: 'demo-shop.de' }), true);
  assert.equal(isDemoProject({ email: 'demo@echter-kunde.at', domain: 'echter-kunde.at' }), false);
  assert.equal(isDemoProject({ email: 'info@demolition.at', domain: 'demolition.at' }), false);
});
