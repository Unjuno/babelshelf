import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubmissionController} from '../src/submission-controller.ts';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('one owner rejects overlap until the original work settles, including Stop',async()=>{
 const c=createSubmissionController(),entered=deferred(),exit=deferred();let count=0;
 const first=c.run(async run=>{count++;entered.resolve();await exit.promise;run.check();});await entered.promise;
 assert.equal(c.state.phase,'running');assert.equal(await c.run(async()=>{count++;}),'busy');
 assert.equal(c.stop(),true);assert.equal(c.state.phase,'stopping');assert.equal(await c.run(async()=>{count++;}),'busy');
 exit.resolve();assert.equal(await first,'cancelled');assert.equal(count,1);assert.equal(c.state.phase,'cancelled');assert.equal(c.busy,false);
});
test('state is observable without React and stale progress cannot change the next run',async()=>{
 const c=createSubmissionController(),seen=[];let stale;
 const unsubscribe=c.subscribe(s=>seen.push(s.phase));
 assert.equal(await c.run(async run=>{stale=run;run.progress('Reading','reading',{id:'a',label:'Reading'});assert.equal(c.state.reading.id,'a');return {kind:'awaitingApproval'};}),'awaitingApproval');
 assert.equal(c.state.progress,'');assert.equal(c.state.reading,null);
 await c.run(async run=>{stale.progress('Old');assert.equal(c.state.progress,'');run.progress('New','generating');assert.equal(c.state.stage,'generating');});
 assert.equal(c.state.phase,'completed');assert.ok(seen.includes('awaitingApproval'));unsubscribe();
});
test('failure releases ownership and Stop after completion has no effect',async()=>{
 const c=createSubmissionController();assert.equal(await c.run(async()=>{throw Error('Storage conflict');}),'failed');
 assert.equal(c.state.error,'Storage conflict');assert.equal(c.stop(),false);
 assert.equal(await c.run(async()=>{}),'completed');assert.equal(c.state.error,undefined);
});
test('Stop does not discard a committed receipt or release ownership before adoption',async()=>{
 const c=createSubmissionController(),commit=deferred(),entered=deferred();let adopted=false;
 const result=c.run(async run=>{entered.resolve();await commit.promise;adopted=true;run.check();});await entered.promise;
 c.stop();assert.equal(c.busy,true);commit.resolve();assert.equal(await result,'cancelled');assert.equal(adopted,true);
});
test('observer errors cannot strand execution or turn committed success into failure',async()=>{
 const c=createSubmissionController();c.subscribe(()=>{throw Error('View detached');});
 assert.equal(await c.run(async()=>{}),'completed');assert.equal(c.busy,false);
});

test('a preparation requirement is blocked and cannot be reported as completed',async()=>{
 const c=createSubmissionController();assert.equal(await c.run(async()=>({kind:'needsPreparation',reason:'model-files'})),'blocked');
 assert.equal(c.state.phase,'blocked');assert.equal(c.state.outcome.kind,'needsPreparation');assert.equal(c.busy,false);
});
test('partial and successful results remain distinguishable without parsing display labels',async()=>{
 const c=createSubmissionController();await c.run(async()=>({kind:'partial',reason:'unsupported-input'}));assert.equal(c.state.outcome.kind,'partial');
 await c.run(async()=>({kind:'answered'}));assert.equal(c.state.outcome.kind,'answered');
});
