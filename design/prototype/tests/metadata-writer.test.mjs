import test from 'node:test';
import assert from 'node:assert/strict';
import {MetadataWriter} from '../src/metadata-writer.ts';
test('hydration and recovered display state never write or overwrite newer other-tab metadata',async()=>{
 const writes=[],writer=new MetadataWriter(async(before,next)=>writes.push({before,next}));
 writer.hydrate(['stored'],['stored','recovered']);await writer.save(['stored','recovered']);await writer.flush();assert.deepEqual(writes,[]);
});
test('explicit metadata changes serialize compare-and-swap against the last committed value',async()=>{
 const writes=[],writer=new MetadataWriter(async(before,next)=>writes.push({before,next}));writer.hydrate(undefined,[]);
 await Promise.all([writer.save(['A']),writer.save(['A','B'])]);await writer.flush();assert.deepEqual(writes,[{before:undefined,next:['A']},{before:['A'],next:['A','B']}]);
});
test('metadata conflict surfaces and blocks subsequent queued writes until fresh hydration',async()=>{
 let local=['other-tab'];const writer=new MetadataWriter(async(before,next)=>{if(JSON.stringify(local)!==JSON.stringify(before))throw Error('Conflict');local=next;});writer.hydrate([],[]);
 await assert.rejects(writer.save(['stale']),/Conflict/);await assert.rejects(writer.flush(),/Conflict/);await assert.rejects(writer.save(['still stale']),/Conflict/);assert.deepEqual(local,['other-tab']);
 writer.hydrate(local,local);await writer.save(['explicit refreshed edit']);assert.deepEqual(local,['explicit refreshed edit']);
});
