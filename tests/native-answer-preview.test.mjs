import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeAnswerPreview} from '../dist/native-answer-preview.js';
const preview=(arguments_,name='finish_answer')=>nativeAnswerPreview(new Map([[0,{name,arguments:arguments_}]]));
test('native answer streams every partial JSON prefix with escaped Unicode and no JSON syntax',()=>{
 const answer='日本語 "quote"\n😀 end';const json=JSON.stringify({reply:{status:'answered',answer,sources:[]}});let observed=false;
 for(let i=0;i<=json.length;i++){const actual=preview(json.slice(0,i));assert.ok(answer.startsWith(actual));if(actual&&i<json.length)observed=true;assert.ok(!/[\uD800-\uDBFF]$/.test(actual));}assert.ok(observed);assert.equal(preview(json),answer);
 assert.equal(preview('{"reply":{"answer":"\\u65e5\\ud83d'),'日');assert.equal(preview('{"reply":{"answer":"\\u65e5\\ud83d\\ude00'),'日😀');
});
test('unrelated fields, tools, mixed calls and malformed syntax cannot become a preview',()=>{
 for(const text of ['{"answer":"secret"}','{"body":{"reply":{"answer":"secret"}}}','{"reply":{"answer":"visible","answer":"duplicate"}}','{"reply":{"answer":"bad\\q','{"reply":{"answer":"text"}} trailing'])assert.equal(preview(text),'');
 assert.equal(preview('{"reply":{"answer":"secret"}}','memory.write'),'');
 assert.equal(nativeAnswerPreview(new Map([[0,{name:'finish_answer',arguments:'{"reply":{"answer":"text"}}'}],[1,{name:'memory.read',arguments:'{}'}]])),'');
});
