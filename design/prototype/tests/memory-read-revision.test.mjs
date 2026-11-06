import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {definition,run} from '../src/tools/memory.read/tool.ts';
import {resolveToolNotes} from '../src/tools/tool-host.ts';
import {validateToolArguments} from '../src/tools/tool-input.ts';
import {KnowledgeStore} from '../src/knowledge-store.ts';

test('a continued read detects a changed revision instead of combining versions',async()=>{
 let notes=[{id:'one',path:'Notes/one.md',version:1,body:'Original text'}];
 const host={check(){},resolve:async query=>resolveToolNotes(notes,query)};
 const first=await run({query:'one',start:0,length:8},host);assert.equal(first[0].version,1);
 assert.equal((await run({query:'one',start:8,length:4,expectedRevision:1},host))[0].body,' tex');
 notes=[{...notes[0],version:2,body:'Updated text'}];
 await assert.rejects(run({query:'one',start:8,length:4,expectedRevision:first[0].version},host),/revision.*changed/i);
 notes=[];await assert.rejects(run({query:'one',expectedRevision:1},host),/revision.*changed/i);
});

test('registered schema accepts the revision check and rejects malformed versions',()=>{
 assert.deepEqual(validateToolArguments(definition.inputSchema,{query:'one',expectedRevision:2}),{query:'one',expectedRevision:2});
 assert.throws(()=>validateToolArguments(definition.inputSchema,{query:'one',expectedRevision:0}));
});

test('saved reader package text and its revisions are retained across bundled source changes',async()=>{
 const name='reader-upgrade-'+crypto.randomUUID(),store=new KnowledgeStore(name);
 const seeds=await Promise.all(['SKILL.md','tool.ts'].map(async name=>({id:`builtin-package-memory.read/${name}`,path:`Tools/memory.read/${name}`,body:await readFile(new URL(`../src/tools/memory.read/${name}`,import.meta.url),'utf8'),protected:true})));
 const previous=seeds.map(seed=>({...seed,body:seed.body+'\nUser revision.'}));
 try{
  await store.initialize(previous);const before=await store.all();await store.initialize(seeds);const after=await store.all();
  for(const seed of seeds){const item=after.find(note=>note.id===seed.id);assert.deepEqual(item,before.find(note=>note.id===seed.id));assert.equal(item.revisions[0].body,previous.find(old=>old.id===seed.id).body);}
 }finally{store.close();await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=resolve;request.onerror=()=>reject(request.error);});}
});
