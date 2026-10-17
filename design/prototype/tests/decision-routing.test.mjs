import test from 'node:test';import assert from 'node:assert/strict';
import {decisionRoutingQuestion,decisionRoutingState,decisionRoute,routeWithDecision} from '../src/decision-routing.ts';
import {decisionManifest} from '../src/decision-assets.ts';
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
});
test('only a typed work context limit defers; Stop, crash, malformed output and receipt failures propagate',async()=>{
 let calls=0;const trace=async(_tool,_input,work,project)=>{calls++;const value=await work();project(value);return value;};const engine={classify:async()=>result()};assert.equal((await routeWithDecision(engine,'q',{summary:'',recent:[],refs:[]},[],trace,()=>{})).request.action,'answer');assert.equal(calls,1);
 const limit=Object.assign(Error('Decision context limit'),{code:'decision_context_limit'});const limited={classify:async()=>{throw limit;}};assert.deepEqual(await routeWithDecision(limited,'q',context,[],trace,()=>{}),{request:null,reason:'context-limit'});
 for(const error of [Error('Stopped'),Error('Decision runtime failed')])await assert.rejects(routeWithDecision({classify:async()=>{throw error;}},'q',context,[],trace,()=>{}),e=>e===error);
 const ledger=Object.assign(Error('Receipt failed'),{code:'decision_context_limit'});await assert.rejects(routeWithDecision(limited,'q',context,[],async(_t,_i,work)=>{try{await work();}catch{}throw ledger;},()=>{}),e=>e===ledger);
 await assert.rejects(routeWithDecision({classify:async()=>({...result(),revision:'forged'})},'q',context,[],trace,()=>{}),/Invalid decision route/);
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
