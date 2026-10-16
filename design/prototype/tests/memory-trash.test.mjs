import test from 'node:test';
import assert from 'node:assert/strict';
import {deletionContents,canRestore} from '../src/memory-trash.ts';

test('folder deletion retains exact records and revisions, excludes similarly named siblings',()=>{
 const original={id:'a',path:'Notes/work/a.md',body:'原文',version:2,history:['以前']};
 const sibling={id:'b',path:'Notes/workshop/b.md'};
 const batch=deletionContents({kind:'folder',value:'Notes/work'},[original,sibling],['Notes','Notes/work','Notes/work/sub','Notes/workshop']);
 assert.deepEqual(batch.folders,['Notes/work','Notes/work/sub']);
 assert.deepEqual(batch.notes,[original]);
 assert.equal(batch.notes[0],original);
 assert.throws(()=>deletionContents({kind:'folder',value:'Notes'},[original],['Notes']));
});
test('restore refuses IDs and case-insensitive path conflicts without overwriting',()=>{
 const batch={notes:[{id:'a',path:'Notes/work/a.md'}],folders:['Notes/work']};
 assert.equal(canRestore(batch,[],['Notes']),true);
 assert.equal(canRestore(batch,[{id:'new',path:'notes/WORK/A.md'}],['Notes']),false);
 assert.equal(canRestore(batch,[{id:'a',path:'Inbox/other.md'}],['Notes']),false);
 assert.equal(canRestore(batch,[],['Notes/work']),false);
});
