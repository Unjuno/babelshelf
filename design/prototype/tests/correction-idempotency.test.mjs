import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeStore} from '../src/knowledge-store.ts';
import {prepareCorrection} from '../src/note-corrections.ts';
import {parseStateBackup} from '../src/backup-state.ts';

test('retrying an identical approved correction returns its receipt without another revision',async()=>{
 const store=new KnowledgeStore('correction-idempotency-'+crypto.randomUUID());
 try{
  await store.initialize([{id:'one',path:'Notes/a.md',body:'red box',version:1,history:[]}]);
  const original=(await store.all())[0],proposal=prepareCorrection(original,'Make it blue',JSON.stringify({action:'replace',find:'red',with:'blue'}));
  const pending=await store.stageCorrection(proposal,'turn-one');
  const first=await store.approveCorrection(proposal,pending),second=await store.approveCorrection(proposal,pending);
  assert.deepEqual(second,first);
  assert.equal((await store.all())[0].revisions.length,2);
  const changed={...proposal,request:'Different request'};
  await assert.rejects(store.approveCorrection(changed),/already applied|conflict/i);
  assert.equal((await store.all())[0].revisions.length,2);
  const restored=await parseStateBackup(JSON.stringify(await store.backup()));
  assert.ok(restored.runs.some(item=>item.value.id===first.id));
  await store.revertCorrection(first.id);
  const undone=await store.approveCorrection(proposal,pending);
  assert.equal(undone.status,'undone');
  assert.equal((await store.all())[0].revisions.length,3);
 }finally{store.close();}
});

test('concurrent approvals of the same proposal commit only once',async()=>{
 const store=new KnowledgeStore('correction-concurrent-'+crypto.randomUUID());
 try{
  await store.initialize([{id:'one',path:'Notes/a.md',body:'red box',version:1,history:[]}]);
  const original=(await store.all())[0],proposal=prepareCorrection(original,'Make it blue',JSON.stringify({action:'replace',find:'red',with:'blue'}));
  const pending=await store.stageCorrection(proposal,'turn-one');
  const [first,second]=await Promise.all([store.approveCorrection(proposal,pending),store.approveCorrection(proposal,pending)]);
  assert.deepEqual(second,first);assert.equal((await store.all())[0].revisions.length,2);
 }finally{store.close();}
});

test('old receipts without proposal hashes are retained but never used as proof of an identical retry',async()=>{
 const store=new KnowledgeStore('correction-legacy-'+crypto.randomUUID());
 try{
  await store.initialize([{id:'one',path:'Notes/a.md',body:'red box',version:1,history:[]}]);
  const original=(await store.all())[0],proposal=prepareCorrection(original,'Make it blue',JSON.stringify({action:'replace',find:'red',with:'blue'}));
  const first=await store.approveCorrection(proposal),legacy={...first};delete legacy.proposalHash;
  const db=await store.open();await new Promise((resolve,reject)=>{const tx=db.transaction('runs','readwrite');tx.objectStore('runs').put(legacy,'ui-v1-correction-'+first.id);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
  await assert.rejects(store.approveCorrection(proposal),/already applied/);
  assert.equal((await store.all())[0].revisions.length,2);
  await parseStateBackup(JSON.stringify(await store.backup()));
 }finally{store.close();}
});
