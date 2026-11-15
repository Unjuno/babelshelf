import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldShowLiveTextWork} from '../src/live-text-work.ts';

const work={kind:'generate',startedAt:1,updatedAt:2,phase:'Decoding'};

test('live text work is visible during chat and scheduled model operations',()=>{
 assert.equal(shouldShowLiveTextWork(work,true,false),true);
 assert.equal(shouldShowLiveTextWork(work,false,true),true);
});

test('idle state and model work detached from a visible operation stay hidden',()=>{
 assert.equal(shouldShowLiveTextWork(null,true,true),false);
 assert.equal(shouldShowLiveTextWork(work,false,false),false);
});
