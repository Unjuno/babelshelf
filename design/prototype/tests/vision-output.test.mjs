import test from 'node:test';
import assert from 'node:assert/strict';
import {validateVisionOutput} from '../src/vision-output.ts';

test('rejects the observed runaway numeric sequence and empty output',()=>{
 assert.throws(()=>validateVisionOutput(Array.from({length:128},(_,i)=>i).join(' ')),/description invalid/i);
 assert.throws(()=>validateVisionOutput('  '),/no description/i);
});

test('keeps ordinary image descriptions and short or nonconsecutive numeric text',()=>{
 for(const text of ['Room 123','0 1 2 3',Array.from({length:32},(_,i)=>i*2).join(' ')])assert.equal(validateVisionOutput(text),text);
});
