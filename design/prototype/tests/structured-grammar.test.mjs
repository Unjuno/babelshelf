import test from 'node:test';
import assert from 'node:assert/strict';
import {createStructuredGrammar} from '../src/structured-grammar.ts';
const enc=new TextEncoder();
function accepts(format,text){const grammar=createStructuredGrammar(format),state=grammar.advance(grammar.initial,enc.encode(text));return !!state&&grammar.complete(state);}
test('planner grammar accepts actual scoped contracts and refuses invalid action/target structure',()=>{
 for(const value of [{action:'chat',query:''},{action:'read',query:'Notes/a.md',target:'path'},{action:'capture',query:'',body:'日本語とالعربية'},{action:'recall',query:'',target:'history',historyIndex:0,historyPart:'user'},{action:'summary',query:'',target:'inputs'}])assert.equal(accepts('dialogue-plan',JSON.stringify(value)),true);
 for(const value of [{action:'delete',query:''},{action:'chat',query:'',target:'file'},{action:'recall',query:'',target:'history'},{action:'capture',query:''}])assert.equal(accepts('dialogue-plan',JSON.stringify(value)),false);
});
test('grammar retains UTF8 across token boundaries and permits valid escaped JSON strings',()=>{
 const grammar=createStructuredGrammar('dialogue-answer'),bytes=enc.encode(JSON.stringify({answer:'水🙂 "quote"\nline'}));let state=grammar.initial;
 for(const byte of bytes){state=grammar.advance(state,new Uint8Array([byte]));assert.ok(state);}
 assert.equal(grammar.complete(state),true);assert.equal(accepts('dialogue-answer','{"answer":"bad\\x"}'),false);
 const prefix=grammar.advance(grammar.initial,enc.encode('{"answer":"'));assert.equal(grammar.advance(prefix,new Uint8Array([0xc0])),null);
});
test('incomplete or extended output cannot become a successful structured result',()=>{
 const grammar=createStructuredGrammar('dialogue-answer'),prefix=grammar.advance(grammar.initial,enc.encode('{"answer":"hello'));
 assert.ok(prefix);assert.equal(grammar.complete(prefix),false);
 assert.equal(accepts('dialogue-answer','{"answer":"hello"} prose'),false);assert.equal(accepts('dialogue-answer','{"answer":true}'),false);
 assert.throws(()=>createStructuredGrammar('arbitrary-code'),/format/);
});

test('JSON string controls and multilingual scalar values remain valid at every byte boundary',()=>{
 const text=Array.from({length:128},(_,i)=>String.fromCodePoint(i)).join('')+'日本語 العربية Ελληνικά 🙂';
 const grammar=createStructuredGrammar('dialogue-answer'),serialized=JSON.stringify({answer:text});let state=grammar.initial;
 for(const byte of enc.encode(serialized)){state=grammar.advance(state,Uint8Array.of(byte));assert.ok(state);}
 assert.equal(grammar.complete(state),true);assert.equal(JSON.parse(serialized).answer,text);
 const prefix=grammar.advance(grammar.initial,enc.encode('{"answer":"'));
 for(const invalid of [[0xed,0xa0,0x80],[0xf4,0x90,0x80,0x80],[0xe0,0x80,0x80],[0x80]])assert.equal(grammar.advance(prefix,Uint8Array.from(invalid)),null);
});
