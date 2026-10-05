import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChatPrompt, canSubmitAiPrompt, getImageErrorMessage } from '../lib/screens/aiWorkspace';

test('AI composer blocks empty, one-character and duplicate in-flight submissions', () => {
  assert.equal(canSubmitAiPrompt('  ', false), false);
  assert.equal(canSubmitAiPrompt(' a ', false), false);
  assert.equal(canSubmitAiPrompt('Explain my notes', true), false);
  assert.equal(canSubmitAiPrompt(' Explain my notes ', false), true);
});

test('review mode carries the source-grounding request into chat', () => {
  assert.equal(buildChatPrompt('study', '  chapter 3  '), 'Create grounded study material from my notes: chapter 3');
  assert.equal(buildChatPrompt('ask', '  Explain my notes  '), 'Explain my notes');
});


test('AI error guidance never exposes backend URLs or raw exceptions', () => {
  assert.match(getImageErrorMessage(new Error('[TIMEOUT] backend http://internal.test:8000 unreachable')), /Check your internet/);
  assert.match(getImageErrorMessage(new Error('[AUTH_REQUIRED] token missing')), /sign in/);
  assert.match(getImageErrorMessage(new Error('[HTTP_429] quota')), /Give Momo a moment/);
  assert.equal(getImageErrorMessage(new Error('Traceback SQL database password unavailable')), 'Momo could not create that image right now. Please try again.');
});
