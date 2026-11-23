import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldShowMemoryEmptyState} from '../src/memory-listing-state.ts';

test('semantic search pending does not claim that Memory has no files',()=>{
 assert.equal(shouldShowMemoryEmptyState({visibleFolderCount:0,visibleNoteCount:0,semanticHitCount:0,searchState:'searching'}),false);
 assert.equal(shouldShowMemoryEmptyState({visibleFolderCount:0,visibleNoteCount:0,semanticHitCount:0,searchState:'ready'}),true);
});

test('visible files or semantic results suppress the empty state',()=>{
 assert.equal(shouldShowMemoryEmptyState({visibleFolderCount:1,visibleNoteCount:0,semanticHitCount:0,searchState:'ready'}),false);
 assert.equal(shouldShowMemoryEmptyState({visibleFolderCount:0,visibleNoteCount:0,semanticHitCount:1,searchState:'ready'}),false);
});
