import test from 'node:test';import assert from 'node:assert/strict';
import {createVerifiedOpfsSnapshotCache} from '../src/verified-opfs-snapshot.ts';
const identity={modelId:'lfm3-1.7b-qad-q4-0',modelRevision:'weights-r1',sha256:'a'.repeat(64),bytes:3};
function fixture(){
 const files=new Map();const directory={async getFileHandle(name,{create=false}={}){if(!files.has(name)&&!create)throw new DOMException('Missing','NotFoundError');return {async getFile(){const file=files.get(name);if(!file)throw new DOMException('Missing','NotFoundError');return file;},async createWritable(){let body='';return {async write(value){body=String(value);},async close(){files.set(name,new File([body],name,{lastModified:1}));},async abort(){}};}};},async removeEntry(name){if(!files.delete(name))throw new DOMException('Missing','NotFoundError');}};return {files,cache:createVerifiedOpfsSnapshotCache(async()=>directory)};
}
test('verified OPFS snapshot markers reuse only the matching identity, size and last-modified snapshot',async()=>{
 const f=fixture(),file=new File([new Uint8Array([1,2,3])],identity.sha256,{lastModified:100});
 assert.equal(await f.cache.isVerified(file,identity),false);
 assert.equal(await f.cache.remember(file,identity),true);
 assert.equal(await f.cache.isVerified(new File([new Uint8Array([1,2,3])],identity.sha256,{lastModified:100}),identity),true);
 assert.equal(await f.cache.isVerified(new File([new Uint8Array([1,2,3])],identity.sha256,{lastModified:101}),identity),false);
 assert.equal(await f.cache.isVerified(new File([new Uint8Array([1,2,3,4])],identity.sha256,{lastModified:100}),identity),false);
 assert.equal(await f.cache.isVerified(file,{...identity,modelRevision:'weights-r2'}),false);
 assert.equal(await f.cache.isVerified(new File([new Uint8Array([1,2,3])],identity.sha256,{lastModified:0}),identity),false);
 assert.equal(await f.cache.forget(identity),true);assert.equal(await f.cache.isVerified(file,identity),false);
});
test('malformed verification markers are treated as cache misses',async()=>{
 const f=fixture(),file=new File([new Uint8Array([1,2,3])],identity.sha256,{lastModified:100}),name=identity.sha256+'.verified-v1.json';
 f.files.set(name,new File(['{"schema":1,"sha256":"wrong"}'],name,{lastModified:1}));
 assert.equal(await f.cache.isVerified(file,identity),false);
});
