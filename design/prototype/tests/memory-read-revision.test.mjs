import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {definition,run} from '../src/tools/memory.read/tool.ts';
import {resolveToolNotes} from '../src/tools/tool-host.ts';
import {validateToolArguments} from '../src/tools/tool-input.ts';
import {knownPackageBodies} from '../src/builtin-package-previous.ts';
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

test('known prior reader files migrate once while modified user text is retained',async()=>{
 const store=new KnowledgeStore('reader-upgrade-'+crypto.randomUUID());
 const seeds=await Promise.all(['SKILL.md','tool.ts'].map(async name=>({id:`builtin-package-memory.read/${name}`,path:`Tools/memory.read/${name}`,body:await readFile(new URL(`../src/tools/memory.read/${name}`,import.meta.url),'utf8'),protected:true})));
 const previous=seeds.map(seed=>({...seed,body:knownPackageBodies[seed.id].at(-1)}));
 try{
  await store.initialize(previous);await store.initialize(seeds);const records=await store.all();
  for(const seed of seeds){const item=records.find(note=>note.id===seed.id);assert.equal(item.revisions.length,2);assert.equal(item.revisions[0].body,previous.find(old=>old.id===seed.id).body);assert.equal(item.revisions[1].body,seed.body);}
  await store.initialize(seeds);assert.deepEqual(await store.all(),records);
 }finally{store.close();}
 const edited=new KnowledgeStore('reader-edited-'+crypto.randomUUID()),changed=previous.map(seed=>({...seed,body:seed.body+'\nUser change'}));
 try{await edited.initialize(changed);await edited.initialize(seeds);for(const item of await edited.all())assert.equal(item.revisions.length,1);}finally{edited.close();}
});
