import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contrastRatio,
  DEFAULT_THEME,
  findContrastIssues,
  normalizeHex,
  themeSchema,
  themeToCss,
} from '../../src/lib/theme.ts';

test('normalizes hex input', () => {
  assert.equal(normalizeHex('#123456'), '#123456');
  assert.equal(normalizeHex('abcdef'), '#ABCDEF');
  assert.equal(normalizeHex('#fa0'), '#FFAA00');
  assert.equal(normalizeHex('#12345'), null);
  assert.equal(normalizeHex('red'), null);
});

test('default theme produces no css and no contrast issues', () => {
  assert.equal(themeToCss(DEFAULT_THEME), '');
  assert.deepEqual(findContrastIssues(DEFAULT_THEME), []);
});

test('rejects values that could break out of the style tag', () => {
  const attempts = [
    { light: { accent: '#000000;}body{display:none' } },
    { light: { accent: 'red' } },
    { light: { unknownKey: '#000000' } },
    { shadow: 'huge' },
    { radius: 100 },
  ];
  for (const attempt of attempts) {
    assert.equal(themeSchema.safeParse(attempt).success, false, JSON.stringify(attempt));
    assert.equal(themeToCss(attempt as never), '');
  }
});

test('keeps light overrides out of dark mode', () => {
  const theme = themeSchema.parse({ light: { page: '#F0F0F0' }, dark: { page: '#101010' }, shadow: 'md', radius: 8 });
  const css = themeToCss(theme);
  assert.match(css, /html:root\{--dp-radius-container:8px\}/);
  assert.match(css, /html:root:not\(\.dark\)\{[^}]*--dp-page:#F0F0F0/);
  assert.match(css, /html\.dark\{[^}]*--dp-page:#101010/);
  assert.match(css, /html\.dark\{[^}]*--dp-card-shadow:/);
});

test('turning borders off wins over a border color', () => {
  const css = themeToCss(themeSchema.parse({ border: false, light: { border: '#FF0000' } }));
  assert.match(css, /--dp-card-border:transparent/);
  assert.doesNotMatch(css, /#FF0000/);
});

test('flags unreadable color pairs', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#FFFFFF')), 21);
  const issues = findContrastIssues(themeSchema.parse({ light: { text: '#CCCCCC' } }));
  assert.ok(issues.some((issue) => issue.mode === 'light' && issue.label.startsWith('Fließtext')));
});

test('font weights apply to both modes and only allowed values pass', () => {
  const css = themeToCss(themeSchema.parse({ weights: { normal: 500, semibold: 700 } }));
  assert.match(css, /html:root\{[^}]*--dp-weight-normal:500;--dp-weight-semibold:700\}/);
  assert.equal(themeSchema.safeParse({ weights: { normal: 451 } }).success, false);
  assert.equal(themeSchema.safeParse({ weights: { normal: '500;color:red' } }).success, false);
  assert.equal(themeSchema.safeParse({ weights: { huge: 500 } }).success, false);
});
