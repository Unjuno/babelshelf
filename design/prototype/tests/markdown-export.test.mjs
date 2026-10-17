import test from 'node:test';import assert from 'node:assert/strict';import {createNote,reviseNote} from '../../../dist/core.js';import {exportMarkdownRevision} from '../src/markdown-export.ts';
const decode=text=>{const match=/^---\nbabelshelf: ([^\n]+)\n---\n/.exec(text);assert.ok(match);return {metadata:JSON.parse(match[1]),body:text.slice(match[0].length)};};
test('selected revision export preserves exact multilingual body, historical path and sources without mutation',()=>{
 const body='# 原文\r\n水: 6 L. 🌳\r\n',n=createNote({path:'Notes/old.md',body}),m=reviseNote(n,{path:'Notes/new.md',body:'Changed'},1),before=structuredClone(m),old=exportMarkdownRevision(m,1),current=exportMarkdownRevision(m,2);
 assert.equal(decode(old.text).body,body);assert.equal(decode(old.text).metadata.path,'Notes/old.md');assert.equal(decode(old.text).metadata.id,n.id);assert.equal(decode(old.text).metadata.version,1);assert.deepEqual(decode(old.text).metadata.sources,n.sources);assert.equal(old.filename,'old.v1.md');assert.equal(decode(current.text).body,'Changed');assert.equal(current.filename,'new.v2.md');assert.deepEqual(m,before);
});
test('media provenance is exported as metadata rather than implying raw original or current alignment',()=>{
 const n={...createNote({path:'Attachments/transcript.md',body:'Corrected words'}),mediaSource:{id:'raw',revision:1,sha256:'a'.repeat(64)},transcription:{schema:1,text:'Original recognition',segments:[{start:1,end:2,text:'Original recognition'}]}},file=exportMarkdownRevision(n,1),value=decode(file.text);
 assert.deepEqual(value.metadata.mediaSource,n.mediaSource);assert.deepEqual(value.metadata.transcription,n.transcription);assert.equal(value.body,'Corrected words');assert.ok(!Object.hasOwn(value.metadata,'data'));
});
test('unavailable revisions and lossy UTF8 fail explicitly without substituting latest text',()=>{
 const n=createNote({path:'Inbox/a.md',body:'Safe'});for(const v of [0,2,1.2,undefined])assert.throws(()=>exportMarkdownRevision(n,v),/revision/i);assert.throws(()=>exportMarkdownRevision({...n,revisions:[{...n.revisions[0],body:'Bad \ud800'}]},1),/UTF-8/i);
});
