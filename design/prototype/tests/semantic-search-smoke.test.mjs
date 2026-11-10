import test from 'node:test';
import assert from 'node:assert/strict';
import {runSemanticSearchSmoke} from '../src/semantic-search-smoke.ts';

test('local embedding smoke ranks its matching synthetic passage first without persisting data',async()=>{
 const calls=[];const receipt=await runSemanticSearchSmoke(async texts=>{calls.push([...texts]);return [[1,0],[0.98,0.02],[0.1,0.9]];});
 assert.equal(calls.length,1);assert.equal(calls[0].length,3);assert.match(calls[0][0],/青いランタン/);
 assert.deepEqual(receipt,{passed:true,matchScore:1,distractorScore:0.11,matchRank:1});
});

test('local embedding smoke fails clearly when distractor outranks the match',async()=>{
 const receipt=await runSemanticSearchSmoke(async()=>[[1,0],[0,1],[1,0]]);
 assert.equal(receipt.passed,false);assert.equal(receipt.matchRank,2);
});

test('local embedding smoke validates shape and honors cancellation',async()=>{
 await assert.rejects(runSemanticSearchSmoke(async()=>[[1,0]]),/Embedding count mismatch/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(runSemanticSearchSmoke(async()=>[[1],[1],[1]],controller.signal));
});
