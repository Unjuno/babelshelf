import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeStore} from '../src/knowledge-store.ts';
import {emptyDialogue,appendTurn} from '../src/conversation.ts';
import {startActivity,finishActivity} from '../src/harness-activity.ts';
import {makeStateBackup,parseStateBackup,planStateRestore} from '../src/backup-state.ts';

test('paged activity storage preserves legacy receipts and survives backup and restore',async()=>{
 const store=new KnowledgeStore('paged-'+crypto.randomUUID()),restored=new KnowledgeStore('paged-restore-'+crypto.randomUUID());
 try{
  const old=finishActivity(startActivity('memory.search',{query:'legacy'}),{output:[]});
  const dialogue=appendTurn(emptyDialogue(),{id:'turn-1',user:'question',activity:[old]});
  await store.compareState('dialogue',undefined,dialogue);
  const items=[];
  for(let i=0;i<35;i++){const started=startActivity('memory.search',{query:`q${i}`});await store.recordTurnActivity('turn-1',started,dialogue);const finished=finishActivity(started,{output:[i]});await store.recordTurnActivity('turn-1',finished,dialogue);items.push(finished);}
  assert.deepEqual(await store.turnActivities('turn-1'),items);assert.deepEqual((await store.getState('dialogue')).turns[0].activity,[old]);
  const snapshot=await store.snapshot();assert.ok(snapshot.runs.filter(r=>r.value?.type==='turn-activity-page').length>1);
  const pack=JSON.stringify(await store.backup());const review=await restored.reviewBackup(pack);await restored.restore(pack,review.expected);
  assert.deepEqual(await restored.turnActivities('turn-1'),items);assert.deepEqual((await restored.getState('dialogue')).turns[0].activity,[old]);
 }finally{store.close();restored.close();}
});

test('concurrent starts and finishes cannot overwrite each other or duplicate a receipt',async()=>{
 const store=new KnowledgeStore('paged-race-'+crypto.randomUUID());
 try{const dialogue=appendTurn(emptyDialogue(),{id:'turn-1',user:'question'});await store.compareState('dialogue',undefined,dialogue);
  const first=startActivity('memory.search',{query:'first'}),second=startActivity('memory.search',{query:'second'});
  await Promise.all([store.recordTurnActivity('turn-1',first,dialogue),store.recordTurnActivity('turn-1',second,dialogue)]);
  const completed=finishActivity(first,{output:[]}),results=await Promise.allSettled([store.recordTurnActivity('turn-1',completed,dialogue),store.recordTurnActivity('turn-1',completed,dialogue)]);
  assert.deepEqual(results.map(r=>r.status).sort(),['fulfilled','rejected']);const records=await store.turnActivities('turn-1');assert.equal(records.length,2);assert.equal(records.find(a=>a.id===first.id).status,'succeeded');assert.equal(records.find(a=>a.id===second.id).status,'running');
 }finally{store.close();}
});

test('a caller cannot change an activity while its storage transaction opens',async()=>{
 const store=new KnowledgeStore('paged-snapshot-'+crypto.randomUUID());
 try{const dialogue=appendTurn(emptyDialogue(),{id:'turn-1',user:'question'});await store.compareState('dialogue',undefined,dialogue);
  const activity=startActivity('memory.search',{query:'original'}),pending=store.recordTurnActivity('turn-1',activity,dialogue);activity.input.query='changed';await pending;
  assert.equal((await store.turnActivities('turn-1'))[0].input.query,'original');
 }finally{store.close();}
});

test('backup rejects missing pages, missing indexes and duplicated inline identities',async()=>{
 const store=new KnowledgeStore('paged-bad-'+crypto.randomUUID());
 try{const dialogue=appendTurn(emptyDialogue(),{id:'turn-1',user:'question'});await store.compareState('dialogue',undefined,dialogue);const a=startActivity('memory.search',{query:'x'});await store.recordTurnActivity('turn-1',a,dialogue);const original=await store.snapshot();
  for(const type of ['turn-activity-page','turn-activity-index']){const broken=structuredClone(original);broken.runs=broken.runs.filter(r=>r.value?.type!==type);await assert.rejects(makeStateBackup(broken),/activity/i);}
  const duplicated=structuredClone(original);duplicated.settings.find(s=>s.key==='ui-v1-dialogue').value.turns[0].activity=[a];await assert.rejects(makeStateBackup(duplicated),/Duplicate activity identity/);
 }finally{store.close();}
});

test('new-only restore cannot attach activity to a conflicting conversation',async()=>{
 const source=new KnowledgeStore('paged-source-'+crypto.randomUUID()),target=new KnowledgeStore('paged-target-'+crypto.randomUUID());
 try{const dialogue=appendTurn(emptyDialogue(),{id:'shared',user:'Original request'});await source.compareState('dialogue',undefined,dialogue);await source.recordTurnActivity('shared',startActivity('memory.search',{query:'private'}),dialogue);
  await target.compareState('dialogue',undefined,appendTurn(emptyDialogue(),{id:'shared',user:'Different request'}));
  const payload=await parseStateBackup(JSON.stringify(await source.backup())),current=await target.snapshot();assert.throws(()=>planStateRestore(current,payload,'new-only'),/conflicting conversation/i);
 }finally{source.close();target.close();}
});

test('activity operations reject missing turns, duplicate starts and conflicting finishes atomically',async()=>{
 const store=new KnowledgeStore('paged-conflict-'+crypto.randomUUID());
 try{const initial=startActivity('memory.search',{query:'test'});await assert.rejects(store.recordTurnActivity('missing',initial,emptyDialogue()),/Turn unavailable/);
  const dialogue=appendTurn(emptyDialogue(),{id:'turn-1',user:'question'});await store.compareState('dialogue',undefined,dialogue);await store.recordTurnActivity('turn-1',initial,dialogue);
  const stale=structuredClone(dialogue);stale.turns[0].user='changed with same revision';await assert.rejects(store.recordTurnActivity('turn-1',startActivity('memory.search',{query:'stale'}),stale),/Conversation changed/);
  await assert.rejects(store.recordTurnActivity('turn-1',initial,dialogue),/already|duplicate/i);
  const finished=finishActivity(initial,{output:[]});await store.recordTurnActivity('turn-1',finished,dialogue);
  await assert.rejects(store.recordTurnActivity('turn-1',finished,dialogue),/already/i);assert.deepEqual(await store.turnActivities('turn-1'),[finished]);
 }finally{store.close();}
});
