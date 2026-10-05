import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardStudyAction, getWeekDate } from '../lib/screens/dashboardModel';
import type { StudySet } from '../types';
const set = (id: string, count: number): StudySet => ({ id, item_count: count, title: 'Cell biology', user_id: 'u', created_at: '', updated_at: '' });

test('dashboard starts existing local study content even after its source is removed', () => {
  const action = dashboardStudyAction([set('local-deck', 24)]);
  assert.equal(action.route, '/study/local-deck');
  assert.match(action.description, /24 items/);
});
test('dashboard excludes empty sets from its study action and routes new learners to upload', () => {
  assert.equal(dashboardStudyAction([]).route, '/documents/upload');
  assert.equal(dashboardStudyAction([set('pending', 0)]).route, '/documents/upload');
  assert.equal(dashboardStudyAction([set('pending', 0), set('ready', 1)]).route, '/study/ready');
  assert.match(dashboardStudyAction([set('ready', 1)]).description, /1 item to/);
});
test('dashboard calendar aligns with UTC study days across local midnight and year boundary', () => {
  const date = new Date('2026-01-01T00:30:00+08:00');
  assert.deepEqual(getWeekDate(2, date), { date: '2025-12-31', isToday: true });
  assert.deepEqual(getWeekDate(0, date), { date: '2025-12-29', isToday: false });
  assert.deepEqual(getWeekDate(6, date), { date: '2026-01-04', isToday: false });
  assert.throws(() => getWeekDate(7, date), RangeError);
});
