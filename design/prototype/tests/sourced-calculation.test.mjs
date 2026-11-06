import test from 'node:test';
import assert from 'node:assert/strict';
import {createNote,reviseNote,withdrawNote} from '../../../dist/core.js';
import {executeReviewedSourcedCalculation,validateSourcedCalculationProposal,bindSourcedCalculationCandidate,proposeSourcedCalculation} from '../src/sourced-calculation.ts';
import {makeDecimalReceipt} from '../src/tools/math.calculate/decimal-receipt.ts';

test('candidate generation is bounded and validates model output without executing a tool',async()=>{
 const note=createNote({body:'水は七リットル。'}),ref={noteId:note.id,revision:1,start:0,end:8,quote:'水は七リットル。'},question='その水を3人で分けると？';let calls=0;
 const modelOutput={operation:'divide',sourceOperandIndex:0,sourceIndex:0,sourceQuote:'七リットル',sourceUnit:'リットル',requestQuote:'3'},engineFormat={type:'sourced-calculation',sourceCount:1};
 const engine={manifest:{contextTokens:1000},count:async(messages,format)=>{assert.match(JSON.stringify(messages),/水は七リットル/);assert.deepEqual(format,engineFormat);return {prompt_tokens:100};},generate:async(_messages,_budget,format)=>{calls++;assert.deepEqual(format,engineFormat);return {text:JSON.stringify(modelOutput)};}};
 const proposal=await proposeSourcedCalculation({engine,records:[note],question,sources:[ref],check:()=>{}});assert.equal(validateSourcedCalculationProposal([note],question,proposal,[ref]).expression,'7 / 3');assert.equal(calls,1);
 await assert.rejects(proposeSourcedCalculation({engine:{...engine,generate:async()=>({text:'not JSON'})},records:[note],question,sources:[ref],check:()=>{}}),/candidate/);
 await assert.rejects(proposeSourcedCalculation({engine:{...engine,count:async()=>({prompt_tokens:900})},records:[note],question,sources:[ref],check:()=>{}}),/context/);
 await assert.rejects(proposeSourcedCalculation({engine:{...engine,generate:async()=>({text:JSON.stringify({...modelOutput,tool:'delete'})})},records:[note],question,sources:[ref],check:()=>{}}),/candidate/);
});

test('model candidate binds exact unique quotes to selected evidence and the user request',()=>{
 const note=createNote({body:'水は七リットル。'}),question='その水を3人で分けると？',parent={noteId:note.id,revision:1,start:0,end:8,quote:'水は七リットル。'};
 const candidate={operation:'divide',operands:[{kind:'source',source:0,quote:'七リットル',unit:'リットル'},{kind:'request',quote:'3'}]};
 const result=bindSourcedCalculationCandidate([note],question,candidate,[parent]);
 assert.equal(validateSourcedCalculationProposal([note],question,result,[parent]).expression,'7 / 3');
 assert.throws(()=>bindSourcedCalculationCandidate([note],question,{...candidate,operands:[{...candidate.operands[0],quote:'八リットル'},candidate.operands[1]]},[parent]),/quote/);
 assert.throws(()=>bindSourcedCalculationCandidate([note],'3人と3人',candidate,[parent]),/unique/);
 assert.throws(()=>bindSourcedCalculationCandidate([note],question,{...candidate,operands:[{...candidate.operands[0],source:1},candidate.operands[1]]},[parent]),/source/);
 assert.throws(()=>bindSourcedCalculationCandidate([note],question,{...candidate,operands:[{...candidate.operands[0],source:'0'},candidate.operands[1]]},[parent]),/source index/);
 assert.throws(()=>bindSourcedCalculationCandidate([note],question,{...candidate,operands:[{...candidate.operands[0],extra:'ignored?'},candidate.operands[1]]},[parent]),/source shape/);
 assert.throws(()=>bindSourcedCalculationCandidate([note],question,{...candidate,extra:'unsafe'},[parent]),/candidate/);
});

test('binds exact original numeric and request spans without claiming semantic review',()=>{
 const note=createNote({body:'水は七リットルです。'}),question='その水を3人で分けると？';
 const ref={noteId:note.id,revision:1,start:2,end:7,quote:'七リットル'};
 const proposal={operation:'divide',operands:[{kind:'source',ref,unit:'リットル'},{kind:'request',start:4,end:5}]};
 const result=validateSourcedCalculationProposal([note],question,proposal,[ref]);
 assert.equal(result.expression,'7 / 3');assert.deepEqual(result.sources,[ref]);assert.equal(result.requiresReview,true);
 assert.throws(()=>validateSourcedCalculationProposal([reviseNote(note,{body:'水は八リットルです。'},1)],question,proposal,[ref]),/Source changed/);
 assert.throws(()=>validateSourcedCalculationProposal([withdrawNote(note,1)],question,proposal,[ref]),/Source changed/);
 assert.throws(()=>validateSourcedCalculationProposal([note],question,{...proposal,operands:[{...proposal.operands[0],unit:'kg'},proposal.operands[1]]},[ref]),/unit mismatch/);
});

test('rejects invented, partial, unsupported or absent operands',()=>{
 const note=createNote({body:'価格は１２３円。'}),question='3人で分ける';
 const ref={noteId:note.id,revision:1,start:3,end:7,quote:'１２３円'};
 const proposal={operation:'divide',operands:[{kind:'source',ref,unit:'円'},{kind:'request',start:0,end:1}]};
 assert.equal(validateSourcedCalculationProposal([note],question,proposal,[ref]).expression,'123 / 3');
 assert.throws(()=>validateSourcedCalculationProposal([note],question,{...proposal,operands:[{kind:'source',ref:{...ref,quote:'９９９円'},unit:'円'},proposal.operands[1]]},[ref]),/Source changed/);
 assert.throws(()=>validateSourcedCalculationProposal([note],'13人', {...proposal,operands:[proposal.operands[0],{kind:'request',start:1,end:2}]},[ref]),/boundary/);
 assert.throws(()=>validateSourcedCalculationProposal([note],'十三人', {...proposal,operands:[proposal.operands[0],{kind:'request',start:1,end:2}]},[ref]),/boundary/);
 assert.throws(()=>validateSourcedCalculationProposal([note],question,{...proposal,operands:[{kind:'source',ref:{...ref,start:4,quote:'２３円'},unit:'円'},proposal.operands[1]]},[ref]),/boundary/);
 assert.throws(()=>validateSourcedCalculationProposal([note],question,{...proposal,operands:[{kind:'source',ref,unit:''},proposal.operands[1]]},[ref]),/Unsupported/);
 assert.throws(()=>validateSourcedCalculationProposal([note],question,{operation:'divide',operands:[proposal.operands[1],proposal.operands[1]]},[ref]),/Source required/);
});

test('accepts only the uniquely cited part of selected evidence',()=>{
 const note=createNote({body:'水は七リットル。予備は八リットル。'}),question='3人';
 const full=note.revisions[0].body,selected={noteId:note.id,revision:1,start:0,end:full.length,quote:full,citedQuote:'水は七リットル'};
 const operand=(start,end,quote)=>({kind:'source',ref:{noteId:note.id,revision:1,start,end,quote},unit:'リットル'});
 const proposal={operation:'divide',operands:[operand(2,7,'七リットル'),{kind:'request',start:0,end:1}]};
 assert.equal(validateSourcedCalculationProposal([note],question,proposal,[selected]).expression,'7 / 3');
 const offset=full.indexOf('八リットル');
 assert.throws(()=>validateSourcedCalculationProposal([note],question,{...proposal,operands:[operand(offset,offset+5,'八リットル'),proposal.operands[1]]},[selected]),/selected evidence/);
 assert.throws(()=>validateSourcedCalculationProposal([note],question,proposal,[{...selected,citedQuote:'リットル'}]),/selected evidence/);
 assert.throws(()=>validateSourcedCalculationProposal([note],question,proposal,[]),/Invalid calculation proposal/);
});

test('review receives the selected original passage alongside each source operand',async()=>{
 const note=createNote({body:'水は七リットル。予備は八リットル。'}),body=note.revisions[0].body;
 const parent={noteId:note.id,revision:1,start:0,end:body.length,quote:body,citedQuote:'水は七リットル'};
 const ref={noteId:note.id,revision:1,start:2,end:7,quote:'七リットル'};
 const proposal={operation:'divide',operands:[{kind:'source',ref,unit:'リットル'},{kind:'request',start:0,end:1}]};
 const result=await executeReviewedSourcedCalculation({question:'3人',proposal,allowedSources:[parent],currentRecords:async()=>[note],check:()=>{},review:async candidate=>{
  assert.deepEqual(candidate.evidence,[{operandIndex:0,source:ref,passage:parent}]);
  candidate.evidence[0].passage.quote='changed';return true;
 },calculate:async expression=>makeDecimalReceipt(expression)});
 assert.equal(result.kind,'calculated');assert.equal(parent.quote,body);
});

test('reviewed calculation revalidates source and returns checked receipt with citations',async()=>{
 const note=createNote({body:'水は七リットルです。'}),ref={noteId:note.id,revision:1,start:2,end:7,quote:'七リットル'};
 const proposal={operation:'divide',operands:[{kind:'source',ref,unit:'リットル'},{kind:'request',start:4,end:5}]};let records=[note],calls=0,approved=false;
 const input={question:'その水を3人で分けると？',proposal,allowedSources:[ref],currentRecords:async()=>records,check:()=>{},review:async candidate=>{assert.equal(calls,0);assert.equal(candidate.expression,'7 / 3');candidate.sources[0].quote='changed';approved=true;return true;},calculate:async expression=>{assert.equal(approved,true);calls++;return makeDecimalReceipt(expression);}};
 const result=await executeReviewedSourcedCalculation(input);assert.equal(result.kind,'calculated');assert.equal(result.receipt.expression,'7 / 3');assert.equal(result.receipt.rounded,true);assert.deepEqual(result.sources,[ref]);assert.equal(calls,1);
 calls=0;assert.deepEqual(await executeReviewedSourcedCalculation({...input,review:async()=>false}),{kind:'cancelled'});assert.equal(calls,0);
 calls=0;await assert.rejects(executeReviewedSourcedCalculation({...input,review:async()=>{records=[reviseNote(note,{body:'水は八リットルです。'},1)];return true;}}),/Source changed/);assert.equal(calls,0);
 records=[note];await assert.rejects(executeReviewedSourcedCalculation({...input,calculate:async expression=>{records=[withdrawNote(note,1)];return makeDecimalReceipt(expression);}}),/Source changed/);
});
