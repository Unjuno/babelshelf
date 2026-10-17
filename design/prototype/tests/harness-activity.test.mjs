import test from 'node:test';import assert from 'node:assert/strict';
import {recordOperation,startActivity,finishActivity,validateActivity} from '../src/harness-activity.ts';
import {emptyDialogue,appendTurn,dialogueContext,historyPayload,validateDialogue} from '../src/conversation.ts';
import {planDialogue} from '../src/conversation.ts';
const input={query:'日本語の記録'};
test('invalid planner output is bounded audit evidence only, never accepted or added to model history',async()=>{
 const raw='{"action":"recall","historyIndex":0,"historyPart":"user"}',entries=[];
 const engine={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:10}),generate:async()=>({text:raw})};
 await assert.rejects(recordOperation('dialogue.plan',{question:'first message?'},()=>planDialogue(engine,'first message?',{summary:'',recent:[],refs:[],turnCount:1}),async a=>entries.push(a)),/Invalid model action/);
 assert.equal(entries[1].status,'failed');assert.equal(entries[1].error.code,'invalid_model_output');assert.equal(entries[1].output.raw,raw);assert.equal(entries[1].output.reason,'query');assert.equal(entries[1].output.truncated,false);
 const state=appendTurn(emptyDialogue(),{id:'failed',user:'first message?',activity:entries.slice(-1)});assert.doesNotMatch(JSON.stringify(historyPayload(dialogueContext(state))),/historyIndex/);
 engine.generate=async()=>({text:'x'.repeat(20000)});const malformed=[];await assert.rejects(recordOperation('dialogue.plan',{},()=>planDialogue(engine,'q',{summary:'',recent:[],refs:[]}),async a=>malformed.push(a)),/JSON/);assert.ok(malformed[1].output.raw.length<=8192);assert.equal(malformed[1].output.reason,'json');assert.equal(malformed[1].output.truncated,true);
 engine.generate=async()=>({text:raw,stopped:true});const stopped=[];await assert.rejects(recordOperation('dialogue.plan',{},()=>planDialogue(engine,'q',{summary:'',recent:[],refs:[]}),async a=>stopped.push(a)),/Stopped/);assert.equal(stopped[1].output,undefined);
 const forged=Object.assign(Error('Invalid model action'),{diagnostic:{raw:'untrusted'}}),generic=[];await assert.rejects(recordOperation('dialogue.plan',{},async()=>{throw forged},async a=>generic.push(a)));assert.equal(generic[1].output,undefined);
});
test('read-only attempt is persisted before work and records detached exact input/output once',async()=>{
 const events=[];const args=structuredClone(input),out={count:1,ids:['note1']};const result=await recordOperation('memory.search',args,async()=>{assert.equal(events.length,1);assert.equal(events[0].status,'running');args.query='changed';return out;},async a=>events.push(structuredClone(a)));
 assert.equal(result,out);assert.equal(events[1].status,'succeeded');assert.equal(events[1].input.query,input.query);out.ids.push('late');assert.deepEqual(events[1].output.ids,['note1']);assert.equal(events[0].id,events[1].id);
});
test('failed and stopped operations retain typed errors, and a failed start never runs work',async()=>{
 for(const [message,code,status] of [['Model not configured · Settings','not_prepared','failed'],['Source changed · retry','source_changed','failed'],['Stopped','stopped','stopped'],['Model not prepared · Settings','not_prepared','failed'],['Invalid model JSON · retry','invalid_model_output','failed']]){const entries=[];await assert.rejects(recordOperation('knowledge.answer',{question:'q'},async()=>{throw Error(message);},async e=>entries.push(e)),e=>e.message===message);assert.equal(entries[1].status,status);assert.deepEqual(entries[1].error,{code,message});}
 let ran=false;await assert.rejects(recordOperation('memory.search',input,async()=>{ran=true;},async()=>{throw Error('storage unavailable');}),/storage/);assert.equal(ran,false);
});
test('completion persistence failure never re-executes work or rewrites a completed result as a tool failure',async()=>{
 let calls=0,writes=0;await assert.rejects(recordOperation('memory.search',input,async()=>{calls++;return {count:0};},async()=>{if(++writes===2)throw Error('disk full');}),/receipt|record/i);assert.equal(calls,1);assert.equal(writes,2);
});
test('activity validates lifecycle and immutable terminals, rejects unknown tools and nonportable or oversized payloads',()=>{
 const a=startActivity('memory.search',input),done=finishActivity(a,{output:{count:0}});validateActivity([done]);assert.throws(()=>finishActivity(done,{output:{count:1}}),/finished/i);assert.throws(()=>startActivity('shell.exec',input),/operation/i);assert.throws(()=>startActivity('memory.search',{x:Infinity}),/JSON|payload/i);assert.throws(()=>startActivity('memory.search',{x:'x'.repeat(300001)}),/limit/i);assert.throws(()=>validateActivity([a,a]),/duplicate/i);assert.throws(()=>validateActivity([{...a,status:'succeeded'}]),/result|output/i);assert.throws(()=>validateActivity([{...done,finishedAt:'invalid'}]),/time/i);
});
test('dialogue retains activity but never includes its tool payloads in model history',()=>{
 const a=finishActivity(startActivity('memory.search',{query:'PRIVATE_TRACE_ONLY'}),{output:{raw:'TRACE_RESULT_ONLY'}}),s=appendTurn(emptyDialogue(),{id:'turn',user:'Find a note',activity:[a]});validateDialogue(s);const payload=JSON.stringify(historyPayload(dialogueContext(s)));assert.doesNotMatch(payload,/PRIVATE_TRACE_ONLY|TRACE_RESULT_ONLY/);const bad=structuredClone(s);bad.turns[0].activity[0].tool='shell.exec';assert.throws(()=>validateDialogue(bad),/operation/i);validateDialogue(appendTurn(emptyDialogue(),{id:'legacy',user:'Old turn'}));
});

test('updating an attempt only appends a new start or completes its original identity once',async()=>{
 const {updateActivity}=await import('../src/harness-activity.ts'),a=startActivity('memory.search',input),list=updateActivity([],a),done=finishActivity(a,{output:{count:0}});assert.equal(updateActivity(list,done)[0].status,'succeeded');assert.equal(list[0].status,'running');assert.throws(()=>updateActivity([],done),/start|unknown/i);assert.throws(()=>updateActivity(list,{...done,input:{query:'changed'}}),/identity/i);assert.throws(()=>updateActivity([done],done),/finished/i);
});

test('a tool-returned failure retains its exact result without pretending success or throwing away its UI receipt',async()=>{
 const entries=[],result={status:'Text not found · original retained',toolCalls:[{name:'text.replace',result:{error:'Text not found',matches:0}}]};const returned=await recordOperation('text.transform',{text:'Original'},async()=>result,async a=>entries.push(a),r=>r,r=>r.status?Error(r.status):undefined);assert.equal(returned,result);assert.equal(entries[1].status,'failed');assert.deepEqual(entries[1].output,result);assert.equal(entries[1].error.code,'not_found');
});

test('an incomplete historical attempt is not shown as running just because another request is active',async()=>{
 const {activityStatus}=await import('../src/harness-activity.ts'),a=startActivity('memory.search',input);assert.equal(activityStatus(a,false),'Incomplete');assert.equal(activityStatus(a,true),'Running');assert.equal(activityStatus(finishActivity(a,{error:Error('Stopped')}),false),'Stopped');
});

test('media extraction attempts share persisted audit lifecycle without entering model history',()=>{
 for(const tool of ['pdf.read','speech.transcribe']){const a=startActivity(tool,{source:{name:'日本語.pdf',bytes:42},language:'ja'});const done=finishActivity(a,{output:{characters:12,reviewRequired:true}});validateActivity([done]);assert.equal(done.tool,tool);assert.equal(done.status,'succeeded');}
});

test('explicit asset management operations have audit labels and lifecycle without implying readiness',()=>{
 for(const tool of ['model.prepare','model.unload','speech.prepare']){const a=startActivity(tool,{role:'text',model:'4B',allowNetwork:false});const done=finishActivity(a,{output:{completed:true}});validateActivity([done]);assert.equal(done.status,'succeeded');assert.equal(done.input.allowNetwork,false);}
});
