import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSampleDeck } from '../lib/data/sampleDeck';
import { LocalDatabase } from '../lib/storage/localDb';
import type { PreviewStore, StoredPreview } from '../lib/storage/previewStore.types';

function storedPreviews() {
  const records = new Map<string, StoredPreview>();
  let failSave = false;
  const store: PreviewStore = {
    list: async () => structuredClone([...records.values()]),
    save: async (set, items) => {
      if (failSave) throw new Error('Disk write failed');
      records.set(set.id, structuredClone({ set, items }));
    },
    remove: async (id) => { records.delete(id); },
  };
  return { store, failWrites: () => { failSave = true; } };
}

test('a fresh local database restores a renamed preview and its cards; deletion survives another restart', async () => {
  const { store } = storedPreviews();
  const preview = buildSampleDeck({ studyTrack: 'general' });
  const first = new LocalDatabase(store);
  await first.saveStudySet(preview.set, preview.items);
  await first.updateStudySetTitle(preview.set.id, 'My first reviewer');

  const restarted = new LocalDatabase(store);
  assert.equal((await restarted.getStudySet(preview.set.id))?.title, 'My first reviewer');
  assert.deepEqual(await restarted.getStudyItems(preview.set.id), preview.items);
  await restarted.deleteStudySet(preview.set.id);

  const afterDeletion = new LocalDatabase(store);
  assert.deepEqual(await afterDeletion.listStudySets(), []);
  assert.deepEqual(await afterDeletion.getStudyItems(preview.set.id), []);
});

test('a failed persistence write leaves the previously saved title intact', async () => {
  const storage = storedPreviews();
  const preview = buildSampleDeck({ studyTrack: 'general' });
  const database = new LocalDatabase(storage.store);
  await database.saveStudySet(preview.set, preview.items);
  storage.failWrites();
  await assert.rejects(database.updateStudySetTitle(preview.set.id, 'Unsaved title'), /Disk write failed/);
  assert.equal((await database.getStudySet(preview.set.id))?.title, preview.set.title);
});

test('a failed initial read can be retried instead of poisoning local storage', async () => {
  const preview = buildSampleDeck({ studyTrack: 'general' });
  let reads = 0;
  const database = new LocalDatabase({
    list: async () => {
      if (++reads === 1) throw new Error('Temporary read failure');
      return [preview];
    },
    save: async () => {},
    remove: async () => {},
  });
  await assert.rejects(database.listStudySets(), /Temporary read failure/);
  assert.equal((await database.getStudySet(preview.set.id))?.id, preview.set.id);
  await database.getStudyItems(preview.set.id);
  assert.equal(reads, 2);
});
