import test from 'node:test';import assert from 'node:assert/strict';
import {expireUndoNotices,nextUndoExpiry} from '../src/toast-queue.ts';

test('Undo deadline is absolute and unrelated notices remain queued',()=>{
 const queue=[{text:'Deleted',undoId:'batch',expiresAt:30_000},{text:'Saved'}];
 assert.equal(nextUndoExpiry(queue),30_000);
 assert.deepEqual(expireUndoNotices(queue,29_999),queue);
 assert.deepEqual(expireUndoNotices(queue,30_000),[{text:'Saved'}]);
});

test('multiple Undo actions expire independently in queue order',()=>{
 const queue=[{text:'Deleted second',undoId:'b',expiresAt:50_000},{text:'Saved'},{text:'Deleted first',undoId:'a',expiresAt:30_000}];
 assert.equal(nextUndoExpiry(queue),30_000);
 assert.deepEqual(expireUndoNotices(queue,30_000),[{text:'Deleted second',undoId:'b',expiresAt:50_000},{text:'Saved'}]);
 assert.deepEqual(expireUndoNotices(queue,50_000),[{text:'Saved'}]);
});

test('ordinary notices are not removed by Undo expiration',()=>{
 const queue=[{text:'Saved'},{text:'Updated'}];
 assert.equal(nextUndoExpiry(queue),undefined);
 assert.deepEqual(expireUndoNotices(queue,Number.MAX_SAFE_INTEGER),queue);
});
