import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubmissionController,submissionStageLabel} from '../src/submission-controller.ts';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('transient answer is cleared on stop, failure and completion and stale runs cannot publish',async()=>{
 const c=createSubmissionController(),entered=deferred(),exit=deferred();let stale;
 assert.equal(await c.run(async run=>{assert.equal(typeof run.preview,'function');}),'completed');
 const work=c.run(async run=>{stale=run;run.preview('First');assert.equal(c.state.preview,'First');entered.resolve();await exit.promise;run.check();});
 await entered.promise;c.stop();assert.equal(c.state.preview,'');stale.preview('Late');assert.equal(c.state.preview,'');exit.resolve();assert.equal(await work,'cancelled');
 await c.run(async run=>{stale.preview('Old');assert.equal(c.state.preview,'');run.preview('Draft');throw Error('Failure');});assert.equal(c.state.preview,'');
 await c.run(async run=>{run.preview('Done');});assert.equal(c.state.preview,'');
});

test('every silent submission stage has a short visible fallback label',()=>{
 assert.equal(submissionStageLabel('saving'),'Saving…');
 assert.equal(submissionStageLabel('reading'),'Reading…');
 assert.equal(submissionStageLabel('planning'),'Planning…');
 assert.equal(submissionStageLabel('generating'),'Generating…');
 assert.equal(submissionStageLabel(undefined),'');
});

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

test('runtime failure clears provisional text and a later turn cannot receive its late preview',async()=>{
 const c=createSubmissionController();let old;
 await c.run(async run=>{old=run;run.preview('partial');throw Error('GPU error');});
 assert.equal(c.state.preview,'');assert.equal(c.state.phase,'failed');
 await c.run(async run=>{old.preview('late');assert.equal(c.state.preview,'');run.preview('new');});assert.equal(c.state.preview,'');
});
