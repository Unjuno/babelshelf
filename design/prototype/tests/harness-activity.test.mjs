import test from 'node:test';import assert from 'node:assert/strict';
import {recordOperation,startActivity,finishActivity,validateActivity} from '../src/harness-activity.ts';
import {emptyDialogue,appendTurn,dialogueContext,historyPayload,validateDialogue} from '../src/conversation.ts';
import {planDialogue} from '../src/conversation.ts';
const input={query:'日本語の記録'};

test('unresolved speaker choice retains actual bounded model failure without becoming history or permission',async()=>{
 const {resolveDialogueSubject}=await import('../src/dialogue-subject.ts'),entries=[],raw='{"source":"none"}';
 const a={turnId:'a',turnIndex:0,speaker:'user',quote:'user words',start:0,end:10},b={turnId:'b',turnIndex:1,speaker:'assistant',quote:'answer',start:0,end:6};
 await assert.rejects(recordOperation('dialogue.subject',{question:'which?',a,b},()=>resolveDialogueSubject({manifest:{contextTokens:2048},count:async()=>({prompt_tokens:20}),generate:async()=>({text:raw})},'which?',a,b),async entry=>entries.push(entry)),/Original unavailable/);
 assert.equal(entries.length,2);assert.equal(entries[1].status,'failed');assert.equal(entries[1].output.raw,raw);assert.equal(entries[1].output.reason,'unresolved');validateActivity(entries.slice(1));
 const state=appendTurn(emptyDialogue(),{id:'turn',user:'which?',activity:entries.slice(1)});assert.doesNotMatch(JSON.stringify(historyPayload(dialogueContext(state))),/source|dialogue.subject/);
});
test('invalid planner output is bounded audit evidence only, never accepted or added to model history',async()=>{
 const raw='{"action":"recall","historyIndex":0,"historyPart":"user"}',entries=[];
 const engine={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:10}),generate:async()=>({text:raw})};
 await assert.rejects(recordOperation('dialogue.plan',{question:'first message?'},()=>planDialogue(engine,'first message?',{summary:'',recent:[],refs:[],turnCount:1}),async a=>entries.push(a)),/Invalid model action/);
 assert.equal(entries[1].status,'failed');assert.equal(entries[1].error.code,'planner_protocol');assert.equal(entries[1].output.raw,raw);assert.equal(entries[1].output.reason,'query');assert.equal(entries[1].output.truncated,false);
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
 let ran=false;await assert.rejects(recordOperation('memory.search',input,async()=>{ran=true;},async()=>{throw Error('storage unavailable');}),error=>error.code==='persistence_failure');assert.equal(ran,false);
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

test('turn activity trace commits its current receipt around work and projects only bounded output',async()=>{
 const {createTurnActivityTracer}=await import('../src/harness-activity.ts');assert.equal(typeof createTurnActivityTracer,'function');
 let current=[];const commits=[],trace=createTurnActivityTracer({check:()=>{},readActivities:()=>current,persistActivities:async value=>{current=value;commits.push(value.map(activity=>activity.status));},onFailureRecorded:()=>assert.fail('successful operation marked failed'),diagnosticsEnabled:false,writeDiagnostic:()=>assert.fail('diagnostic written while disabled')});
 const result=await trace('memory.search',input,async()=>({count:1,privateResult:'do not persist'}),value=>({count:value.count}));
 assert.deepEqual(commits,[['running'],['succeeded']]);assert.deepEqual(current[0].output,{count:1});assert.deepEqual(result,{count:1,privateResult:'do not persist'});
});

test('turn activity trace records cancellation once and emits only the enabled failure diagnostic',async()=>{
 const {createTurnActivityTracer}=await import('../src/harness-activity.ts');assert.equal(typeof createTurnActivityTracer,'function');
 let current=[],checks=0,failed=0;const commits=[],diagnostics=[];
 const trace=createTurnActivityTracer({check:()=>{if(++checks===2)throw Error('Stopped');},readActivities:()=>current,persistActivities:async value=>{current=value;commits.push(value.map(activity=>activity.status));},onFailureRecorded:()=>failed++,diagnosticsEnabled:true,writeDiagnostic:value=>diagnostics.push(value)});
 await assert.rejects(trace('memory.search',input,async()=>({count:9})),/Stopped/);
 assert.deepEqual(commits,[['running'],['stopped']]);assert.equal(failed,1);assert.equal(diagnostics.length,1);assert.deepEqual(diagnostics[0],{tool:'memory.search',status:'stopped',code:'stopped',message:'Stopped'});assert.equal(current[0].output,undefined);
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
 for(const tool of ['model.prepare','model.unload','speech.prepare','vision.prepare']){const a=startActivity(tool,{role:tool==='vision.prepare'?'vision':'text',model:tool==='vision.prepare'?'lfm25-vl-450m-q4f16':'4B',allowNetwork:false});const done=finishActivity(a,{output:{completed:true}});validateActivity([done]);assert.equal(done.status,'succeeded');assert.equal(done.input.allowNetwork,false);}
});

test('GPU failure display stays short while original operation diagnostics remain exact',async()=>{
 const {runtimeStatus,needsModelSettings}=await import('../src/runtime-status.ts');const raw='the GPU device was lost (unknown): ID3D12Device::GetDeviceRemovedReason failed with DXGI_ERROR_DEVICE_HUNG (0x887A0006)\n at CheckHRESULTImpl (...D3DError.cpp:121)';
 const receipt=finishActivity(startActivity('dialogue.plan',{question:'Read my local file'}),{error:Error(raw)}),before=structuredClone(receipt);
 assert.equal(runtimeStatus(raw),'GPU unavailable');assert.equal(runtimeStatus('GPU disconnected: device removed'),'GPU unavailable');assert.equal(receipt.error.message,raw);assert.deepEqual(receipt,before);
 for(const value of ['Stopped','Source changed · retry','Generating…','Saved · Inbox/notes.md','Saved · Inbox/DXGI_ERROR_DEVICE_HUNG.md',''])assert.equal(runtimeStatus(value),value);
 const unavailable='Model not prepared · Settings',modelReceipt=finishActivity(startActivity('model.load',{model:'4B'}),{error:Error(unavailable)});
 assert.equal(runtimeStatus(unavailable),'Model not prepared');assert.equal(needsModelSettings(unavailable),true);assert.equal(modelReceipt.error.message,unavailable);
 assert.equal(needsModelSettings('Saved · Model not prepared'),false);
});

test('activity receipts preserve explicit planner and tool protocol failure stages',async()=>{
 const {ModelRuntimeError,PlannerOutputError}=await import('../src/planner-error.ts');
 const entries=[];await assert.rejects(recordOperation('dialogue.plan',{step:0},async()=>{throw new PlannerOutputError('Planner output invalid','{}','action');},async item=>entries.push(item)));
 assert.equal(entries[1].error.code,'planner_protocol');
 const {AgentProtocolError}=await import('../src/agent-loop.ts');
 const receipt=finishActivity(startActivity('dialogue.plan',{step:1}),{error:new AgentProtocolError('Tool is not registered or call is invalid')});
 assert.equal(receipt.error.code,'agent_protocol');
 const model=finishActivity(startActivity('dialogue.plan',{step:2}),{error:new ModelRuntimeError(Error('WebGPU device lost'))});
 assert.equal(model.error.code,'model_runtime');
 const {AgentToolExecutionError}=await import('../src/agent-loop.ts');
 const tool=finishActivity(startActivity('memory.search',{query:'meeting'}),{error:new AgentToolExecutionError('memory.search',Error('PRIVATE_PATH_SENTINEL'))});
 assert.equal(tool.error.code,'tool_execution');
 assert.doesNotMatch(JSON.stringify(tool),/PRIVATE_PATH_SENTINEL/);
});

test('receipt persistence failures are typed and never rerun completed work',async()=>{
 let calls=0,writes=0;let failure;
 try{await recordOperation('memory.search',input,async()=>{calls++;return {count:1};},async()=>{if(++writes===2)throw Error('quota exceeded');});}catch(error){failure=error;}
 assert.equal(calls,1);assert.equal(failure?.code,'persistence_failure');
});

test('custom tool receipt projection strips private content without changing the immediate result',async()=>{
 const {projectAgentActivityResult}=await import('../src/agent-evidence.ts'),body='PRIVATE_NOTE_SENTINEL',result={excerpt:body,path:'Notes/private.md'},entries=[];
 const returned=await recordOperation('user.lookup',{query:'private'},async()=>result,async entry=>entries.push(structuredClone(entry)),value=>projectAgentActivityResult('user.lookup',value));
 assert.equal(returned,result);
 assert.equal(entries[1].status,'succeeded');
 assert.deepEqual(entries[1].output,{kind:'custom_tool_result',resultBytes:new TextEncoder().encode(JSON.stringify(result)).byteLength});
 assert.doesNotMatch(JSON.stringify(entries),/PRIVATE_NOTE_SENTINEL|Notes\/private\.md/);
});

test('unclassified turn failures add one privacy-safe local diagnostic',async()=>{
 const {recordUnclassifiedTurnFailure}=await import('../src/turn-failure-log.ts');let value=null;const local={getItem:()=>value,setItem:(_key,next)=>{value=next;}};
 assert.equal(recordUnclassifiedTurnFailure(local,true,false,Error('PRIVATE PROMPT AND PATH')),true);
 const rows=JSON.parse(value);assert.equal(rows.length,1);assert.equal(rows[0].tool,'dialogue.turn');assert.equal(rows[0].status,'failed');assert.equal(rows[0].code,'operation_failed');assert.equal(rows[0].message,'The local operation failed.');assert.doesNotMatch(value,/PRIVATE PROMPT|PATH/);
});

test('a stage failure already recorded on the turn is not duplicated',async()=>{
 const {recordUnclassifiedTurnFailure}=await import('../src/turn-failure-log.ts');let value=null;const local={getItem:()=>value,setItem:(_key,next)=>{value=next;}};
 assert.equal(recordUnclassifiedTurnFailure(local,true,true,Error('stage failed')),false);assert.equal(value,null);
});

test('only typed receipt persistence failure and explicit stop get specialized labels',async()=>{
 const {recordUnclassifiedTurnFailure}=await import('../src/turn-failure-log.ts'),{ActivityPersistenceError}=await import('../src/harness-activity.ts');let value=null;const local={getItem:()=>value,setItem:(_key,next)=>{value=next;}};
 recordUnclassifiedTurnFailure(local,true,false,new ActivityPersistenceError());recordUnclassifiedTurnFailure(local,true,false,Error('Stopped'));
 const rows=JSON.parse(value);assert.deepEqual(rows.map(row=>[row.status,row.code]),[['failed','persistence_failure'],['stopped','stopped']]);assert.doesNotMatch(value,/Activity record unavailable/);
});

test('disabled logging leaves local storage untouched',async()=>{
 const {recordUnclassifiedTurnFailure}=await import('../src/turn-failure-log.ts');let value=null;const local={getItem:()=>value,setItem:(_key,next)=>{value=next;}};
 assert.equal(recordUnclassifiedTurnFailure(local,false,false,Error('failed')),false);assert.equal(value,null);
});

test('diagnostic storage failure never replaces the original turn failure',async()=>{
 const {recordUnclassifiedTurnFailure}=await import('../src/turn-failure-log.ts'),local={getItem:()=>null,setItem:()=>{throw Error('disk full');}};
 assert.equal(recordUnclassifiedTurnFailure(local,true,false,Error('original failure')),false);
});
