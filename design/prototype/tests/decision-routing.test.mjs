import test from 'node:test';import assert from 'node:assert/strict';
import {decisionRoutingQuestion,decisionRoutingState,decisionRoute as route,routeWithDecision} from '../src/decision-routing.ts';
import {explicitSavedKnowledgeQuestion,resolveTurnRoute,savedKnowledgeSearchQuery} from '../src/turn-router.ts';
import {decisionManifest} from '../src/decision-assets.ts';
const identity={model:decisionManifest.id,revision:decisionManifest.conversion.revision,inputLimit:decisionManifest.inputLimit,scope:'text-only'};
const decisionRoute=(value,q,c,attachments=[])=>route(value,q,c,identity,attachments);
const empty={summary:'',recent:[],refs:[],turnCount:0};
const context={summary:'Earlier summary',recent:[{id:'t',user:'Keep original words',answer:'Earlier response',activity:[{tool:'not model context'}],refs:[{quote:'private citation body'}]}],refs:[{quote:'not authority'}],turnCount:1,lastAnswerIndex:0};
const result=(choice='answer',confidence=.98)=>{const names=Object.keys(decisionRoutingQuestion.criteria),probabilities=Object.fromEntries(names.map(k=>[k,k===choice?confidence:(1-confidence)/(names.length-1)]));return {answer:{type:'choice',choice,confidence,probabilities},model:decisionManifest.id,revision:decisionManifest.conversion.revision,scope:'text-only',device:'webgpu',inputTokens:120,elapsedMs:10};};
test('routing isolates exact multilingual current intent from historical instructions, receipts and source bodies',()=>{
 const text='最初の発言を、そのまま読んで。';const state=JSON.parse(decisionRoutingState(text,[{name:'image.png',kind:'image',status:'Image text extracted'}]));assert.equal(state.currentRequest,text);assert.equal(state.history,undefined);assert.ok(!JSON.stringify(state).includes(context.summary));assert.ok(!JSON.stringify(state).includes(context.recent[0].user));assert.equal(state.currentAttachments[0].status,'Image text extracted');assert.ok(!JSON.stringify(state).includes('private citation body'));assert.ok(!JSON.stringify(state).includes('not model context'));assert.ok(Object.keys(decisionRoutingQuestion.criteria).includes('recall'));
});
test('only validated confident read-only decisions skip planner and retain exact query',()=>{
 for(const action of ['answer','summary','chat'])assert.deepEqual(decisionRoute(result(action),'  元の質問？',empty),{request:{action,query:'  元の質問？'},reason:'confident-read-only'});
 for(const action of ['recall','transform','capture','edit','search','read','schedule'])assert.deepEqual(decisionRoute(result(action),'x',empty),{request:null,reason:'structured-request'});
 assert.deepEqual(decisionRoute(result('answer',.8),'x',empty),{request:null,reason:'ambiguous'});
 for(const mutate of [r=>r.answer.choice='delete',r=>r.answer.confidence=NaN,r=>r.answer.probabilities.answer=1.1,r=>r.revision='other',r=>r.scope='omni',r=>r.inputTokens=9999,r=>delete r.answer.probabilities.recall]){const r=result();mutate(r);assert.throws(()=>decisionRoute(r,'x',empty),/Invalid decision route/);}
 for(const invalid of [null,undefined,0,'answer',[],{}, {answer:{type:'choice',choice:'chat',confidence:1,probabilities:{}}},{...result(),permission:'write'},{...result(),answer:{...result().answer,tool:'memory.read'}}])assert.throws(()=>decisionRoute(invalid,'x',empty),/Invalid decision route/);
});
test('only a typed work context limit defers; Stop, crash, malformed output and receipt failures propagate',async()=>{
 let calls=0;const trace=async(_tool,_input,work,project)=>{calls++;const value=await work();project(value);return value;};const engine={identity,classify:async()=>result()};assert.equal((await routeWithDecision(engine,'q',{summary:'',recent:[],refs:[]},[],trace,()=>{})).request.action,'answer');assert.equal(calls,1);
 const limit=Object.assign(Error('Decision context limit'),{code:'decision_context_limit'});const limited={identity,classify:async()=>{throw limit;}};assert.deepEqual(await routeWithDecision(limited,'q',context,[],trace,()=>{}),{request:null,reason:'context-limit'});
 for(const error of [Error('Stopped'),Error('Decision runtime failed')])await assert.rejects(routeWithDecision({identity,classify:async()=>{throw error;}},'q',context,[],trace,()=>{}),e=>e===error);
 const ledger=Object.assign(Error('Receipt failed'),{code:'decision_context_limit'});await assert.rejects(routeWithDecision(limited,'q',context,[],async(_t,_i,work)=>{try{await work();}catch{}throw ledger;},()=>{}),e=>e===ledger);
 await assert.rejects(routeWithDecision({identity,classify:async()=>({...result(),revision:'forged'})},'q',context,[],trace,()=>{}),/Invalid decision route/);
 await assert.rejects(routeWithDecision(engine,'q',context,[],trace,()=>{throw Error('Stopped');}),/Stopped/);
});

test('intent cannot replace history-resolved retrieval queries, while current input evidence keeps its fixed scope',()=>{
 for(const action of ['answer','summary']){
  assert.deepEqual(decisionRoute(result(action),'What about the second one?',context),{request:null,reason:'contextual-query'});
  assert.deepEqual(decisionRoute(result(action),'this file',{...empty,currentFile:{noteId:'selected',revision:2}}),{request:null,reason:'contextual-query'});
  assert.equal(decisionRoute(result(action),'What about the second one?',context,[{name:'current.txt',kind:'text',status:'Text available'}]).request.action,action);
 }
 assert.equal(decisionRoute(result('chat'),'Hello',context).request.action,'chat');
});


test('routing uses the pinned adapter identity independently of D1 or media roles',async()=>{
 const other={model:'another-local-decision',revision:'pinned-other-revision',inputLimit:512,scope:'text-only'},answer={...result(),model:other.model,revision:other.revision};
 assert.equal(route(answer,'q',empty,other).request.action,'answer');assert.throws(()=>route(answer,'q',empty,identity),/Invalid decision route/);
 const receipts=[],engine={identity:other,classify:async()=>answer};const trace=async(_tool,input,work)=>{receipts.push(input);return work();};
 assert.equal((await routeWithDecision(engine,'q',empty,[],trace,()=>{})).request.action,'answer');assert.equal(receipts[0].model,other.model);assert.equal(receipts[0].scope,'text-only');assert.equal(receipts[0].inputLimit,512);
 engine.classify=async()=>{engine.identity={...other,revision:'changed'};return answer;};await assert.rejects(routeWithDecision(engine,'q',empty,[],trace,()=>{}),/selection changed/);
 assert.throws(()=>route(answer,'q',empty,{...other,inputLimit:0}),/runtime identity/);assert.throws(()=>route({...answer,scope:'omni'},'q',empty,other),/Invalid decision route/);
});

test('explicit local requests bypass both optional decision routing and text planning',async()=>{
 const calls=[];const explicit={action:'read',query:'Notes/one.md'};
 const result=await resolveTurnRoute({current:explicit,question:'Open Notes/one.md',select:async()=>{calls.push('decision');return {request:null,reason:'structured-request'};},plan:async()=>{calls.push('planner');return {action:'chat',query:'wrong'};},check:()=>calls.push('check')});
 assert.deepEqual(result,{request:explicit,source:'explicit'});assert.deepEqual(calls,['check']);
});

test('an explicit saved-note question takes only the cited read path across text models',async()=>{
 const question='In the saved blue lantern meeting note, what time and room are recorded?';
 const direct=explicitSavedKnowledgeQuestion(question);
 assert.deepEqual(direct,{action:'answer',query:'blue lantern meeting',target:'knowledge'});
 let planned=0;
 const routed=await resolveTurnRoute({current:direct,question,select:async()=>{planned++;return {request:null,reason:'ambiguous'};},plan:async()=>{planned++;return {action:'recall',target:'current'};},check:()=>{}});
 assert.equal(routed.source,'explicit');assert.equal(planned,0);
 assert.deepEqual(explicitSavedKnowledgeQuestion('保存した会議メモには何時とどの部屋が記録されていますか？'),{action:'answer',query:'保存した会議メモには何時とどの部屋が記録されていますか？',target:'knowledge'});
 const timed='In the saved blue lantern meeting note, how many minutes before 15:00 is the meeting? Cite the note.';
 assert.deepEqual(explicitSavedKnowledgeQuestion(timed),{action:'answer',query:'blue lantern meeting',target:'knowledge'});
 const separated='What date and time is the saved blue lantern meeting? Cite the note.';
 assert.deepEqual(explicitSavedKnowledgeQuestion(separated),{action:'answer',query:'blue lantern meeting',target:'knowledge'});
 assert.deepEqual(explicitSavedKnowledgeQuestion(separated,false,true),{action:'answer',query:'blue lantern meeting',target:'knowledge'});
 assert.equal(savedKnowledgeSearchQuery('What is written in the saved note?'),'What is written in the saved note?');
 for(const q of ['What did I say about my saved note?','What is in this file?','Write a new note about my notes.','Delete my saved note','What date is the saved blue lantern meeting?','What time is it?'])assert.equal(explicitSavedKnowledgeQuestion(q),null,q);
 assert.equal(explicitSavedKnowledgeQuestion(question,true),null);
 assert.deepEqual(explicitSavedKnowledgeQuestion(question,false,true),direct);
 assert.equal(explicitSavedKnowledgeQuestion('What is in my note?',false,true),null);
});

test('confident decision request skips planning; inconclusive decision falls back exactly once',async()=>{
 const calls=[],answer={action:'answer',query:'What is saved?'},plan={action:'chat',query:'Fallback'};
 const confident=await resolveTurnRoute({current:null,question:'What is saved?',select:async()=>{calls.push('decision');return {request:answer,reason:'confident-read-only'};},plan:async()=>{calls.push('planner');return plan;},check:()=>calls.push('check')});
 assert.deepEqual(confident,{request:answer,source:'decision',reason:'confident-read-only'});assert.deepEqual(calls,['check','decision','check']);
 calls.length=0;
 const fallback=await resolveTurnRoute({current:null,question:'Change the file',select:async()=>{calls.push('decision');return {request:null,reason:'structured-request'};},plan:async()=>{calls.push('planner');return plan;},check:()=>calls.push('check')});
 assert.deepEqual(fallback,{request:plan,source:'planner',decisionReason:'structured-request'});assert.deepEqual(calls,['check','decision','check','planner','check']);
});

test('decision failure or cancellation never falls through to planner',async()=>{
 const stopped=Error('Stopped');let planned=0;
 await assert.rejects(resolveTurnRoute({current:null,question:'Do work',select:async()=>{throw stopped;},plan:async()=>{planned++;return {};},check:()=>{}}),error=>error===stopped);
 let checks=0;
 await assert.rejects(resolveTurnRoute({current:null,question:'Do work',select:async()=>({request:null,reason:'ambiguous'}),plan:async()=>{planned++;return {};},check:()=>{if(++checks===2)throw stopped;}}),error=>error===stopped);
 assert.equal(planned,0);
});

test('decision-first routing prepares its continuation only after selection and once before fallback planning',async()=>{
 const calls=[];const check=()=>{};
 const decision=await resolveTurnRoute({current:null,question:'Question',check,select:async()=>{calls.push('decision');return {request:{action:'chat'},reason:'selected'};},prepareContinuation:async()=>{calls.push('text');},plan:async()=>{calls.push('plan');return {action:'answer'};}});
 assert.equal(decision.source,'decision');assert.deepEqual(calls,['decision','text']);calls.length=0;
 const fallback=await resolveTurnRoute({current:null,question:'Question',check,select:async()=>{calls.push('decision');return {request:null,reason:'contextual-query'};},prepareContinuation:async()=>{calls.push('text');},plan:async()=>{calls.push('plan');return {action:'answer'};}});
 assert.equal(fallback.source,'planner');assert.deepEqual(calls,['decision','text','plan']);calls.length=0;
 await resolveTurnRoute({current:{action:'read'},question:'Question',check,prepareContinuation:async()=>{throw Error('Must not prepare explicit route');},plan:async()=>{throw Error('Must not plan');}});
 await assert.rejects(resolveTurnRoute({current:null,question:'Question',check,prepareContinuation:async()=>{throw Error('Release failed');},plan:async()=>{calls.push('plan');return {action:'answer'};}}),/Release failed/);assert.deepEqual(calls,[]);
 let stopped=false;await assert.rejects(resolveTurnRoute({current:null,question:'Question',check:()=>{if(stopped)throw Error('Stopped');},prepareContinuation:async()=>{stopped=true;},plan:async()=>{calls.push('late plan');return {action:'answer'};}}),/Stopped/);assert.deepEqual(calls,[]);
});
