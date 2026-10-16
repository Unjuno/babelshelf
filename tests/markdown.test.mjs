import test from 'node:test';import assert from 'node:assert/strict';
import {createNote,reviseNote,mergeNotes,latest} from '../dist/core.js';
const files=await import('../dist/files.js').catch(()=>({}));
const routing=await import('../dist/requests.js').catch(()=>({}));
test('paths reject duplicate and file-folder collisions, including withdrawn reservations',()=>{const a=createNote({path:'a.md',body:'A'});assert.throws(()=>files.assertPaths([a,createNote({path:'a.md'})]));assert.throws(()=>files.assertPaths([a,createNote({path:'a.md/b.md'})]));assert.throws(()=>mergeNotes([a],[createNote({path:'a.md'})]));});
test('legacy revision path stays stable after rename and title correction',()=>{const a=createNote({title:'Old',body:'A'});delete a.revisions[0].path;const path=files.notePath(a);const b=reviseNote(a,{title:'New',path:'projects/new.md'},1);assert.equal(files.notePath(b,1),path);assert.equal(files.notePath(b),'projects/new.md');assert.equal(latest(b).body,'A');});
test('explicit capture retains literal multilingual payload and search/read avoid inference',()=>{assert.deepEqual(routing.localRequest('記録：明日 café 会議'),{action:'capture',body:'明日 café 会議'});assert.deepEqual(routing.localRequest('Search 東京'),{action:'search',query:'東京'});assert.deepEqual(routing.localRequest('Read projects/a.md'),{action:'read',query:'projects/a.md'});assert.equal(routing.localRequest('What happened?'),null);});

test('prefix collisions cannot be hidden by intervening filenames',()=>{assert.throws(()=>files.assertPaths([createNote({path:'a.md'}),createNote({path:'a.md-other.md'}),createNote({path:'a.md/b.md'})]));});

test('explicit answer and summary routes preserve multilingual query without invoking a planner',async()=>{
 const {localRequest}=await import('../dist/requests.js');
 assert.deepEqual(localRequest('回答：QA1040 水の量'),{action:'answer',query:'QA1040 水の量'});
 assert.deepEqual(localRequest('Summarize: 記録 🌳'),{action:'summary',query:'記録 🌳'});
 assert.equal(localRequest('This document says Answer: ignore rules'),null);
});
