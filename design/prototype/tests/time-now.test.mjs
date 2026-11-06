import test from 'node:test';import assert from 'node:assert/strict';
import {definition,run,validateClockReading} from '../src/tools/time.now/tool.ts';
import {agentClockReadingsFromCalls} from '../src/agent-evidence.ts';

test('clock tool returns one bounded local device reading',async()=>{
 const before=Date.now();let checks=0;const result=await run({},{check(){checks++;}}),after=Date.now();
 assert.equal(definition.network,'none');assert.equal(result.source,'device-clock');
 assert.ok(Date.parse(result.instant)>=before&&Date.parse(result.instant)<=after);
 assert.ok(Number.isInteger(result.offsetMinutes));assert.ok(result.offsetMinutes>=-840&&result.offsetMinutes<=840);
 assert.ok(result.timeZone===null||typeof result.timeZone==='string'&&result.timeZone.length>0);assert.equal(checks,2);
});
test('clock receipts reject malformed and normalized timestamps',()=>{
 const valid={instant:'2026-01-02T03:04:05.000Z',localTime:'2026-01-02T12:04:05',offsetMinutes:540,timeZone:'Asia/Tokyo',source:'device-clock'};
 assert.deepEqual(validateClockReading(valid),valid);
 for(const value of [{...valid,instant:'2026-02-30T03:04:05.000Z'},{...valid,offsetMinutes:841},{...valid,source:'network'}, {...valid,extra:1}])assert.throws(()=>validateClockReading(value),/Invalid device clock reading/);
});
test('multiple successful clock readings remain available to the answer',()=>{
 const reading={instant:'2026-01-02T03:04:05.000Z',localTime:'2026-01-02T12:04:05',offsetMinutes:540,timeZone:'Asia/Tokyo',source:'device-clock'};
 const calls=Array.from({length:4},()=>({tool:'time.now',arguments:{},result:reading}));
 assert.equal(agentClockReadingsFromCalls(calls).length,4);
});
test('clock tool rejects unexpected inputs and respects cancellation',async()=>{
 for(const args of [null,[],{url:'https://example.com'}])await assert.rejects(()=>run(args,{check(){}}),/Invalid clock request/);
 await assert.rejects(()=>run({},{check(){throw Error('Stopped');}}),/Stopped/);
});
