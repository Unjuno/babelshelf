import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyDialogue} from '../src/conversation.ts';
import {cancelCaptureReview} from '../src/capture-review.ts';

test('capture cancellation changes only the exact pending turn and preserves its original and evidence',()=>{
 const turn={id:'capture',user:'note: original',answer:'Generated copy',status:'Review before saving',refs:[{noteId:'source',revision:2,start:0,end:3,quote:'old'}]};
 const state={...emptyDialogue(),turns:[turn,{id:'other',user:'Keep me',status:'Review before saving'}]},before=structuredClone(state);
 const next=cancelCaptureReview(state,'capture');
 assert.equal(next.turns[0].status,'Save cancelled');assert.equal(next.turns[0].user,turn.user);assert.equal(next.turns[0].answer,turn.answer);assert.deepEqual(next.turns[0].refs,turn.refs);assert.deepEqual(next.turns[1],state.turns[1]);assert.deepEqual(state,before);
 for(const status of ['Saved · Inbox/kept.md','Save cancelled','Correction cancelled · original retained','Stopped']){const settled={...state,turns:[{...turn,status}]};assert.equal(cancelCaptureReview(settled,'capture'),settled);}
 assert.equal(cancelCaptureReview(state,'missing'),state);
});
