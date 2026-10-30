import 'fake-indexeddb/auto';
import test from 'node:test';import assert from 'node:assert/strict';
import {setBuiltinToolEnabled} from '../src/builtin-tool-preferences.ts';
import {initialPreferenceNotes,readPreference,updatePreference} from '../src/preference-records.ts';
import {KnowledgeStore} from '../src/knowledge-store.ts';

test('explicit tool toggle retains profile data and records a reversible settings revision',()=>{
 const notes=structuredClone(initialPreferenceNotes),prior=readPreference('harness',notes);
 prior.profiles[0].enabledTools=prior.profiles[0].enabledTools.filter(id=>id!=='time.now');
 const before=updatePreference('harness',notes,()=>prior),record=before.find(n=>n.id==='settings-harness');
 const after=updatePreference('harness',before,current=>setBuiltinToolEnabled(current,'standard','time.now',true));
 const value=readPreference('harness',after),updated=after.find(n=>n.id==='settings-harness');
 assert.ok(value.profiles[0].enabledTools.includes('time.now'));assert.deepEqual(value.profiles.slice(1),prior.profiles.slice(1));
 assert.equal(updated.version,record.version+1);assert.equal(updated.history.at(-1),record.body);
});
test('stale profile, zero-call profile and last-tool removal cannot silently alter settings',()=>{
 const value=readPreference('harness',structuredClone(initialPreferenceNotes));
 assert.equal(setBuiltinToolEnabled(value,'old','time.now',false),value);
 const zero={...value,activeProfileId:'conversation'};assert.equal(setBuiltinToolEnabled(zero,'conversation','time.now',true),zero);
 const only={...value,profiles:value.profiles.map(p=>p.id==='standard'?{...p,enabledTools:['time.now']}:p)};
 assert.equal(setBuiltinToolEnabled(only,'standard','time.now',false),only);
});
test('tool preference survives a store reopen with prior settings revision intact',async()=>{
 const name='tool-preference-'+crypto.randomUUID(),store=new KnowledgeStore(name);
 try{
  await store.initialize(structuredClone(initialPreferenceNotes));
  const before=await store.views(),old=before.find(note=>note.id==='settings-harness');
  const withoutClock=updatePreference('harness',before,value=>setBuiltinToolEnabled(value,'standard','time.now',false));
  await store.commit(before,withoutClock);
  store.close();
  const reopened=new KnowledgeStore(name);
  try{
   const saved=await reopened.views(),record=saved.find(note=>note.id==='settings-harness');
   assert.equal(readPreference('harness',saved).profiles.find(profile=>profile.id==='standard').enabledTools.includes('time.now'),false);
   assert.equal(record.version,old.version+1);
   assert.equal(record.history.at(-1),old.body);
   assert.deepEqual(readPreference('harness',saved).profiles.slice(1),readPreference('harness',before).profiles.slice(1));
  }finally{reopened.close();}
 }finally{store.close();await new Promise((resolve,reject)=>{const req=indexedDB.deleteDatabase(name);req.onsuccess=resolve;req.onerror=()=>reject(req.error);});}
});
test('a stale tool-setting change cannot overwrite another tab’s committed preference',async()=>{
 const name='tool-conflict-'+crypto.randomUUID(),first=new KnowledgeStore(name),second=new KnowledgeStore(name);
 try{
  await first.initialize(structuredClone(initialPreferenceNotes));await second.initialize(structuredClone(initialPreferenceNotes));
  const a=await first.views(),b=await second.views();
  const firstEdit=updatePreference('harness',a,value=>setBuiltinToolEnabled(value,'standard','time.now',false));
  const staleEdit=updatePreference('harness',b,value=>setBuiltinToolEnabled(value,'standard','math.calculate',false));
  await first.commit(a,firstEdit);
  await assert.rejects(second.commit(b,staleEdit),/conflict|changed/i);
  const saved=await second.views(),tools=readPreference('harness',saved).profiles.find(profile=>profile.id==='standard').enabledTools;
  assert.equal(tools.includes('time.now'),false);assert.equal(tools.includes('math.calculate'),true);
 }finally{first.close();second.close();await new Promise((resolve,reject)=>{const req=indexedDB.deleteDatabase(name);req.onsuccess=resolve;req.onerror=()=>reject(req.error);});}
});
