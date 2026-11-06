import test from 'node:test';
import assert from 'node:assert/strict';
import {formatTask,parseTask,taskDefinition,taskNextAt,claimTaskRun,finishTaskRun,skipTaskRun,heartbeatRun,taskRunView} from '../src/task-records.ts';
import {projectNote,applyKnowledgeChanges} from '../src/knowledge-store.ts';
import {createNote,latest} from '../../../dist/core.js';
import {makeDecimalReceipt} from '../src/tools/math.calculate/decimal-receipt.ts';

const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
const task={repeat:'once',time:'09:00',days:[1],date:'2026-10-20',monthDay:1,interval:1,unit:'days',timezone:zone,enabled:true,notify:true,prompt:'  要約して\nOriginal bytes.\n'};
function registered(){const n=createNote({path:'Schedule/test.md',body:formatTask(task)});n.ui={recordType:'schedule'};n.taskCursor={definition:taskDefinition(task),nextAt:taskNextAt(task,new Date(2026,9,19)).toISOString()};return n;}
test('scheduled calculation preserves a validated receipt and rejects mismatched answers',()=>{const definition={...task,prompt:'Calculate 12 + 10'},note=createNote({path:'Schedule/calculation.md',body:formatTask(definition)});note.ui={recordType:'schedule'};note.taskCursor={definition:taskDefinition(definition),nextAt:taskNextAt(definition,new Date(2026,9,19)).toISOString()};const now=new Date(2026,9,20,9),{run}=claimTaskRun([note],note.id,'owner',now),receipt=makeDecimalReceipt('12 + 10');const result={status:'succeeded',answer:'12 + 10 = 22',sources:[],calculation:receipt};assert.throws(()=>finishTaskRun([note,run],run.id,'owner',{...result,answer:'12 + 10 = 23'},now),/Invalid scheduled calculation/);assert.throws(()=>finishTaskRun([note,run],run.id,'owner',{...result,sources:[{}]},now),/Invalid scheduled calculation/);const finished=finishTaskRun([note,run],run.id,'owner',result,now);assert.deepEqual(taskRunView(finished.run).calculation,receipt);assert.equal(latest(finished.task).body,latest(note).body);assert.equal(finished.task.taskCursor.nextAt,null);});
test('task Markdown preserves exact prompt and validation rejects execution directives',()=>{
 const body=formatTask(task);assert.equal(parseTask(body).prompt,task.prompt);
 assert.throws(()=>parseTask(body.replace('"enabled": true','"enabled": "yes"')),/Invalid/);
 assert.throws(()=>formatTask({...task,shell:'delete all'}),/Unknown/);
 assert.equal(taskDefinition(task),taskDefinition({...task,enabled:false}));
});
test('only registered, enabled tasks can be claimed; the same occurrence is idempotent',()=>{
 const note=registered(),now=new Date(2026,9,20,9,0,10);
 assert.throws(()=>claimTaskRun([{...note,ui:undefined}],note.id,'owner',now),/registered/);
 const claim=claimTaskRun([note],note.id,'owner',now);
 const records=[note,claim.run];
 assert.throws(()=>claimTaskRun(records,note.id,'other',now),/already/);
 assert.equal(taskRunView(claim.run).status,'running');
 assert.equal(taskRunView(claim.run).taskRevision,1);
});
test('missed occurrences do not execute without an explicit retry and failed attempts remain versioned',()=>{
 const note=registered(),late=new Date(2026,9,20,10);
 const missed=claimTaskRun([note],note.id,'owner',late);
 assert.equal(taskRunView(missed.run).status,'missed');
 const retry=claimTaskRun([note,missed.run],note.id,'owner',late,{retry:true});
 assert.equal(taskRunView(retry.run).attempt,1);
 const finished=finishTaskRun([note,retry.run],retry.run.id,'owner',{status:'failed',error:'Not prepared'},late);
 assert.equal(taskRunView(finished.run).status,'failed');
 assert.equal(finished.run.revisions.length,3);
 const again=claimTaskRun([finished.task,finished.run],note.id,'other',late,{retry:true});
 assert.equal(taskRunView(again.run).attempt,2);
});
test('finishing a run checks its owner, retains task bytes, and consumes a one-off only after success',()=>{
 const note=registered(),now=new Date(2026,9,20,9);
 const {run}=claimTaskRun([note],note.id,'owner',now);
 const sources=[{noteId:note.id,revision:1,start:0,end:1,quote:'#'}];
 assert.throws(()=>finishTaskRun([note,run],run.id,'other',{status:'succeeded',answer:'actual result',sources},now),/owner/);
 const result=finishTaskRun([note,run],run.id,'owner',{status:'succeeded',answer:'actual result',sources},now);
 assert.equal(result.task.taskCursor.nextAt,null);
 assert.equal(latest(result.task).body,latest(note).body);
 assert.equal(taskRunView(result.run).answer,'actual result');
});
test('path changes do not reschedule; editing the canonical task changes conditions and preserves original',()=>{
 const note=registered(),before=projectNote(note),moved={...before,path:'Schedule/moved.md',version:2,history:[before.body]};
 const renamed=applyKnowledgeChanges([note],[before],[moved])[0];assert.deepEqual(renamed.taskCursor,note.taskCursor);
 const next={...before,body:formatTask({...task,repeat:'daily',time:'10:00'}),version:2,history:[before.body]};
 const changed=applyKnowledgeChanges([note],[before],[next])[0];assert.equal(new Date(changed.taskCursor.nextAt).getHours(),10);assert.equal(latest(note).body,before.body);
 assert.throws(()=>applyKnowledgeChanges([note],[before],[{...next,body:'invalid'}]),/format/);
 assert.equal(taskDefinition({...task,id:'display-only',nextAt:'ignored'}),taskDefinition(task));
});
test('leases prevent an active second owner and expired work requires explicit retry',()=>{
 const note=registered(),start=new Date(2026,9,20,9),{run}=claimTaskRun([note],note.id,'owner',start);
 const kept=heartbeatRun([run],run.id,'owner',new Date(+start+60000));
 assert.throws(()=>claimTaskRun([note,kept],note.id,'other',new Date(+start+100000)),/already running/);
 const expired=claimTaskRun([note,kept],note.id,'other',new Date(+start+160000));
 assert.equal(taskRunView(expired.run).status,'interrupted');assert.equal(expired.execute,false);
 assert.throws(()=>claimTaskRun([note,expired.run],note.id,'other',new Date(+start+170000)),/processed/);
});
test('skip consumes an occurrence without inventing an inference attempt',()=>{
 const note=registered(),now=new Date(2026,9,20,10),skipped=skipTaskRun([note],note.id,'user',now);
 assert.equal(taskRunView(skipped.run).attempt,0);assert.equal(taskRunView(skipped.run).status,'skipped');assert.equal(skipped.task.taskCursor.nextAt,null);
});

test('explicit retry by the same page uses a fresh lease rather than an expired heartbeat',()=>{
 const note=registered(),start=new Date(2026,9,20,9),owner='same-page';
 const claim=claimTaskRun([note],note.id,owner,start);
 const heartbeat=heartbeatRun([claim.run],claim.run.id,owner,new Date(+start+60000));
 const now=new Date(+start+160000),interrupted=claimTaskRun([note,heartbeat],note.id,owner,now);
 assert.equal(interrupted.execute,false);assert.equal(taskRunView(interrupted.run).status,'interrupted');
 const before=structuredClone(interrupted.run),retried=claimTaskRun([note,interrupted.run],note.id,owner,now,{retry:true});
 assert.deepEqual(interrupted.run,before);assert.equal(retried.execute,true);assert.equal(retried.run.id,claim.run.id);
 assert.equal(taskRunView(retried.run).attempt,2);
 const freshHeartbeat=heartbeatRun([retried.run],retried.run.id,owner,now);
 const finished=finishTaskRun([note,freshHeartbeat],retried.run.id,owner,{status:'failed',error:'Controlled final failure'},now);
 assert.equal(taskRunView(finished.run).status,'failed');assert.equal(finished.run.runLease,undefined);
 assert.deepEqual(finished.run.revisions.slice(0,claim.run.revisions.length),claim.run.revisions);
});

test('scheduled success validates the complete current source chain before consuming an occurrence',async()=>{
 const {reviseNote,searchNotes,validateRefs}=await import('../../../dist/core.js');
 const task=registered(),now=new Date(2026,9,20,9),{run}=claimTaskRun([task],task.id,'owner',now);
 const source=createNote({path:'Notes/source101.md',body:'Source marker CEDAR-101.'}),parent=createNote({path:'Notes/summary101.md',body:'A saved summary of CEDAR-101.',kind:'generated',sources:searchNotes([source],'CEDAR-101')});
 const refs=[{noteId:parent.id,revision:1,start:0,end:latest(parent).body.length,quote:latest(parent).body}];
 assert.equal(taskRunView(finishTaskRun([task,run,source,parent],run.id,'owner',{status:'succeeded',answer:'controlled contract result',sources:refs},now).run).status,'succeeded');
 const changed=reviseNote(source,{body:'Corrected marker MAPLE-102.'},1),records=[task,run,changed,parent],before=structuredClone(records);
 assert.equal(validateRefs(records,refs,{currentOnly:true}).ok,true);assert.throws(()=>finishTaskRun(records,run.id,'owner',{status:'succeeded',answer:'controlled contract result',sources:refs},now),/Source changed/);assert.deepEqual(records,before);
});


test('an older completion cannot consume a different pending occurrence of the same definition',()=>{
 const note=registered(),now=new Date(2026,9,20,9),{run}=claimTaskRun([note],note.id,'owner',now);
 const pending=new Date(+now+86400000).toISOString(),current={...note,taskCursor:{...note.taskCursor,nextAt:pending}};
 const sources=[{noteId:note.id,revision:1,start:0,end:1,quote:'#'}];
 const result=finishTaskRun([current,run],run.id,'owner',{status:'succeeded',answer:'controlled historical completion',sources},now);
 assert.equal(result.task.taskCursor.nextAt,pending);assert.deepEqual(result.task,current);assert.equal(taskRunView(result.run).status,'succeeded');assert.equal(taskRunView(result.run).dueAt,note.taskCursor.nextAt);
 const skipped=finishTaskRun([current,run],run.id,'owner',{status:'skipped',error:'User skipped old occurrence'},now);
 assert.equal(skipped.task.taskCursor.nextAt,pending);
});

test('retry keeps prior model provenance in history without attributing it to a new attempt',()=>{
 const note=registered(),now=new Date(2026,9,20,9);
 const claimed=claimTaskRun([note],note.id,'first',now);
 const model={id:'previous-model',revision:'previous-revision',runtime:'previous-runtime'};
 const failed=finishTaskRun([note,claimed.run],claimed.run.id,'first',{status:'failed',error:'Execution failed',model},now);
 const snapshot=structuredClone(failed.run);
 const retry=claimTaskRun([failed.task,failed.run],note.id,'second',now,{retry:true});
 assert.equal(taskRunView(retry.run).model,undefined);
 assert.deepEqual(retry.run.revisions.slice(0,-1),failed.run.revisions);
 assert.deepEqual(failed.run,snapshot);
 const stopped=finishTaskRun([failed.task,retry.run],retry.run.id,'second',{status:'stopped',error:'Stopped'},now);
 assert.equal(taskRunView(stopped.run).model,undefined);
 assert.match(stopped.run.revisions[1].body,/previous-model/);
});

test('skipping in another timezone refuses to advance or create a run',()=>{
 const other=zone==='Asia/Tokyo'?'America/New_York':'Asia/Tokyo';const definition={...task,repeat:'daily',timezone:other};
 const note=createNote({path:'Schedule/timezone.md',body:formatTask(definition)});note.ui={recordType:'schedule'};note.taskCursor={definition:taskDefinition(definition),nextAt:'2026-10-20T00:00:00.000Z'};
 const records=[note],before=structuredClone(records);assert.throws(()=>skipTaskRun(records,note.id,'user',new Date('2026-10-20T01:00:00Z')),/Timezone changed/);assert.deepEqual(records,before);
});

test('a timezone change during a run preserves completion without advancing in the new zone',async()=>{
 const {spawnSync}=await import('node:child_process');
 const script=`import {formatTask,taskDefinition,claimTaskRun,finishTaskRun,taskRunView,reviseTaskNote} from './design/prototype/src/task-records.ts';import {createNote} from './dist/core.js';
 const t={repeat:'daily',time:'09:00',days:[],date:'2026-10-20',monthDay:1,interval:1,unit:'days',timezone:'Asia/Tokyo',enabled:true,notify:false,prompt:'Check supplies'};
 const n=createNote({path:'Schedule/a.md',body:formatTask(t)});n.ui={recordType:'schedule'};n.taskCursor={definition:taskDefinition(t),nextAt:'2026-10-20T00:00:00.000Z'};
 const now=new Date('2026-10-20T00:00:00.000Z');const once={...t,repeat:'once'},single=createNote({path:'Schedule/once.md',body:formatTask(once)});single.ui={recordType:'schedule'};single.taskCursor={definition:taskDefinition(once),nextAt:n.taskCursor.nextAt};const one=claimTaskRun([single],single.id,'owner',now);
 const {run}=claimTaskRun([n],n.id,'owner',now);process.env.TZ='America/New_York';const result=finishTaskRun([n,run],run.id,'owner',{status:'succeeded',answer:'Completed',sources:[{noteId:n.id,revision:1,start:0,end:1,quote:'#'}]},now);const done=finishTaskRun([single,one.run],one.run.id,'owner',{status:'skipped',error:'Skipped'},now);const reviewed=reviseTaskNote(result.task,{...t,timezone:'America/New_York'},now);
 console.log(JSON.stringify({cursor:result.task.taskCursor.nextAt,review:result.task.ui.requiresReview,status:taskRunView(result.run).status,answer:taskRunView(result.run).answer,onceCursor:done.task.taskCursor.nextAt,onceReview:!!done.task.ui.requiresReview,reviewed:!reviewed.ui.requiresReview,reviewedNext:reviewed.taskCursor.nextAt}));`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),env:{...process.env,TZ:'Asia/Tokyo'},encoding:'utf8'});assert.equal(child.status,0,child.stderr);assert.deepEqual(JSON.parse(child.stdout),{cursor:'2026-10-20T00:00:00.000Z',review:true,status:'succeeded',answer:'Completed',onceCursor:null,onceReview:false,reviewed:true,reviewedNext:'2026-10-20T13:00:00.000Z'});
});

test('review-required schedule cannot be claimed even by a manual run',()=>{
 const note=registered();note.ui.requiresReview=true;const records=[note],before=structuredClone(records);
 assert.throws(()=>claimTaskRun(records,note.id,'owner',new Date(2026,9,20,9),{manual:true}),/Review schedule/);assert.deepEqual(records,before);
});
