import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {KnowledgeStore} from '../src/knowledge-store.ts';
import {builtinToolUpdates} from '../src/builtin-updates.ts';
import {knownPackageBodies} from '../src/builtin-package-previous.ts';

test('known old bundled sources advance with history; modified sources stay untouched',async()=>{
 const name='source-migration-'+crypto.randomUUID(),store=new KnowledgeStore(name);
 const paths=['memory.search/tool.ts','tool-host.ts'];
 const seeds=await Promise.all(paths.map(async path=>({id:'builtin-package-'+path,path:'Tools/'+path,body:await readFile(new URL('../src/tools/'+path,import.meta.url),'utf8'),protected:true})));
 const previous=seeds.map(seed=>({...seed,body:knownPackageBodies[seed.id][0]}));
 try{
  await store.initialize(previous);await store.initialize(seeds);
  const notes=await store.all();
  for(const seed of seeds){const note=notes.find(item=>item.id===seed.id);assert.equal(note.revisions.length,2);assert.equal(note.revisions[0].body,previous.find(item=>item.id===seed.id).body);assert.equal(note.revisions[1].body,seed.body);}
  for(const previousSeed of previous){const changed=notes.find(item=>item.id===previousSeed.id);const custom={...changed,revisions:[{...changed.revisions[0],body:previousSeed.body+'\ncustom'}]};assert.deepEqual(builtinToolUpdates([custom],seeds),[]);}
 }finally{store.close();await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=resolve;request.onerror=()=>reject(request.error);});}
});
