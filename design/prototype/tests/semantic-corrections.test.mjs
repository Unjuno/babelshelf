import test from 'node:test';import assert from 'node:assert/strict';import {createNote,reviseNote,latest} from '../../../dist/core.js';import {prepareCorrection,applyCorrection,undoCorrection,proposeCorrection} from '../src/note-corrections.ts';import {makeStateBackup,parseStateBackup,stateHash} from '../src/backup-state.ts';
import {formatTask,parseTask,taskDefinition} from '../src/task-records.ts';
const taskFixture=()=>{const task={repeat:'daily',time:'09:00',days:[],date:'2026-10-20',monthDay:1,interval:1,unit:'days',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,enabled:false,notify:true,prompt:'Check lamp stock.'},n=createNote({path:'Schedule/qa-task.md',body:formatTask(task)});n.ui={recordType:'schedule'};n.taskCursor={definition:taskDefinition(task),nextAt:'2026-10-20T00:00:00.000Z'};return n;};
const patch=changes=>JSON.stringify({action:'patch',changes});

test('scheduled prompts and full note rewrites receive the available bounded output space',async()=>{
 const body='確認した内容を日本語で整理する。'.repeat(80);
 const scheduled=taskFixture();let calls=0;
 const engine={manifest:{contextTokens:4096},count:async()=>({prompt_tokens:1200}),generate:async(messages,maxTokens)=>{
  calls++;assert.ok(maxTokens>768);assert.ok(maxTokens+1200+160<=4096);return {text:patch({prompt:body})};
 }};
 const scheduleProposal=await proposeCorrection(engine,'Use this full prompt',scheduled);
 assert.equal(parseTask(scheduleProposal.after).prompt,body);assert.equal(calls,1);
 calls=0;const original=createNote({path:'Home/notes.md',body:'Original text'});
 const proposal=await proposeCorrection({...engine,generate:async(messages,maxTokens)=>{
  if(++calls===1)return {text:'{"action":"rewrite"}'};
  assert.ok(maxTokens>768);assert.ok(maxTokens+1200+160<=4096);return {text:JSON.stringify({body})};
 }},'Rewrite as a detailed Japanese note',original);
 assert.equal(proposal.after,body);assert.equal(latest(original).version,1);
});

test('invalid token counts refuse ordinary and schedule proposals before generation',async()=>{
 for(const target of [taskFixture(),createNote({path:'Home/test.md',body:'Original'})]){
  let generated=0;
  const engine={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:NaN}),generate:async()=>{generated++;return {text:target.ui?.recordType?patch({time:'10:00'}):'{"action":"replace","find":"Original","with":"Changed"}'};}};
  await assert.rejects(proposeCorrection(engine,'Change this',target),/token budget|token count/);
  assert.equal(generated,0);
 }
});
test('typed schedule changes are reviewed against exact originals and retain disabled state, canonical cursor, history and Undo',()=>{
 const n=taskFixture(),original=structuredClone(n),p=prepareCorrection(n,'Move this schedule to ten',patch({time:'10:00'}));assert.deepEqual(n,original);assert.equal(p.operation.name,'schedule.patch');assert.equal(parseTask(p.after).time,'10:00');assert.equal(parseTask(p.after).enabled,false);
 const applied=applyCorrection([n],p);assert.equal(applied.note.id,n.id);assert.equal(latest(applied.note).path,'Schedule/qa-task.md');assert.equal(applied.note.revisions[0].body,latest(n).body);assert.equal(applied.note.taskCursor.definition,taskDefinition(parseTask(p.after)));assert.deepEqual(applied.note.sources,n.sources);
 const undone=undoCorrection([applied.note],applied.receipt);assert.equal(latest(undone.note).body,latest(n).body);assert.equal(undone.note.revisions.length,3);assert.equal(undone.note.taskCursor.definition,taskDefinition(parseTask(latest(n).body)));
 assert.throws(()=>applyCorrection([{...n,taskCursor:{...n.taskCursor,nextAt:'2026-10-21T00:00:00.000Z'}}],p),/conflict/);assert.throws(()=>applyCorrection([reviseNote(n,{body:formatTask({...parseTask(latest(n).body),time:'11:00'})},1)],p),/conflict/);
});
test('schedule patches cannot rewrite protected records or invent activation, timezone, identity, execution or invalid conditions',()=>{
 const n=taskFixture();for(const changes of [{enabled:true},{timezone:'UTC'},{path:'Notes/stolen.md'},{delete:true},{tools:['shell']},{time:'99:99'},{repeat:'weekly',days:[]},{notify:'yes'},{prompt:''},{prompt:'bad\ud800'},{time:'09:00'},{}])assert.throws(()=>prepareCorrection(n,'change',patch(changes)));
 const compact=structuredClone(n);compact.revisions[0].body=compact.revisions[0].body.replace(/```json\n([\s\S]*?)\n```/,(_,json)=>'```json\n'+JSON.stringify(JSON.parse(json))+'\n```');assert.throws(()=>prepareCorrection(compact,'Keep same time',patch({time:'09:00'})),/No change/);
 assert.throws(()=>prepareCorrection(n,'change',raw('untyped body')));assert.throws(()=>prepareCorrection(note(),'change',patch({time:'10:00'})));for(const ui of [{recordType:'execution'},{recordType:'notification'},{recordType:'schedule',protected:true},{recordType:'schedule',managed:true}])assert.throws(()=>prepareCorrection({...n,ui},'change',patch({time:'10:00'})));
});
test('schedule patch receipts stay compact and validate typed retained revisions through backup and Undo',async()=>{
 const n=taskFixture(),body='Recognize the original prompt. '.repeat(600),applied=applyCorrection([n],prepareCorrection(n,'Update prompt',patch({prompt:body})));assert.ok(JSON.stringify(applied.receipt).length<1500);assert.equal(JSON.stringify(applied.receipt).includes(body),false);
 const undone=undoCorrection([applied.note],applied.receipt),pack=await makeStateBackup({notes:[undone.note],settings:[],runs:[{key:'ui-v1-correction-'+undone.receipt.id,value:undone.receipt}]});assert.equal((await parseStateBackup(JSON.stringify(pack))).notes[0].revisions[1].body,latest(applied.note).body);
 const bad=structuredClone(pack);bad.payload.runs[0].value.operation.arguments.changesSha256='0'.repeat(64);bad.sha256=stateHash(bad.payload);await assert.rejects(parseStateBackup(JSON.stringify(bad)),/correction|patch/i);
});
test('schedule proposal inference is source-only, bounded and cannot accept stopped or authority-bearing output',async()=>{
 const n=taskFixture(),calls=[],base={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:100}),generate:async messages=>{calls.push(messages);return {text:patch({time:'10:00'})};}};
 const p=await proposeCorrection(base,'Move to ten',n);assert.equal(p.operation.name,'schedule.patch');assert.equal(calls.length,1);assert.equal(calls[0].length,2);assert.match(calls[0][1].content,/09:00/);assert.doesNotMatch(JSON.stringify(calls),/dialogue|historyIndex/);
 await assert.rejects(proposeCorrection({...base,generate:async()=>({text:patch({time:'10:00'}),stopped:true})},'Move',n),/Stopped/);await assert.rejects(proposeCorrection({...base,count:async()=>({prompt_tokens:2000})},'Move',n),/context limit/);
 const quarantined={...n,ui:{...n.ui,requiresReview:true}};const before=calls.length;await assert.rejects(proposeCorrection(base,'Move',quarantined),/Review restored schedule/);assert.equal(calls.length,before);const prepared=prepareCorrection(quarantined,'Move',patch({time:'10:00'}));assert.throws(()=>applyCorrection([quarantined],prepared),/Review restored schedule/);
});
const note=()=>createNote({path:'Notes/rewrite.md',body:'Water: three liters.\nMeeting Monday at ten. Keep the venue.'}),raw=body=>JSON.stringify({action:'rewrite',body});
test('semantic body rewrite is only a proposal until explicit approval; IDs, metadata, original history and Undo survive',()=>{
 const n=note();n.legacy={retained:'原文'};const before=structuredClone(n),p=prepareCorrection(n,'Organize as bullets without changing facts',raw('- Water: three liters.\n- Meeting: Monday at ten; same venue.'));assert.deepEqual(n,before);assert.equal(p.operation.name,'text.rewrite');const applied=applyCorrection([n],p);assert.equal(applied.note.id,n.id);assert.equal(applied.note.revisions[0].body,n.revisions[0].body);assert.deepEqual(applied.note.legacy,n.legacy);assert.equal(latest(applied.note).path,latest(n).path);assert.equal(latest(applied.note).body,p.after);assert.deepEqual(applied.note.sources,n.sources);const undone=undoCorrection([applied.note],applied.receipt);assert.equal(latest(undone.note).body,latest(n).body);assert.equal(undone.note.revisions.length,3);assert.equal(undone.note.revisions[1].body,p.after);
});
test('rewrite rejects no-op, empty, invalid Unicode, unknown authority fields, stale targets and modified review bytes',()=>{
 const n=note();for(const body of ['', '  ',latest(n).body,'x'.repeat(30001),'bad\ud800'])assert.throws(()=>prepareCorrection(n,'rewrite',raw(body)));
 assert.throws(()=>prepareCorrection(n,'rewrite',JSON.stringify({action:'rewrite',body:'new',path:'Settings/models.md'})),/Invalid/i);const p=prepareCorrection(n,'rewrite',raw('New structured body'));assert.throws(()=>applyCorrection([n],{...p,after:'Different displayed text'}),/Invalid/i);assert.throws(()=>applyCorrection([reviseNote(n,{body:'Other tab'},1)],p),/conflict/i);assert.throws(()=>prepareCorrection({...n,ui:{managed:true}},'rewrite',raw('new')),/protected/i);
});
test('rewrite receipts are compact, validate against retained body bytes in backup, and reject rehashed forged operations',async()=>{
 const n=note(),body='日本語の整理済み文章。'.repeat(1000),applied=applyCorrection([n],prepareCorrection(n,'Organize',raw(body)));assert.ok(JSON.stringify(applied.receipt).length<1500);assert.equal(applied.receipt.operation.arguments.bodySha256.length,64);assert.equal(JSON.stringify(applied.receipt).includes(body),false);const snapshot={notes:[applied.note],settings:[],runs:[{key:'ui-v1-correction-'+applied.receipt.id,value:applied.receipt}]},pack=await makeStateBackup(snapshot);assert.equal((await parseStateBackup(JSON.stringify(pack))).notes[0].revisions[1].body,body);const forged=structuredClone(pack);forged.payload.runs[0].value.operation.arguments.bodySha256='0'.repeat(64);forged.sha256=stateHash(forged.payload);await assert.rejects(parseStateBackup(JSON.stringify(forged)),/correction/i);
});
test('semantic selection uses a separate source-only generation while literal corrections remain one call',async()=>{
 const n=note(),calls=[],e={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:100}),generate:async(m,max)=>{calls.push({m,max});return {text:calls.length===1?'{"action":"rewrite"}':JSON.stringify({body:'- Water: three liters.\n- Meeting Monday at ten; same venue.'})};}};const p=await proposeCorrection(e,'Organize this as bullets',n);assert.equal(p.operation.name,'text.rewrite');assert.equal(calls.length,2);assert.ok(calls[1].max>768&&calls[1].max+100+160<=2048);assert.match(JSON.stringify(calls[1].m),/three liters/);assert.equal(calls[1].m.length,2);let literalCalls=0;await proposeCorrection({...e,generate:async()=>{literalCalls++;return {text:'{"action":"replace","find":"three","with":"four"}'};}},'Replace three with four',n);assert.equal(literalCalls,1);
});
test('rewrite inference cannot accept cancelled, oversized, truncated or authority-bearing results',async()=>{
 const n=note(),base={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:100})};let calls=0;const e={...base,generate:async()=>({text:++calls===1?'{"action":"rewrite"}':'{"body":"truncated'})};await assert.rejects(proposeCorrection(e,'rewrite',n),/JSON|Unterminated/);assert.equal(calls,2);calls=0;await assert.rejects(proposeCorrection({...e,count:async()=>({prompt_tokens:calls?1900:100})},'rewrite',n),/context limit/);assert.equal(calls,1);calls=0;await assert.rejects(proposeCorrection({...e,generate:async()=>({text:++calls===1?'{"action":"rewrite"}':'{"body":"new","delete":true}'})},'rewrite',n),/Invalid/);calls=0;let cancelled=false;await assert.rejects(proposeCorrection({...e,generate:async()=>{calls++;cancelled=true;return {text:'{"action":"rewrite"}'};}},'rewrite',n,()=>{if(cancelled)throw Error('Stopped');}),/Stopped/);assert.equal(calls,1);
});

test('correction inference snapshots the selected original before awaiting; later caller mutation cannot silently become its approved base',async()=>{
 const n=note(),original=structuredClone(n);let calls=0;const engine={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:100}),generate:async()=>{if(++calls===1){n.revisions.push({...n.revisions[0],version:2,body:'Competing update'});return {text:'{"action":"rewrite"}'};}return {text:'{"body":"Reorganized original facts"}'};}};const p=await proposeCorrection(engine,'rewrite',n);assert.deepEqual(p.expected,original);assert.equal(p.before,latest(original).body);assert.throws(()=>applyCorrection([n],p),/conflict/i);
});
test('invalid correction requests are rejected before any inference work',async()=>{
 let calls=0;const engine={manifest:{contextTokens:2048},count:async()=>{calls++;return {prompt_tokens:1};},generate:async()=>{calls++;return {text:'{"action":"reply"}'};}};for(const request of ['', ' ', 'x'.repeat(30001)])await assert.rejects(proposeCorrection(engine,request,note()),/request/i);assert.equal(calls,0);
});
