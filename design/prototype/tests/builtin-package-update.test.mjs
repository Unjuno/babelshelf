import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createNote} from '../../../dist/core.js';
import {builtinToolUpdates} from '../src/builtin-updates.ts';
import {knownPackageBodies} from '../src/builtin-package-previous.ts';
import {KnowledgeStore} from '../src/knowledge-store.ts';

test('only exact known protected skill revisions migrate and retain their prior bytes',()=>{
 for(const [id,oldBodies] of Object.entries(knownPackageBodies))for(const old of oldBodies){
  const path='Tools/'+id.slice('builtin-package-'.length),seed={id,path,body:'New app-owned guidance',protected:true};
  const note={...createNote({path,body:old}),id,ui:{protected:true,managed:false}};
  const updates=builtinToolUpdates([note],[seed]);
  assert.equal(updates.length,1);assert.equal(updates[0].revisions[0].body,old);assert.equal(updates[0].revisions[1].body,seed.body);
  assert.deepEqual(builtinToolUpdates([updates[0]],[seed]),[]);
  const altered={...note,revisions:[{...note.revisions[0],body:old+' user text'}]};
  assert.deepEqual(builtinToolUpdates([altered],[seed]),[]);
  assert.deepEqual(builtinToolUpdates([note],[{...seed,path:'Tools/other.md'}]),[]);
 }
});

test('initialization upgrades known skill records once and leaves unrelated records untouched',async()=>{
 const name='builtin-skills-'+crypto.randomUUID(),store=new KnowledgeStore(name);
 const seeds=await Promise.all(['read','search'].map(async kind=>({id:`builtin-package-memory.${kind}/SKILL.md`,path:`Tools/memory.${kind}/SKILL.md`,body:await readFile(new URL(`../src/tools/memory.${kind}/SKILL.md`,import.meta.url),'utf8'),protected:true})));
 const previous=seeds.map(seed=>({...seed,body:knownPackageBodies[seed.id].at(-1)}));
 const user={id:'user-note',path:'Notes/user.md',body:'Keep original',version:1,history:[]};
 try{
  await store.initialize([...previous,user]);await store.initialize([...seeds,user]);
  const first=await store.all();
  for(const seed of seeds){const note=first.find(item=>item.id===seed.id);assert.equal(note.revisions.length,2);assert.equal(note.revisions[0].body,previous.find(item=>item.id===seed.id).body);assert.equal(note.revisions[1].body,seed.body);}
  assert.equal(first.find(item=>item.id===user.id).revisions[0].body,user.body);
  await store.initialize([...seeds,user]);assert.deepEqual(await store.all(),first);
 }finally{store.close();await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=resolve;request.onerror=()=>reject(request.error);});}
});

test('concurrent initializations append a known skill revision only once',async()=>{
 const name='builtin-skill-concurrent-'+crypto.randomUUID(),first=new KnowledgeStore(name),second=new KnowledgeStore(name);
 const id='builtin-package-memory.read/SKILL.md',path='Tools/memory.read/SKILL.md';
 const body=await readFile(new URL('../src/tools/memory.read/SKILL.md',import.meta.url),'utf8');
 const seed={id,path,body,protected:true},old=knownPackageBodies[id][1];
 try{
  await first.initialize([{...seed,body:old}]);
  await Promise.all([first.initialize([seed]),second.initialize([seed])]);
  const note=(await second.all()).find(item=>item.id===id);
  assert.equal(note.revisions.length,2);assert.equal(note.revisions[0].body,old);assert.equal(note.revisions[1].body,body);
 }finally{first.close();second.close();await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=resolve;request.onerror=()=>reject(request.error);});}
});
