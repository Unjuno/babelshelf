import test from 'node:test';
import assert from 'node:assert/strict';
import {searchMemoryWithQuestionFallback} from '../src/memory-search-fallback.ts';

test('an empty planned Memory search retries the human question and returns visible results',async()=>{
 const calls=[];
 const result=await searchMemoryWithQuestionFallback('invented path','What did we decide about the meeting?',async query=>{
  calls.push(query);return query==='invented path'?[]:[{path:'Notes/meeting.md',excerpt:'Move it to Monday.'}];
 });
 assert.deepEqual(calls,['invented path','What did we decide about the meeting?']);
 assert.equal(result.query,'What did we decide about the meeting?');
 assert.equal(result.fallback,true);
 assert.deepEqual(result.results,[{path:'Notes/meeting.md',excerpt:'Move it to Monday.'}]);
});

test('a nonempty planned search is preserved without broadening its result set',async()=>{
 let calls=0;
 const result=await searchMemoryWithQuestionFallback('meeting decision','What did we decide about the meeting?',async()=>{calls++;return [{path:'Notes/meeting.md'}];});
 assert.equal(calls,1);assert.equal(result.query,'meeting decision');assert.equal(result.fallback,false);
});

test('an empty query uses the original question once, and empty results stay empty',async()=>{
 const calls=[];
 const result=await searchMemoryWithQuestionFallback('  ','Find my saved note about the meeting',async query=>{calls.push(query);return [];});
 assert.deepEqual(calls,['Find my saved note about the meeting']);
 assert.equal(result.query,'Find my saved note about the meeting');assert.equal(result.fallback,false);assert.deepEqual(result.results,[]);
});
