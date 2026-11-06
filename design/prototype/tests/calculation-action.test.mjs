import test from 'node:test';
import assert from 'node:assert/strict';
import {createToolRegistry} from '../src/tools/tool-registry.ts';
import {runCalculationAction} from '../src/calculation-action.ts';

const host={check(){},search:async()=>[],resolve:async()=>[]};

function registry(result){
 const entry='Tools/math.calculate/tool.ts';
 return createToolRegistry([{definition:{id:'math.calculate',version:2,effect:'read',network:'none'},entry,sources:[{path:'Tools/math.calculate/SKILL.md',body:'Calculate locally.'},{path:entry,body:'Bundled calculator.'}],run:async()=>result}]);
}

test('local calculations share the registered tool identity, trace and typed result boundary',async()=>{
 const expected=[{expression:'(6 + 4) / 2',result:5,precision:'IEEE-754 binary64'}];
 let recorded;
 const result=await runCalculationAction('(6 + 4) / 2',registry(expected),host,async(tool,input,work)=>{
  recorded={tool,input};
  return work();
 });
 assert.deepEqual(result,expected);
 assert.equal(recorded.tool,'math.calculate');
 assert.equal(recorded.input.expression,'(6 + 4) / 2');
 assert.equal(recorded.input.package,'math.calculate');
 assert.equal(recorded.input.packageVersion,2);
 assert.match(recorded.input.packageSha256,/^[0-9a-f]{64}$/);
});

test('local calculation refuses a malformed result before returning it to a caller',async()=>{
 await assert.rejects(runCalculationAction('1 / 0',registry([{expression:'1 / 0',result:Infinity,precision:'IEEE-754 binary64'}]),host,async(_tool,_input,work)=>work()),/Invalid calculation result/);
});

test('calculation formatting distinguishes equality from approximate results',async()=>{
 const {formatCalculation}=await import('../src/calculation-action.ts');
 assert.equal(formatCalculation({expression:'1200 / 3',result:400,precision:'IEEE-754 binary64'},'1200 / 3','円/人'),'1200 / 3 = 400 円/人');
 assert.equal(formatCalculation({expression:'1000 / 3',result:'333.333',precision:'decimal',rounded:true},'1000 / 3','円/人'),'1000 / 3 ≈ 333.333 円/人');
 assert.equal(formatCalculation({expression:'1 / 3',result:'0.333',precision:'decimal',rounded:true}),'≈ 0.333');
});

test('a model-proposed calculation referencing a cited prior answer requires source review',async()=>{
 const {needsSourcedCalculationReview}=await import('../src/calculation-action.ts');
 const prior={id:'sourced',user:'How much water?',answer:'7 L',refs:[{noteId:'n',revision:1,start:0,end:3,quote:'7 L'}]};
 assert.equal(needsSourcedCalculationReview('その水を3人で分けると？',prior),true);
 assert.equal(needsSourcedCalculationReview('Divide that by 3',prior),true);
 assert.equal(needsSourcedCalculationReview('12 * 3',prior),false);
 assert.equal(needsSourcedCalculationReview('その結果を3で割って',{...prior,refs:[]}),false);
});

test('a follow-up binds only the immediately previous verified exact calculation',async()=>{
 const {continuedCalculationInput}=await import('../src/calculation-action.ts');const {makeDecimalReceipt}=await import('../src/tools/math.calculate/decimal-receipt.ts');
 const receipt=makeDecimalReceipt('12 × 3 + 5'),previous={id:'t',user:'12 × 3 + 5 を計算して',answer:'12 × 3 + 5 = 41',status:'Calculated',activity:[{tool:'math.calculate',status:'succeeded',output:[receipt]}]};
 assert.equal(continuedCalculationInput('その結果を２で割って',previous),'41 / 2');
 for(const [request,expression] of [['その結果に５を足して','41 + 5'],['その結果から2を引いてください','41 - 2'],['その結果に3をかけて','41 * 3']])assert.equal(continuedCalculationInput(request,previous),expression);
 for(const [request,expression] of [['Now divide that by 3','41 / 3'],['Then split it by 2','41 / 2'],['Add 5 to that','41 + 5'],['Please subtract 2 from the result.','41 - 2'],['Now multiply this by 3','41 * 3']])assert.equal(continuedCalculationInput(request,previous),expression);
 for(const request of ['Now divide that by 3 and save it','Add 5 to that, then delete the note','Explain why I divided that by 3'])assert.equal(continuedCalculationInput(request,previous),null);
 const cited={...previous,refs:[{noteId:'n1',revision:1,start:0,end:12,quote:'Seven liters'}]};
 assert.equal(continuedCalculationInput('Now divide that by 3',cited),null);
 const {isSourcedArithmeticQuestion}=await import('../src/calculation-action.ts');assert.equal(isSourcedArithmeticQuestion('Now divide that by 3',cited),true);
 assert.equal(continuedCalculationInput('その結果に5を足して保存して',previous),null);
 assert.equal(continuedCalculationInput('その結果を2で割って保存して',previous),null);
 assert.equal(continuedCalculationInput('その結果を2で割って',{...previous,answer:'99'}),null);
 assert.equal(continuedCalculationInput('その結果を2で割って',{...previous,activity:[{...previous.activity[0],output:[{...receipt,result:'99'}]}]}),null);
 assert.equal(continuedCalculationInput('その結果を2で割って',{...previous,activity:[{...previous.activity[0],output:[makeDecimalReceipt('1 / 3')]}]}),null);
 assert.equal(continuedCalculationInput('その結果を2で割って',{id:'other',user:'hello'}),null);
});

test('yen purchase continuation checks the original request, exact receipt and display',async()=>{
 const {continuedYenCalculation}=await import('../src/calculation-action.ts');
 const {makeDecimalReceipt}=await import('../src/tools/math.calculate/decimal-receipt.ts');
 const receipt=makeDecimalReceipt('1250 * 3');
 const previous={id:'purchase',user:'1250円のものを3個買うといくら？',answer:'1250 * 3 = 3750 円',status:'Calculated',activity:[{tool:'math.calculate',status:'succeeded',output:[receipt]}]};
 assert.deepEqual(continuedYenCalculation('その結果を3で割って',previous),{expression:'3750 / 3',unit:'円'});
 assert.equal(continuedYenCalculation('その結果を3で割って保存して',previous),null);
 assert.equal(continuedYenCalculation('その結果を3で割って',{...previous,answer:'1250 * 3 = 999 円'}),null);
 assert.equal(continuedYenCalculation('その結果を3で割って',{...previous,user:'1000円のものを3個買うといくら？'}),null);
 assert.equal(continuedYenCalculation('その結果を3で割って',{...previous,activity:[{...previous.activity[0],output:[{...receipt,result:'999'}]}]}),null);
});
