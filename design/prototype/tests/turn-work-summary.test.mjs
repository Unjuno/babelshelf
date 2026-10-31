import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeTurnWork} from '../src/turn-work-summary.ts';

function activity(tool,startedAt,finishedAt,status='succeeded',output){return {schema:1,id:`${tool}-${startedAt}`,tool,input:null,startedAt,finishedAt,status,...(output===undefined?{}:{output})};}

test('turn summary totals only observed model metrics and registered agent tool time',()=>{
 const rows=[
  activity('dialogue.plan','2026-01-01T00:00:00.000Z','2026-01-01T00:00:01.000Z','succeeded',{inference:{promptTokens:120,outputTokens:25,countMs:3.5,generationWallMs:700.5}}),
  activity('dialogue.plan','2026-01-01T00:00:01.000Z','2026-01-01T00:00:02.000Z','succeeded',{inference:{promptTokens:100,outputTokens:18,countMs:2.2,generationWallMs:600.3}}),
  activity('math.calculate','2026-01-01T00:00:02.000Z','2026-01-01T00:00:02.025Z'),
  activity('tools.search','2026-01-01T00:00:02.025Z','2026-01-01T00:00:02.030Z'),
  activity('knowledge.answer','2026-01-01T00:00:02.030Z','2026-01-01T00:00:03.000Z'),
  activity('knowledge.answer','2026-01-01T00:00:03.000Z','2026-01-01T00:00:04.000Z','succeeded',{model:{id:'test'},sourceCount:1,inference:{measuredModelCalls:1,promptTokens:80,outputTokens:12,countMs:1.1,generationWallMs:150.5}}),
  activity('external.shell','2026-01-01T00:00:04.000Z','2026-01-01T00:00:09.000Z'),
 ];
 const summary=summarizeTurnWork(rows);assert.ok(summary);
 const {tokenCountMs,...totals}=summary;assert.deepEqual(totals,{measuredModelCalls:3,promptTokens:300,outputTokens:55,generationMs:1451.3,measuredToolCalls:2,toolElapsedMs:30});
 assert.ok(Math.abs(tokenCountMs-6.8)<1e-9);
});

test('answer activity counts measured model retries instead of treating the receipt as one call',()=>{
 const rows=[activity('knowledge.answer','2026-01-01T00:00:00.000Z','2026-01-01T00:00:02.000Z','succeeded',{model:{id:'test'},inference:{measuredModelCalls:3,promptTokens:240,outputTokens:36,countMs:4,generationWallMs:1200}})];
 assert.deepEqual(summarizeTurnWork(rows),{measuredModelCalls:3,promptTokens:240,outputTokens:36,tokenCountMs:4,generationMs:1200,measuredToolCalls:0});
});

test('summary omits unavailable and malformed measurements instead of inventing zeroes',()=>{
 const rows=[
  activity('dialogue.plan','2026-01-01T00:00:00.000Z','2026-01-01T00:00:01.000Z','succeeded',{inference:{promptTokens:-1,outputTokens:'unknown',countMs:NaN,generationWallMs:Infinity}}),
  activity('dialogue.plan','2026-01-01T00:00:01.000Z','2026-01-01T00:00:02.000Z','failed',{reason:'invalid output'}),
 ];
 assert.deepEqual(summarizeTurnWork(rows),{measuredModelCalls:1,measuredToolCalls:0});
 assert.equal(summarizeTurnWork([activity('dialogue.plan','2026-01-01T00:00:00.000Z','2026-01-01T00:00:01.000Z','failed')]),null);
});

test('failed registered calls remain counted as real tool work but unfinished or reversed intervals do not',()=>{
 const rows=[
  activity('memory.read','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.040Z','failed',{error:'hidden'}),
  activity('memory.search','2026-01-01T00:00:00.040Z','2026-01-01T00:00:00.020Z'),
  {schema:1,id:'unfinished',tool:'memory.search',input:null,startedAt:'2026-01-01T00:00:00.000Z',status:'running'},
 ];
 assert.deepEqual(summarizeTurnWork(rows),{measuredModelCalls:0,measuredToolCalls:1,toolElapsedMs:40});
});
