import test from 'node:test';import assert from 'node:assert/strict';
import {parseTaskProposal,proposeTask} from '../src/task-proposals.ts';
import {createTaskNote,parseTask} from '../src/task-records.ts';
import {recordOperation,validateActivity,activityLabel} from '../src/harness-activity.ts';
const now=new Date(2026,9,17,8,0),zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
const fields={repeat:'once',time:'09:00',date:'2026-11-01',days:[],monthDay:1,interval:1,unit:'days',prompt:'Check lamp stock.\nKeep the original language.'};
const raw=task=>JSON.stringify({action:'schedule',task});

test('new task proposals validate typed conditions and preserve prompt with harness-owned paused local defaults',()=>{
 const p=parseTaskProposal(raw(fields),now);assert.equal(p.task.enabled,false);assert.equal(p.task.timezone,zone);assert.equal(p.task.notify,true);assert.equal(p.task.prompt,fields.prompt);
 const multilingual='水の備蓄を確認。\n检查饮水。한국어 기록 😀';assert.equal(parseTaskProposal(raw({...fields,prompt:multilingual}),now).task.prompt,multilingual);
 for(const task of [{...fields,repeat:'daily'},{...fields,repeat:'weekly',days:[1,3]},{...fields,repeat:'monthly',monthDay:31},{...fields,repeat:'custom',interval:2,unit:'weeks'}])assert.equal(parseTaskProposal(raw(task),now).task.repeat,task.repeat);
 assert.deepEqual(parseTaskProposal(JSON.stringify({action:'clarify',question:'何時に実行しますか？'}),now),{question:'何時に実行しますか？'});
});
test('proposal parser refuses permissions, target fields, malformed text, past once and unknown or incomplete conditions',()=>{
 for(const extra of [{enabled:true},{timezone:'UTC'},{id:'target'},{path:'Settings/models.md'},{tools:['shell']},{notify:false}])assert.throws(()=>parseTaskProposal(raw({...fields,...extra}),now));
 for(const task of [{...fields,time:'99:00'},{...fields,repeat:'weekly',days:[]},{...fields,repeat:'custom',interval:0},{...fields,date:'2026-01-01'},{...fields,prompt:''},{...fields,prompt:'bad\ud800'},{...fields,prompt:'bad\0'},{...fields,prompt:'x'.repeat(30001)}])assert.throws(()=>parseTaskProposal(raw(task),now));
 const missing={...fields};delete missing.time;assert.throws(()=>parseTaskProposal(raw(missing),now));
 for(const value of [{action:'clarify',question:''},{action:'clarify',question:'x',task:fields},{action:'schedule',task:fields,execute:true},{action:'delete',task:fields}])assert.throws(()=>parseTaskProposal(JSON.stringify(value),now));
});
test('bounded proposal uses current date and untrusted dialogue without receipt/source authority, and Stop or budget failure cannot return a task',async()=>{
 const calls=[],context={summary:'Untrusted earlier summary',recent:[{id:'old',user:'Schedule the stock check.',answer:'At what time?',activity:[{tool:'hidden'}]}],refs:[{quote:'not input evidence'}],turnCount:1};
 const engine={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:400}),generate:async(m,max)=>{calls.push({m,max});return {text:raw(fields)};}};
 assert.equal((await proposeTask(engine,'At nine on November 1.',context,()=>{},now)).task.time,'09:00');assert.equal(calls.length,1);assert.match(calls[0].m[1].content,/2026-10-17/);assert.match(calls[0].m[1].content,/At what time/);assert.doesNotMatch(calls[0].m[1].content,/hidden|not input evidence/);
 await assert.rejects(proposeTask({...engine,count:async()=>({prompt_tokens:1900})},'x',context,()=>{},now),/context limit/);assert.equal(calls.length,1);
 await assert.rejects(proposeTask({...engine,generate:async()=>({text:raw(fields),stopped:true})},'x',context,()=>{},now),/Stopped/);
 let stop=false;await assert.rejects(proposeTask({...engine,generate:async()=>{stop=true;return {text:raw(fields)};}},'x',context,()=>{if(stop)throw Error('Stopped');},now),/Stopped/);
});
test('stable session identity creates one canonical task without overwriting any existing ID or historical state',()=>{
 const task=parseTaskProposal(raw(fields),now).task,id='daea264e-8535-4cc9-b659-b5ebc2379273',n=createTaskNote([],task,id,now);
 assert.equal(n.id,id);assert.equal(n.revisions[0].path,'Schedule/2026-10-17-'+id+'.md');assert.equal(parseTask(n.revisions[0].body).enabled,false);assert.equal(n.ui.recordType,'schedule');
 assert.throws(()=>createTaskNote([n],task,id,now),/already|conflict/i);assert.throws(()=>createTaskNote([{...n,state:'withdrawn'}],task,id,now),/already|conflict/i);assert.throws(()=>createTaskNote([],task,'../../other',now),/Invalid/);
});
test('schedule proposals have portable success, typed failure and Stop activity without automatic writes',async()=>{
 const saved=[];const p=await recordOperation('schedule.propose',{instruction:'At nine'},async()=>parseTaskProposal(raw(fields),now),async a=>saved.push(a));assert.equal(p.task.enabled,false);assert.equal(saved.at(-1).status,'succeeded');validateActivity(saved.slice(-1));assert.equal(activityLabel('schedule.propose'),'Review schedule');
 for(const message of ['Stopped','Invalid schedule proposal']){const events=[];await assert.rejects(recordOperation('schedule.propose',{},async()=>{throw Error(message);},async a=>events.push(a)));assert.equal(events.at(-1).status,message==='Stopped'?'stopped':'failed');assert.equal(events.at(-1).error.code,message==='Stopped'?'stopped':'invalid_model_output');}
});
