import test from 'node:test';import assert from 'node:assert/strict';
import {createReviewedFileSaver} from '../src/reviewed-file-save.ts';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('reviewed file save excludes duplicate submissions through commit and acknowledgement',async()=>{
 const saver=createReviewedFileSaver(),commit=deferred(),ack=deferred(),entered=deferred();let writes=0,acks=0;
 const first=saver.save(async()=>{writes++;return commit.promise;},async n=>{acks++;assert.equal(n.body,'Exact 日本語\r\nbody');entered.resolve();return ack.promise;});
 assert.equal(saver.busy,true);assert.equal(await saver.save(async()=>{writes++;},async()=>{}),undefined);
 commit.resolve({id:'one',body:'Exact 日本語\r\nbody'});await entered.promise;assert.equal(saver.busy,true);
 assert.equal(await saver.save(async()=>{writes++;},async()=>{}),undefined);ack.resolve();const result=await first;
 assert.equal(result.note.id,'one');assert.equal(writes,1);assert.equal(acks,1);assert.equal(saver.busy,false);
});
test('post-commit acknowledgement failure returns committed identity without retrying creation',async()=>{
 const saver=createReviewedFileSaver();let writes=0;const n={id:'saved',body:'Previously generated exact answer'};
 const result=await saver.save(async()=>{writes++;return n;},async()=>{throw Error('Conversation changed');});
 assert.equal(result.note,n);assert.equal(result.acknowledgementError,'Conversation changed');assert.equal(writes,1);assert.equal(saver.busy,false);
 const empty=await saver.save(async()=>n,async()=>{throw Error('');});assert.equal(empty.acknowledgementError,'');assert.ok(Object.hasOwn(empty,'acknowledgementError'));
});
test('failed commit preserves failure and releases the lock without acknowledging a nonexistent note',async()=>{
 const saver=createReviewedFileSaver();let acks=0;await assert.rejects(saver.save(async()=>{throw Error('Storage conflict');},async()=>{acks++;}),/Storage conflict/);
 assert.equal(acks,0);assert.equal(saver.busy,false);assert.equal((await saver.save(async()=>({id:'later'}),async()=>{})).note.id,'later');
});
