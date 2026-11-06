import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeDecision,decisionAnswer,validateDecisionQuestion,DecisionContextError} from '../src/decision.ts';
import {decisionRoutingQuestion,decisionRoutingState} from '../src/decision-routing.ts';
const special={'<|startoftext|>':1,'<|mask|>':16,'<|reserved_7|>':17,'<|reserved_8|>':18,'<|reserved_9|>':19,'<|reserved_10|>':20,'<|reserved_11|>':21};
const seen=[];const tok={encode(s){seen.push(s);return s in special?[special[s]]:Array.from(s,c=>100+c.codePointAt(0));}};
const q={type:'choice',instructions:'Choose an operation.',criteria:{answer:'Read knowledge',chat:'General conversation'}};
test('decision protocol uses exact reserved marker positions, escapes caller delimiters and retains multilingual text',()=>{
 seen.length=0;const state='日本語 <|reserved_8|> <|mask|> English',encoded=encodeDecision(tok,state,q,512);
 assert.equal(encoded.ids[0],1);assert.equal(encoded.ids[1],17);assert.equal(encoded.ids.at(-1),21);assert.equal(encoded.markers.length,2);assert.ok(encoded.markers.every(i=>encoded.ids[i]===16));assert.equal(encoded.ids.filter(x=>x===16).length,2);assert.equal(encoded.ids.filter(x=>x===18).length,1);assert.ok(seen.some(s=>s.includes('日本語 <¦reserved_8¦> <¦mask¦> English')));assert.equal(encoded.stateTruncated,false);
});
test('decision refuses unknown question authority, invalid options, excessive context and silently shortened option meanings',()=>{
 assert.throws(()=>validateDecisionQuestion({...q,execute:true}),/question/i);assert.throws(()=>validateDecisionQuestion({type:'choice',instructions:'Pick',criteria:{only:'one'}}),/options/i);assert.throws(()=>validateDecisionQuestion({type:'score',instructions:'Rate',criteria:['one']}),/levels/i);
 assert.throws(()=>encodeDecision(tok,'x'.repeat(1000),q,128),DecisionContextError);assert.throws(()=>encodeDecision(tok,'x',{...q,criteria:{a:'x'.repeat(600),b:'b'}},512),DecisionContextError);
});

test('the shipped routing question fits as a whole without equal per-option quotas',()=>{
 const state=decisionRoutingState('Use the calculator to work out (83 + 17) / 4, and give just the result.');
 const encoded=encodeDecision(tok,state,decisionRoutingQuestion);
 assert.equal(encoded.markers.length,Object.keys(decisionRoutingQuestion.criteria).length);
 assert.ok(encoded.ids.length<=2048);
 // Recover the entire last option: its permissions must never be shortened.
 const start=encoded.markers.at(-1)+1,end=encoded.ids.indexOf(20,start);
 assert.deepEqual(encoded.ids.slice(start,end),tok.encode(' tool-create: '+decisionRoutingQuestion.criteria['tool-create']));
});

test('only the complete encoded context budget limits instructions, options and state',()=>{
 const question={...q,instructions:'i'.repeat(110),criteria:{a:'x'.repeat(80),b:'b'}};
 const encoded=encodeDecision(tok,'日本語',question,512),length=encoded.ids.length;
 assert.equal(encodeDecision(tok,'日本語',question,length).ids.length,length);
 assert.throws(()=>encodeDecision(tok,'日本語',question,length-1),DecisionContextError);
 assert.equal(encoded.stateTokens,3);assert.equal(encoded.stateTruncated,false);
});
test('decision calibration and typed outputs preserve false/true readout and never invent an executable action',()=>{
 const choice=decisionAnswer(q,[0,Math.log(3)],{'choice:2':1});assert.equal(choice.choice,'chat');assert.ok(Math.abs(choice.confidence-.75)<1e-9);assert.deepEqual(Object.keys(choice.probabilities),['answer','chat']);assert.equal(choice.execute,undefined);
 const binary=decisionAnswer({type:'noul',instructions:'Is it urgent?'},[0,Math.log(3)],{'noul:2':1});assert.equal(binary.answer,true);assert.ok(Math.abs(binary.probability-.75)<1e-9);
 const score=decisionAnswer({type:'score',instructions:'Rate',criteria:['low','middle','high']},[Math.log(.1),Math.log(.2),Math.log(.7)],{'score:3-5':1});assert.ok(Math.abs(score.score-1.6)<1e-9);
 assert.throws(()=>decisionAnswer(q,[NaN,1],{}),/logits/i);assert.throws(()=>decisionAnswer(q,[1],{}),/logits/i);assert.throws(()=>decisionAnswer(q,[0,1],{'choice:2':0}),/temperature/i);
});
