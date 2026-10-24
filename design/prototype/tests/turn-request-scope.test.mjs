import test from 'node:test';
import assert from 'node:assert/strict';
import {scopeResolvedTurnRequest} from '../src/turn-router.ts';

const imageInput={kind:'vision',noteId:'reading-1',revision:1};
const file={noteId:'meeting',revision:3};

test('a planner search over current attachments becomes an answer scoped only to those inputs',()=>{
 const result=scopeResolvedTurnRequest({
  request:{action:'search',query:'meeting'},question:'Find the meeting time in this image.',literal:false,
  inputs:[imageInput],currentFile:file,
 });
 assert.deepEqual(result,{request:{action:'answer',query:'meeting',target:'inputs'},inputs:[imageInput],fileBinding:{request:{action:'answer',query:'meeting',target:'inputs'},binding:undefined}});
});

test('a saved-knowledge target cannot silently read memory when current inputs are active',()=>{
 assert.throws(()=>scopeResolvedTurnRequest({
  request:{action:'answer',query:'meeting',target:'knowledge'},question:'What time is in this image?',literal:false,
  inputs:[imageInput],currentFile:undefined,
 }),/Choose the opened file or current attachments/);
});

test('a literal file read keeps its path scope and does not get rebound to an attachment',()=>{
 const input={kind:'text',noteId:'attachment-1',revision:1};
 const result=scopeResolvedTurnRequest({
  request:{action:'read',query:'Notes/meeting.md',target:'path'},question:'Read Notes/meeting.md',literal:true,literalAction:'read',
  inputs:[input],currentFile:file,
 });
 assert.deepEqual(result,{request:{action:'read',query:'Notes/meeting.md',target:'path'},inputs:[],fileBinding:{request:{action:'read',query:'Notes/meeting.md',target:'path'},binding:undefined}});
});

test('a question about the explicitly opened file binds to its pinned revision',()=>{
 const result=scopeResolvedTurnRequest({
  request:{action:'answer',query:'the date',target:'knowledge'},question:'What date is written in this file?',literal:false,
  inputs:[],currentFile:file,
 });
 assert.deepEqual(result,{request:{action:'read',query:'What date is written in this file?',target:'file'},inputs:[],fileBinding:{request:{action:'read',query:'What date is written in this file?',target:'file'},binding:'explicit'}});
});
