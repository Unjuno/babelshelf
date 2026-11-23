import test from 'node:test';
import assert from 'node:assert/strict';
import {orderMemorySearchNotes} from '../src/memory-search-order.ts';

test('semantic passage rank reorders lexical matches without dropping or mutating them',()=>{
 const lexical=[{id:'exact',path:'Inbox/exact.md'},{id:'partial',path:'Inbox/partial.md'},{id:'other',path:'Inbox/other.md'}];
 const before=structuredClone(lexical),ordered=orderMemorySearchNotes(lexical,['partial','partial','exact'],true);
 assert.deepEqual(ordered.map(note=>note.id),['partial','exact','other']);
 assert.deepEqual(lexical,before);
});

test('unavailable or not-ready semantic search preserves keyword order',()=>{
 const lexical=[{id:'first'},{id:'second'}];
 assert.deepEqual(orderMemorySearchNotes(lexical,['second'],false),lexical);
 assert.deepEqual(orderMemorySearchNotes(lexical,[],true),lexical);
});
