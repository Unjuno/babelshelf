import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPinnedFileSnapshots} from '../dist/pinned-file-snapshots.js';

async function digest(file){return createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex');}

test('same immutable OPFS File snapshot and pin avoid a duplicate full-file hash',async()=>{
 const file=new File(['verified model bytes'],'model.gguf'),expected={bytes:file.size,sha256:await digest(file)};let reads=0,hashes=0;
 const cache=createPinnedFileSnapshots({read:async()=>{reads++;return file;},hash:async value=>{hashes++;return digest(value);}});
 assert.equal(await cache.verify(expected.sha256,expected),file);
 assert.equal(await cache.verify(expected.sha256,expected),file);
 assert.equal(reads,1);assert.equal(hashes,1);
});

test('replacement snapshots and changed pins are fully reverified and tampering is refused',async()=>{
 const original=new File(['original'],'model.gguf'),changed=new File(['tampered'],'model.gguf');let current=original,hashes=0;
 const expected={bytes:original.size,sha256:await digest(original)};
 const cache=createPinnedFileSnapshots({read:async()=>current,hash:async value=>{hashes++;return digest(value);}});
 await cache.verify('model',expected);current=changed;cache.invalidate('model');
 await assert.rejects(cache.verify('model',expected),/integrity mismatch/);
 assert.equal(hashes,2);
});

test('the snapshot cache is bounded and preserves the most recently used model and runtime files',async()=>{
 const files=new Map(['a','b','c'].map(id=>[id,new File([id],id+'.gguf')])),reads=[];
 const cache=createPinnedFileSnapshots({read:async id=>{reads.push(id);return files.get(id);},hash:digest});
 const a=await cache.get('a'),b=await cache.get('b');assert.equal(await cache.get('a'),a);
 await cache.get('c');assert.equal(await cache.get('a'),a);
 await cache.get('b');
 assert.deepEqual(reads,['a','b','c','b']);
});
