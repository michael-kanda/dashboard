import assert from 'node:assert/strict';
import test from 'node:test';
import {
  base32Decode,
  base32Encode,
  currentStep,
  generateTotpSecret,
  totpCode,
  totpUri,
  verifyTotp,
} from '../../src/lib/two-factor/totp.ts';
import { openSecret, sealSecret } from '../../src/lib/two-factor/secret-box.ts';
import {
  consumeRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  looksLikeRecoveryCode,
} from '../../src/lib/two-factor/recovery.ts';
import { isTwoFactorRequired, needsTwoFactorSetup } from '../../src/lib/two-factor/policy.ts';

// RFC 6238, Anhang B (SHA-1): Geheimnis "12345678901234567890", 8-stellige Werte -> letzte 6 Ziffern.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

test('TOTP matches the RFC 6238 test vectors', () => {
  assert.equal(RFC_SECRET, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  const cases: Array<[number, string]> = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ];
  for (const [seconds, expected] of cases) {
    assert.equal(totpCode(RFC_SECRET, currentStep(seconds * 1000)), expected, `t=${seconds}`);
  }
});

test('base32 round trip and new secrets', () => {
  const bytes = Buffer.from('DataPeak 2FA');
  assert.deepEqual(base32Decode(base32Encode(bytes)), bytes);
  const secret = generateTotpSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.equal(base32Decode(secret).length, 20);
});

test('verification accepts one step of clock drift and rejects replays', () => {
  const now = 1_800_000_000_000;
  const step = currentStep(now);
  const code = totpCode(RFC_SECRET, step);
  assert.equal(verifyTotp(RFC_SECRET, code, { now }), step);
  assert.equal(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), { now }), step - 1);
  assert.equal(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), { now }), null);
  assert.equal(verifyTotp(RFC_SECRET, ` ${code.slice(0, 3)} ${code.slice(3)} `, { now }), step);
  assert.equal(verifyTotp(RFC_SECRET, code, { now, lastStep: step }), null, 'bereits benutzt');
  assert.equal(verifyTotp(RFC_SECRET, 'abcdef', { now }), null);
  assert.equal(verifyTotp(RFC_SECRET, '12345', { now }), null);
});

test('otpauth URI for authenticator apps', () => {
  const uri = totpUri('ABC234', 'admin@example.at');
  assert.ok(uri.startsWith('otpauth://totp/DataPeak%3Aadmin%40example.at?'));
  assert.match(uri, /secret=ABC234/);
  assert.match(uri, /issuer=DataPeak/);
});

test('secret box encrypts and detects tampering', () => {
  const sealed = sealSecret('JBSWY3DPEHPK3PXP', 'test-secret');
  assert.notEqual(sealed.includes('JBSWY3DPEHPK3PXP'), true);
  assert.equal(openSecret(sealed, 'test-secret'), 'JBSWY3DPEHPK3PXP');
  assert.throws(() => openSecret(sealed, 'anderes-secret'));
  const parts = sealed.split(':');
  parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('A') ? 'BB' : 'AA');
  assert.throws(() => openSecret(parts.join(':'), 'test-secret'));
});

test('recovery codes are single use', () => {
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
  assert.ok(codes.every((code) => /^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(code)));
  assert.ok(looksLikeRecoveryCode(codes[0].toLowerCase()));
  assert.equal(looksLikeRecoveryCode('123456'), false);

  const hashes = codes.map(hashRecoveryCode);
  const remaining = consumeRecoveryCode(codes[2].toLowerCase().replace('-', ' '), hashes);
  assert.ok(remaining);
  assert.equal(remaining.length, 7);
  assert.equal(consumeRecoveryCode(codes[2], remaining), null, 'zweite Verwendung');
  assert.equal(consumeRecoveryCode('AAAAA-AAAAA', hashes), null);
});

test('two-factor is required for staff only', () => {
  assert.equal(isTwoFactorRequired('ADMIN'), true);
  assert.equal(isTwoFactorRequired('SUPERADMIN'), true);
  assert.equal(isTwoFactorRequired('BENUTZER'), false);
  assert.equal(needsTwoFactorSetup('ADMIN', false), true);
  assert.equal(needsTwoFactorSetup('ADMIN', true), false);
  assert.equal(needsTwoFactorSetup('ADMIN', undefined), false, 'unbekannt: alte Sitzung, nicht sperren');
  assert.equal(needsTwoFactorSetup('BENUTZER', false), false);
});
