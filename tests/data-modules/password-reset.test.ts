import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  createResetToken,
  hashResetToken,
  hashThrottleKey,
  isResetTokenUsable,
  looksLikeResetToken,
  resetLinkFor,
  RESET_TOKEN_TTL_MINUTES,
} from '../../src/lib/password-reset/token.ts';
import {
  isResetRequestThrottled,
  MAX_RESET_REQUESTS_PER_EMAIL,
  MAX_RESET_REQUESTS_PER_IP,
  normalizeResetEmail,
  requestPasswordReset,
  respondToResetRequest,
  RESET_REQUEST_RESPONSE,
  type ResetRequestDeps,
} from '../../src/lib/password-reset/request.ts';
import { createPasswordChangeProof, isValidPasswordChangeProof } from '../../src/lib/session-state.ts';

const NOW = new Date('2026-11-28T10:00:00Z');
const minutes = (value: number) => new Date(NOW.getTime() + value * 60_000);

test('reset tokens are random, url-safe and stored only as sha-256 hash', () => {
  const first = createResetToken(NOW);
  const second = createResetToken(NOW);
  assert.notEqual(first.token, second.token);
  assert.ok(looksLikeResetToken(first.token), first.token);
  assert.equal(first.hash, createHash('sha256').update(first.token).digest('hex'));
  assert.equal(first.hash, hashResetToken(first.token));
  assert.notEqual(first.hash, first.token);
  assert.equal(first.expiresAt.getTime(), minutes(RESET_TOKEN_TTL_MINUTES).getTime());
  assert.equal(RESET_TOKEN_TTL_MINUTES, 60);
});

test('token format check rejects anything that is not a generated token', () => {
  for (const value of [undefined, null, 42, '', 'abc', `${'a'.repeat(43)}=`, 'a'.repeat(44), `${'a'.repeat(42)}/`]) {
    assert.equal(looksLikeResetToken(value), false, String(value));
  }
});

test('tokens expire after 60 minutes and work only once', () => {
  const { expiresAt } = createResetToken(NOW);
  const record = { expires_at: expiresAt, used_at: null };
  assert.equal(isResetTokenUsable(record, NOW), true);
  assert.equal(isResetTokenUsable(record, minutes(59)), true);
  assert.equal(isResetTokenUsable(record, minutes(60)), false);
  assert.equal(isResetTokenUsable(record, minutes(61)), false);
  assert.equal(isResetTokenUsable({ ...record, used_at: minutes(5) }, minutes(10)), false);
  assert.equal(isResetTokenUsable({ expires_at: expiresAt.toISOString(), used_at: null }, NOW), true);
  assert.equal(isResetTokenUsable(null, NOW), false);
});

test('reset link keeps the token in the fragment', () => {
  assert.equal(resetLinkFor('https://app.datapeak.at/', 'tok'), 'https://app.datapeak.at/login/neues-passwort#token=tok');
  const url = new URL(resetLinkFor('https://app.datapeak.at', 'tok'));
  assert.equal(url.search, '');
  assert.equal(url.hash, '#token=tok');
});

test('throttle keys are keyed hashes, never the raw address', () => {
  const key = hashThrottleKey('kunde@example.at', 'secret-a');
  assert.equal(key, hashThrottleKey('kunde@example.at', 'secret-a'));
  assert.notEqual(key, hashThrottleKey('kunde@example.at', 'secret-b'));
  assert.notEqual(key, createHash('sha256').update('kunde@example.at').digest('hex'));
  assert.ok(!key?.includes('kunde'));
  assert.equal(hashThrottleKey(null, 'secret-a'), null);
});

test('email input is normalized and validated', () => {
  assert.equal(normalizeResetEmail('  Kunde@Example.AT '), 'kunde@example.at');
  assert.equal(normalizeResetEmail('kein-at-zeichen'), null);
  assert.equal(normalizeResetEmail(undefined), null);
  assert.equal(normalizeResetEmail(`${'a'.repeat(250)}@b.at`), null);
});

test('throttle limits per email and per ip', () => {
  assert.equal(isResetRequestThrottled({ byEmail: MAX_RESET_REQUESTS_PER_EMAIL - 1, byIp: 0 }), false);
  assert.equal(isResetRequestThrottled({ byEmail: MAX_RESET_REQUESTS_PER_EMAIL, byIp: 0 }), true);
  assert.equal(isResetRequestThrottled({ byEmail: 0, byIp: MAX_RESET_REQUESTS_PER_IP - 1 }), false);
  assert.equal(isResetRequestThrottled({ byEmail: 0, byIp: MAX_RESET_REQUESTS_PER_IP }), true);
});

/** Speicher-Attrappe: zählt Anfragen wie password_reset_requests und merkt sich versendete Mails. */
function fakeDeps(accounts: string[], overrides: Partial<ResetRequestDeps> = {}) {
  const requests: Array<{ email: string; ip: string | null }> = [];
  const mails: Array<{ email: string; link: string }> = [];
  const deps: ResetRequestDeps = {
    countRecentRequests: async (email, ip) => ({
      byEmail: requests.filter((r) => r.email === email).length,
      byIp: requests.filter((r) => ip !== null && r.ip === ip).length,
    }),
    recordRequest: async (email, ip) => { requests.push({ email, ip }); },
    findUser: async (email) => (accounts.includes(email) ? { id: `id-${email}`, email } : null),
    issueLink: async (userId) => resetLinkFor('https://app.datapeak.at', `token-for-${userId}`),
    sendMail: async (email, link) => { mails.push({ email, link }); return true; },
    log: () => undefined,
    ...overrides,
  };
  return { deps, requests, mails };
}

test('sends a link only for existing accounts', async () => {
  const { deps, mails } = fakeDeps(['kunde@example.at']);
  assert.equal(await requestPasswordReset('Kunde@Example.at', '203.0.113.7', deps), 'sent');
  assert.equal(await requestPasswordReset('fremd@example.at', '203.0.113.7', deps), 'unknown');
  assert.deepEqual(mails.map((m) => m.email), ['kunde@example.at']);
  assert.match(mails[0].link, /#token=/);
});

test('throttles repeated requests per email, also for unknown addresses', async () => {
  const { deps, mails } = fakeDeps(['kunde@example.at']);
  const outcomes = [];
  for (let i = 0; i < MAX_RESET_REQUESTS_PER_EMAIL + 2; i += 1) {
    outcomes.push(await requestPasswordReset('kunde@example.at', `198.51.100.${i}`, deps));
  }
  assert.deepEqual(outcomes, [
    ...Array(MAX_RESET_REQUESTS_PER_EMAIL).fill('sent'),
    'throttled',
    'throttled',
  ]);
  assert.equal(mails.length, MAX_RESET_REQUESTS_PER_EMAIL);

  const unknown = fakeDeps([]);
  for (let i = 0; i < MAX_RESET_REQUESTS_PER_EMAIL; i += 1) await requestPasswordReset('fremd@example.at', null, unknown.deps);
  assert.equal(await requestPasswordReset('fremd@example.at', null, unknown.deps), 'throttled');
});

test('throttles many addresses from one ip', async () => {
  const { deps, mails } = fakeDeps([]);
  for (let i = 0; i < MAX_RESET_REQUESTS_PER_IP; i += 1) {
    assert.equal(await requestPasswordReset(`person${i}@example.at`, '203.0.113.7', deps), 'unknown');
  }
  assert.equal(await requestPasswordReset('noch-eine@example.at', '203.0.113.7', deps), 'throttled');
  assert.equal(await requestPasswordReset('noch-eine@example.at', '203.0.113.8', deps), 'unknown');
  assert.equal(mails.length, 0);
});

test('the response is identical whether or not the address has an account', async () => {
  const cases: Array<[string, ReturnType<typeof fakeDeps>, string]> = [
    ['known', fakeDeps(['kunde@example.at']), 'kunde@example.at'],
    ['unknown', fakeDeps([]), 'fremd@example.at'],
    ['mail fails', fakeDeps(['kunde@example.at'], { sendMail: async () => false }), 'kunde@example.at'],
    ['database fails', fakeDeps(['kunde@example.at'], { findUser: async () => { throw new Error('db down'); } }), 'kunde@example.at'],
  ];
  const throttled = fakeDeps(['kunde@example.at'], { countRecentRequests: async () => ({ byEmail: 99, byIp: 0 }) });
  cases.push(['throttled', throttled, 'kunde@example.at']);

  const responses = [];
  for (const [label, { deps }, email] of cases) {
    const response = await respondToResetRequest(email, '203.0.113.7', deps, { minMs: 0, onError: () => undefined });
    responses.push({ label, ...response });
  }
  for (const response of responses) {
    assert.equal(response.status, 200, response.label);
    assert.deepEqual(response.body, RESET_REQUEST_RESPONSE, response.label);
  }
  assert.equal(cases[0][1].mails.length, 1);
  assert.equal(cases[1][1].mails.length, 0);
});

test('only malformed input gets a different answer', async () => {
  const { deps } = fakeDeps([]);
  const response = await respondToResetRequest('kein-at-zeichen', null, deps, { minMs: 0 });
  assert.equal(response.status, 400);
});

test('the response takes at least the minimum time, also for unknown addresses', async () => {
  const { deps } = fakeDeps([]);
  const startedAt = Date.now();
  await respondToResetRequest('fremd@example.at', null, deps, { minMs: 60 });
  assert.ok(Date.now() - startedAt >= 55, `${Date.now() - startedAt} ms`);
});

test('password change proof is bound to user, fingerprint and secret', async () => {
  const proof = await createPasswordChangeProof('user-1', 'abcd1234abcd1234', 'secret');
  assert.ok(proof);
  assert.equal(await isValidPasswordChangeProof(proof, 'user-1', 'abcd1234abcd1234', 'secret'), true);
  assert.equal(await isValidPasswordChangeProof(proof, 'user-2', 'abcd1234abcd1234', 'secret'), false);
  assert.equal(await isValidPasswordChangeProof(proof, 'user-1', 'ffff1234abcd1234', 'secret'), false);
  assert.equal(await isValidPasswordChangeProof(proof, 'user-1', 'abcd1234abcd1234', 'other'), false);
  assert.equal(await isValidPasswordChangeProof('forged', 'user-1', 'abcd1234abcd1234', 'secret'), false);
  assert.equal(await isValidPasswordChangeProof(undefined, 'user-1', 'abcd1234abcd1234', 'secret'), false);
  assert.equal(await createPasswordChangeProof('user-1', 'abcd1234abcd1234', null), null);
});
