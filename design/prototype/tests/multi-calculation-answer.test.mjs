import test from 'node:test';
import assert from 'node:assert/strict';
import {groundedAnswer} from '../src/grounded-answer.ts';

test('a native answer accepts four independently validated calculations without regeneration',async()=>{
 const calculations=Array.from({length:4},(_,i)=>({expression:`${i+1}+1`,result:i+2,precision:'IEEE-754 binary64'}));
 const engine={manifest:{models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},load:async()=>{throw Error('Unexpected load');},count:async()=>{throw Error('Unexpected count');},generate:async()=>{throw Error('Unexpected generation');}};
 const store={all:async()=>[],search:async()=>{throw Error('Unexpected search');}};
 const request={model:'test',question:'Calculate each value.',query:'Calculate each value.',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs:[],calculations,memoryUsed:false},reply:{answer:'The results are 2, 3, 4, and 5.',sources:[]}};
 const result=await groundedAnswer({store,engine},request);
 assert.equal(result.answer,request.reply.answer);assert.deepEqual(result.sources,[]);
 await assert.rejects(groundedAnswer({store,engine},{...request,toolEvidence:{...request.toolEvidence,calculations:[...calculations.slice(0,3),{...calculations[3],result:99}]}}),/Invalid calculation result/);
});
