import assert from 'node:assert/strict';
import test from 'node:test';
import { aiModelsSchema, DEFAULT_AI_MODELS } from '../../src/lib/ai-model-schema.ts';

test('accepts gemini model ids and normalizes case and spaces', () => {
  assert.deepEqual(aiModelsSchema.parse(DEFAULT_AI_MODELS), DEFAULT_AI_MODELS);
  assert.deepEqual(
    aiModelsSchema.parse({ primary: ' Gemini-2.5-Pro-Preview-05-06 ', fallback: 'gemini-3.1-flash-lite' }),
    { primary: 'gemini-2.5-pro-preview-05-06', fallback: 'gemini-3.1-flash-lite' },
  );
});

test('rejects non-gemini or malformed model ids', () => {
  for (const primary of ['gpt-5', 'gemini-', 'gemini-3.5 flash', 'gemini-3.5/../x', '', 'gemini-' + 'a'.repeat(80)]) {
    assert.equal(aiModelsSchema.safeParse({ primary, fallback: DEFAULT_AI_MODELS.fallback }).success, false, primary);
  }
});
