import test from 'node:test';
import assert from 'node:assert/strict';
import {deletionContents,canRestore,trashLocation} from '../src/memory-trash.ts';

test('trash location identifies the folder root without guessing from ambiguous legacy data',()=>{
 assert.equal(trashLocation({notes:[{path:'Notes/work/a.md'}],folders:[]}), 'Notes/work/a.md');
 assert.equal(trashLocation({notes:[{path:'Notes/work/sub/a.md'}],folders:['Notes/work/sub','Notes/work']}), 'Notes/work');
 assert.equal(trashLocation({notes:[],folders:['Inbox/projects']}), 'Inbox/projects');
 assert.equal(trashLocation({notes:[{path:'Notes/a.md'},{path:'Inbox/b.md'}],folders:[]}), undefined);
 assert.equal(trashLocation({notes:[],folders:['Notes/a','Notes/b']}), undefined);
});

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

test('bundled tool definitions and their root cannot be deleted; user definitions can',()=>{
 const bundled={id:'builtin',path:'Tools/README.md',protected:true};
 const custom={id:'custom',path:'Tools/custom.md'};
 assert.throws(()=>deletionContents({kind:'file',value:'builtin'},[bundled,custom],['Tools']),/protected/);
 assert.throws(()=>deletionContents({kind:'folder',value:'Tools'},[bundled,custom],['Tools']),/protected/);
 assert.deepEqual(deletionContents({kind:'file',value:'custom'},[bundled,custom],['Tools']).notes,[custom]);
});

test('restore cannot put a folder below a file or a file above an existing folder; normal parents remain usable',()=>{assert.equal(canRestore({notes:[],folders:['Notes/branch.md/deep']},[{id:'new',path:'Notes/branch.md'}],['Notes']),false);assert.equal(canRestore({notes:[{id:'old',path:'Notes/branch.md'}],folders:[]},[],['Notes/branch.md/deep']),false);assert.equal(canRestore({notes:[{id:'old',path:'Notes/work/a.md'}],folders:[]},[],['Notes/work']),true);assert.equal(canRestore({notes:[],folders:['Notes/work/deep']},[],['Notes/work']),true);});
