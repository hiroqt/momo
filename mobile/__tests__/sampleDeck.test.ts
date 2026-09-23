import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSampleDeck, seedSampleDeck } from '../lib/data/sampleDeck';
import { localDb } from '../lib/storage/localDb';

test('starter deck matches a nursing choice and college year', () => {
  const first = buildSampleDeck({ studyTrack: 'college', collegeYear: '1st Year', collegeCourse: 'BS Nursing' });
  const senior = buildSampleDeck({ studyTrack: 'college', collegeYear: '4th Year', collegeCourse: 'BS Nursing' });
  assert.match(first.set.title, /Nursing.*1st Year/);
  assert.equal(first.set.item_count, first.items.length);
  assert.ok(first.items.some((item) => item.question.includes('patient assessment')));
  assert.ok(senior.items.some((item) => item.question.includes('reassessed')));
  assert.notEqual(first.set.id, senior.set.id);
  assert.ok(first.items.every((item) => Object.keys(item.source_metadata).length === 0));
});

test('high school grade changes card depth', () => {
  const grade9 = buildSampleDeck({ studyTrack: 'high_school', highSchoolGrade: 'Grade 9' });
  const grade12 = buildSampleDeck({ studyTrack: 'high_school', highSchoolGrade: 'Grade 12' });
  assert.match(grade9.set.title, /Mathematics.*Grade 9/);
  assert.ok(grade9.items.some((item) => item.question.includes('2x + 3')));
  assert.ok(grade12.items.some((item) => item.question.includes('derivative')));
});

test('unknown interests receive an honestly labeled study-skills preview', async () => {
  const profile = { studyTrack: 'general' as const, collegeCourse: 'Ancient History' };
  const set = await seedSampleDeck(profile);
  assert.match(set.title, /Ancient History Study Skills/);
  assert.match(set.description || '', /Curated preview/);
  assert.equal((await localDb.getStudyItems(set.id)).length, set.item_count);
});
