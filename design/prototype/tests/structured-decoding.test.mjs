import test from 'node:test';
import assert from 'node:assert/strict';
import {createStructuredTokenFilter} from '../src/structured-decoding.ts';
const decoder=Object.fromEntries(Array.from({length:256},(_,i)=>[String.fromCodePoint(i),String(i)]));
function filter(){return createStructuredTokenFilter('dialogue-answer',{decoder:{byte_decoder:decoder},model:{vocab:[...Array.from({length:256},(_,i)=>String.fromCodePoint(i)),'EOS']},all_special_ids:[256]},256);}
const ids=s=>[...new TextEncoder().encode(s)];
test('logit mask keeps actual scores for allowed model tokens and blocks premature EOS/prose',()=>{
 const f=filter(),scores=new Float32Array(257).fill(3);f.mask([],scores);assert.equal(scores[123],3);assert.equal(scores[73],-Infinity);assert.equal(scores[256],-Infinity);
 const end=new Float32Array(257).fill(7);f.mask(ids('{"answer":"水"}'),end);assert.equal(end[256],7);assert.equal(end[65],-Infinity);assert.equal(f.complete(ids('{"answer":"水"}')),true);
});
test('UTF8 continuation bytes survive separate model tokens and incomplete output never closes synthetically',()=>{
 const f=filter(),prefix=ids('{"answer":"');prefix.push(0xe6);const scores=new Float32Array(257).fill(1);f.mask(prefix,scores);assert.equal(scores[0xb0],1);assert.equal(scores[34],-Infinity);assert.equal(scores[256],-Infinity);assert.equal(f.complete(prefix),false);
 assert.throws(()=>f.mask(ids('prose'),new Float32Array(257)),/Invalid/);assert.throws(()=>f.mask([],new Float32Array(257).fill(-Infinity)),/No valid/);
});
