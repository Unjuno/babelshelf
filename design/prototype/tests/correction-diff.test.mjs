import test from 'node:test';import assert from 'node:assert/strict';import {correctionDiff} from '../src/correction-diff.ts';
test('review exposes omitted characters without changing either original',()=>{
 const before='QA船着き場の水は三リットルです。',after='- 船着き場の水量は三リットルです。',diff=correctionDiff(before,after);
 assert.equal(diff.before.map(x=>x.text).join(''),before);assert.equal(diff.after.map(x=>x.text).join(''),after);
 assert.ok(diff.before.some(x=>x.changed&&x.text.includes('QA')));assert.ok(diff.after.some(x=>x.changed&&x.text.includes('-')));
});
test('large documents skip highlighting while preserving full text',()=>{const a='a'.repeat(2000),b='b'.repeat(2000),diff=correctionDiff(a,b);assert.equal(diff.highlighted,false);assert.equal(diff.before[0].text,a);assert.equal(diff.after[0].text,b);});
