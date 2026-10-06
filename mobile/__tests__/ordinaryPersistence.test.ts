import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDatabase } from '../lib/storage/localDb';
import { createSqliteAccountStore, type SqlConnection } from '../lib/storage/sqliteAccountStore';
import { SyncEngine } from '../lib/sync/syncEngine';
import type { SyncEvent } from '../types';
import type { SyncResponse } from '../lib/api/sync';
import { buildSampleDeck } from '../lib/data/sampleDeck';

const noPreviews = {list:async()=>[],save:async()=>{},remove:async()=>{}};
function connection(db: DatabaseSync): SqlConnection {
  return {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql,...args) { return db.prepare(sql).run(...args); },
    async getAllAsync<T>(sql:string,...args:string[]) { return db.prepare(sql).all(...args) as T[]; },
    async withExclusiveTransactionAsync(task) {
      db.exec('BEGIN IMMEDIATE');
      try { await task(connection(db)); db.exec('COMMIT'); }
      catch(error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}
function fixture() {
  const directory=mkdtempSync(join(tmpdir(),'momo-local-'));
  const path=join(directory,'study.sqlite');
  const handles: DatabaseSync[]=[];
  function restart() {
    while (handles.length) handles.pop()!.close();
    const sqlite=new DatabaseSync(path); handles.push(sqlite);
    return new LocalDatabase(noPreviews,createSqliteAccountStore(async()=>connection(sqlite)));
  }
  return {restart,close:()=>{handles.forEach(db=>db.close());rmSync(directory,{recursive:true,force:true});}};
}
function deck(owner:string) {
  const preview=buildSampleDeck({studyTrack:'general'});
  return {...preview,set:{...preview.set,id:randomUUID(),user_id:owner,generation_config:{}},
    items:preview.items.map(item=>({...item,id:randomUUID()}))};
}
function event(): SyncEvent { return {event_id:randomUUID(),result:'correct',occurred_at:new Date().toISOString()}; }
function ack(events:SyncEvent[]):SyncResponse {return {synced_ids:events.map(e=>e.event_id),accepted_count:events.length,ignored_duplicates_count:0,ignored_duplicates:0,processed_at:new Date().toISOString()};}

test('ordinary SQLite sets, folders and queue survive close/reopen and account switching isolates records',async()=>{
  const f=fixture();
  try {
    const first=f.restart(), owner=randomUUID(), other=randomUUID();
    const data=deck(owner);data.items=data.items.map(item=>({...item,study_set_id:data.set.id}));
    await assert.rejects(first.saveStudySet(data.set,data.items),/verified account/);
    first.bindVerifiedAccount(owner);
    await first.saveStudySet(data.set,data.items);
    const folder={id:randomUUID(),user_id:owner,name:'Biology',reviewer_count:0,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    await first.saveFolder(folder);await first.updateStudySetFolder(data.set.id,folder.id);
    const pending=event();await first.enqueueSyncEvent(pending);
    const reopened=f.restart();reopened.bindVerifiedAccount(owner);
    assert.equal((await reopened.getStudySet(data.set.id))?.folder_id,folder.id);
    assert.deepEqual(await reopened.getStudyItems(data.set.id),data.items);
    assert.deepEqual(await reopened.getPendingSyncEvents(),[pending]);
    assert.equal((await reopened.listFolders())[0].reviewer_count,1);
    reopened.bindVerifiedAccount(other);
    assert.deepEqual(await reopened.listStudySets(),[]);assert.deepEqual(await reopened.getPendingSyncEvents(),[]);
    await assert.rejects(reopened.saveStudySet(data.set,data.items),/belong/);
    reopened.bindVerifiedAccount(owner);await reopened.deleteFolder(folder.id);
    assert.equal((await reopened.getStudySet(data.set.id))?.folder_id,null);
    assert.equal((await reopened.getStudyItems(data.set.id)).length,data.items.length);
    reopened.bindVerifiedAccount(null);assert.deepEqual(await reopened.listStudySets(),[]);
  } finally {f.close();}
});

test('101 events batch at 100, exact acknowledgments retain unacked work across restart',async()=>{
  const f=fixture();try {
    const db=f.restart(),owner=randomUUID();db.bindVerifiedAccount(owner);
    const events=Array.from({length:101},event);
    for (const e of events) await db.enqueueSyncEvent(e);
    const sizes:number[]=[];
    const engine=new SyncEngine(db,async batch=>{sizes.push(batch.length);return ack(batch.length===100?batch.slice(0,99):batch);});
    await Promise.all([engine.flushSyncQueue(),engine.flushSyncQueue()]);
    assert.deepEqual(sizes,[100,1]);assert.deepEqual(await db.getPendingSyncEvents(),[events[99]]);
    const restarted=f.restart();restarted.bindVerifiedAccount(owner);
    await new SyncEngine(restarted,async batch=>ack(batch)).flushSyncQueue();
    assert.deepEqual(await restarted.getPendingSyncEvents(),[]);
  }finally{f.close();}
});

test('lost response and unknown acknowledgments retain events; switching account during response cannot remove either queue',async()=>{
  const f=fixture();try {
    const db=f.restart(),owner=randomUUID(),other=randomUUID();db.bindVerifiedAccount(owner);
    const e=event();await db.enqueueSyncEvent(e);
    await assert.rejects(new SyncEngine(db,async()=>{throw new Error('lost response');}).flushSyncQueue());
    assert.deepEqual(await db.getPendingSyncEvents(),[e]);
    await assert.rejects(new SyncEngine(db,async batch=>({...ack(batch),synced_ids:[randomUUID()]})).flushSyncQueue({force:true}),/unknown event/);
    await assert.rejects(new SyncEngine(db,async batch=>{db.bindVerifiedAccount(other);await db.enqueueSyncEvent(event());return ack(batch);}).flushSyncQueue({force:true}),/Account changed/);
    assert.equal((await db.getPendingSyncEvents()).length,1);
    db.bindVerifiedAccount(owner);assert.deepEqual(await db.getPendingSyncEvents(),[e]);
    await new SyncEngine(db,async batch=>({...ack(batch),accepted_count:0,ignored_duplicates:1,ignored_duplicates_count:1})).flushSyncQueue({force:true});
    assert.deepEqual(await db.getPendingSyncEvents(),[]);
  }finally{f.close();}
});

test('SQLite rejects future schema and corrupt JSON without returning trusted study data',async()=>{
  const sqlite=new DatabaseSync(':memory:');
  try {
    sqlite.exec('PRAGMA user_version=99');
    const store=createSqliteAccountStore(async()=>connection(sqlite));
    await assert.rejects(store.list(randomUUID(),'set'),/newer app/);
    sqlite.exec('PRAGMA user_version=0');
    const good=createSqliteAccountStore(async()=>connection(sqlite)),owner=randomUUID();
    await good.write(owner,[{kind:'set',id:'set',data:{}}]);
    sqlite.exec("UPDATE account_records SET data='invalid JSON'");
    await assert.rejects(good.list(owner,'set'),/corrupt/);
  }finally{sqlite.close();}
});


test('a failed SQLite card write rolls back its set and duplicate events preserve the original payload',async()=>{
  const sqlite=new DatabaseSync(':memory:');
  try {
    const store=createSqliteAccountStore(async()=>connection(sqlite)), owner=randomUUID();
    await store.list(owner,'set');
    sqlite.exec("CREATE TRIGGER reject_items BEFORE INSERT ON account_records WHEN NEW.kind='items' BEGIN SELECT RAISE(ABORT,'disk failure simulation'); END;");
    const db=new LocalDatabase(noPreviews,store);db.bindVerifiedAccount(owner);
    const data=deck(owner);data.items=data.items.map(item=>({...item,study_set_id:data.set.id}));
    await assert.rejects(db.saveStudySet(data.set,data.items),/disk failure simulation/);
    assert.deepEqual(await db.listStudySets(),[]);
    const original=event();await db.enqueueSyncEvent(original);
    await db.enqueueSyncEvent({...original,result:'incorrect'});
    assert.deepEqual(await db.getPendingSyncEvents(),[original]);
  }finally{sqlite.close();}
});

for (const operation of ['updateFolder','updateSet','deleteFolder'] as const) {
  for (const returnToOriginal of [false,true]) {
    test(`${operation} rejects an account transition after read before write${returnToOriginal?' even A to B to A':''}`,async()=>{
      const writes: unknown[]=[];
      let db:LocalDatabase;
      const owner='owner-a';
      const folder={id:'folder-a',user_id:owner,name:'Private A',reviewer_count:1,created_at:'2026-10-06T00:00:00Z',updated_at:'2026-10-06T00:00:00Z'};
      const set={id:'set-a',user_id:owner,title:'Private A deck',folder_id:folder.id,item_count:0,created_at:'2026-10-06T00:00:00Z',updated_at:'2026-10-06T00:00:00Z'};
      const store:import('../lib/storage/accountStore.types').AccountStore={
        async list(_owner,kind) {
          queueMicrotask(()=>queueMicrotask(()=>{
            db.bindVerifiedAccount('owner-b');
            if(returnToOriginal) db.bindVerifiedAccount(owner);
          }));
          return [{kind,id:kind==='folder'?folder.id:set.id,data:kind==='folder'?folder:set}];
        },
        async write(writtenOwner,changes) {writes.push({owner:writtenOwner,changes});},
      };
      db=new LocalDatabase(noPreviews,store);db.bindVerifiedAccount(owner);
      const mutation=operation==='updateFolder'?db.updateFolder(folder.id,{name:'Renamed'}):
        operation==='updateSet'?db.updateStudySetTitle(set.id,'Renamed'):db.deleteFolder(folder.id);
      await assert.rejects(mutation,/Account changed/);
      assert.deepEqual(writes,[]);
    });
  }
}

test('well formed JSON with missing study identity or malformed event fields fails closed',async()=>{
  const sqlite=new DatabaseSync(':memory:');try {
    const store=createSqliteAccountStore(async()=>connection(sqlite)),owner=randomUUID();
    const db=new LocalDatabase(noPreviews,store);db.bindVerifiedAccount(owner);
    await store.write(owner,[{kind:'items',id:'set-a',data:[{study_set_id:'set-a',question:'Q',answer:'A'}]}]);
    await assert.rejects(db.getStudyItems('set-a'),/corrupt/);
    const original=event();
    for(const malformed of [
      {...original,result:'invented'}, {...original,occurred_at:'not-a-time'},
      {...original,study_item_id:'not-an-id'}, {...original,event_id:'undefined'},
    ]) {
      sqlite.exec("DELETE FROM account_records WHERE kind='event'");
      await store.write(owner,[{kind:'event',id:malformed.event_id,data:malformed}]);
      await assert.rejects(db.getPendingSyncEvents(),/corrupt/);
      await assert.rejects(db.enqueueSyncEvent(malformed as SyncEvent),/invalid/);
    }
  }finally{sqlite.close();}
});

test('valid API-shaped nullable flashcard fields persist and remain readable',async()=>{
  const f=fixture();try {
    const db=f.restart(),owner=randomUUID();db.bindVerifiedAccount(owner);
    const data=deck(owner);
    const item={...data.items[0],study_set_id:data.set.id,type:'flashcard',options:null,explanation:null,hint:null,image_base64:null};
    const set={...data.set,item_count:1};
    await db.saveStudySet(set,[item as unknown as import('../types').StudyItem]);
    assert.deepEqual(await db.getStudyItems(set.id),[item]);
  }finally{f.close();}
});

test('legacy explanation items restore through canonical topic explanation without changing persisted JSON',async()=>{
  const sqlite=new DatabaseSync(':memory:');try {
    const store=createSqliteAccountStore(async()=>connection(sqlite)),owner=randomUUID();
    const db=new LocalDatabase(noPreviews,store);db.bindVerifiedAccount(owner);
    const data=deck(owner),legacy={...data.items[0],study_set_id:data.set.id,type:'explanation'};
    await store.write(owner,[{kind:'set',id:data.set.id,data:data.set},{kind:'items',id:data.set.id,data:[legacy]}]);
    assert.equal((await db.getStudyItems(data.set.id))[0].type,'topic_explanation');
    assert.equal(((await store.list(owner,'items'))[0].data as {type:string}[])[0].type,'explanation');
    assert.equal((await db.getStudySet(data.set.id))?.id,data.set.id);
  }finally{sqlite.close();}
});

test('set and folder restoration validates UI fields while preserving nullable API fields and unknown extras',async()=>{
  const sqlite=new DatabaseSync(':memory:');try {
    const store=createSqliteAccountStore(async()=>connection(sqlite)),owner=randomUUID();
    const db=new LocalDatabase(noPreviews,store);db.bindVerifiedAccount(owner);
    const data=deck(owner),set={...data.set,document_id:null,folder_id:null,description:null,generation_config:null,future_field:'retained'};
    await store.write(owner,[{kind:'set',id:set.id,data:set}]);
    assert.deepEqual(await db.getStudySet(set.id),set);
    for(const change of [{title:{}},{item_count:'many'},{updated_at:'invalid'},{generation_config:[]}]) {
      await store.write(owner,[{kind:'set',id:set.id,data:{...set,...change}}]);
      await assert.rejects(db.listStudySets(),/corrupt/);
    }
    await store.write(owner,[{kind:'set',id:set.id,data:set}]);
    const folder={id:randomUUID(),user_id:owner,name:'Biology',color:null,reviewer_count:0,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),future_field:'retained'};
    await store.write(owner,[{kind:'folder',id:folder.id,data:folder}]);
    assert.deepEqual(await db.getFolder(folder.id),folder);
    for(const change of [{name:{}},{reviewer_count:-1},{created_at:'invalid'},{color:{}}]) {
      await store.write(owner,[{kind:'folder',id:folder.id,data:{...folder,...change}}]);
      await assert.rejects(db.listFolders(),/corrupt/);
    }
  }finally{sqlite.close();}
});

test('saving a legacy explanation copies the canonical alias without mutating caller data',async()=>{
  const f=fixture();try {
    const db=f.restart(),owner=randomUUID();db.bindVerifiedAccount(owner);
    const data=deck(owner),legacy={...data.items[0],study_set_id:data.set.id,type:'explanation'};
    await db.saveStudySet({...data.set,item_count:1},[legacy as unknown as import('../types').StudyItem]);
    assert.equal(legacy.type,'explanation');
    assert.equal((await db.getStudyItems(data.set.id))[0].type,'topic_explanation');
  }finally{f.close();}
});
