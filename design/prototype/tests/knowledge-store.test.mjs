import test from 'node:test';
import assert from 'node:assert/strict';
import {createNote,reviseNote,withdrawNote,latest} from '../../../dist/core.js';
import {projectNote,applyKnowledgeChanges,planFolderRename,planMemoryRecovery} from '../src/knowledge-store.ts';

test('legacy projection and unchanged save preserve all bytes, IDs, sources and paths',()=>{
 const original=createNote({title:'旧資料',body:'日本語原文 🌳'});original.importedFrom={name:'old.txt'};
 const view=projectNote(original),result=applyKnowledgeChanges([original],[view],[view]);
 assert.deepEqual(result,[original]);assert.equal(view.id,original.id);assert.match(view.path,/^inbox\//);
});
test('edits append one revision; stale concurrent edits cannot overwrite',()=>{
 const original=createNote({title:'Notes',path:'Notes/a.md',body:'v1'}),before=projectNote(original);
 const changed={...before,body:'v2',version:2,history:['v1']};
 const saved=applyKnowledgeChanges([original],[before],[changed]);
 assert.equal(latest(saved[0]).body,'v2');assert.equal(saved[0].revisions[0].body,'v1');
 assert.throws(()=>applyKnowledgeChanges(saved,[before],[{...changed,body:'stale'}]),/conflict/i);
});
test('delete and restore retain every revision and sources; path conflicts reject all changes',()=>{
 const original=createNote({path:'Notes/a.md',body:'original'}),view=projectNote(original);
 const deleted=applyKnowledgeChanges([original],[view],[]);
 assert.equal(deleted[0].state,'withdrawn');assert.equal(deleted[0].revisions.length,2);
 const restored=applyKnowledgeChanges(deleted,[],[view]);
 assert.equal(restored[0].state,'active');assert.equal(restored[0].revisions.length,3);
 assert.throws(()=>applyKnowledgeChanges([original],[view],[view,{...view,id:'other'}]),/conflict/i);
 assert.equal(original.revisions.length,1);
});
test('transaction validation rejects protected edits, invalid preferences and revision loss',()=>{
 const original=createNote({path:'Settings/README.md',body:'Protected'});original.ui={protected:true};
 const before=projectNote(original);
 assert.throws(()=>applyKnowledgeChanges([original],[before],[{...before,body:'changed'}]),/protected/i);
 const user=createNote({path:'Notes/b.md',body:'v1'}),projected=projectNote(user);
 assert.throws(()=>applyKnowledgeChanges([user],[projected],[{...projected,body:'bad'}]),/revision/i);
});

test('saving an existing generated result preserves exact content and rejects stale sources',()=>{
 const source=createNote({path:'Notes/source.md',body:'Exact source'}),ref={noteId:source.id,revision:1,start:0,end:12,quote:'Exact source'};
 const before=[projectNote(source)],answer={id:'answer',path:'Inbox/answer.md',body:'Already generated content',version:1,history:[],kind:'generated',sources:[ref]};
 const saved=applyKnowledgeChanges([source],before,[...before,answer]);
 assert.equal(saved.find(n=>n.id==='answer').revisions[0].body,answer.body);assert.deepEqual(saved.find(n=>n.id==='answer').sources,[ref]);
 const changed=reviseNote(source,{body:'Changed source'},1);
 assert.throws(()=>applyKnowledgeChanges([changed],[projectNote(changed)],[projectNote(changed),answer]),/Source changed/);
});


// Breaks caught: unreviewed mutation, stale approval/undo, authority from model fields,
// and loss of original metadata. These exercise pure commit rules, not simulated inference.
import * as edits from '../src/knowledge-store.ts';
test('a correction proposal cannot write and approved correction preserves canonical originals',()=>{
 assert.equal(typeof edits.prepareCorrection,'function');
 const note=createNote({path:'Notes/water.md',body:'水は3Lです。予備も3Lです。'});note.custom={keep:'legacy'};const before=structuredClone(note);
 const proposal=edits.prepareCorrection(note,'3Lを4Lに直して', '{"action":"replace","find":"3L","with":"4L"}');
 assert.deepEqual(note,before);assert.equal(proposal.after,'水は4Lです。予備も4Lです。');
 const {note:changed,receipt}=edits.applyCorrection([note],proposal);
 assert.equal(changed.id,note.id);assert.equal(changed.revisions.length,2);assert.equal(changed.revisions[0].body,before.revisions[0].body);assert.deepEqual(changed.custom,{keep:'legacy'});
 assert.equal(receipt.status,'applied');assert.equal(receipt.operation.result.matches,2);assert.equal(receipt.beforeVersion,1);assert.equal(receipt.afterVersion,2);assert.deepEqual(changed.revisions[0],before.revisions[0]);
});
test('stale/tampered approvals and protected targets cannot become writes',()=>{
 assert.equal(typeof edits.prepareCorrection,'function');
 const note=createNote({path:'Notes/a.md',body:'old'}),proposal=edits.prepareCorrection(note,'replace', '{"action":"replace","find":"old","with":"new"}');
 assert.throws(()=>edits.applyCorrection([reviseNote(note,{body:'other tab'},1)],proposal),/conflict/i);
 assert.throws(()=>edits.applyCorrection([note],{...proposal,after:'forged'}),/invalid/i);
 assert.throws(()=>edits.prepareCorrection(note,'replace','{"action":"replace","find":"old","with":"new","path":"Settings/models.md"}'),/Invalid/);
 for(const blocked of [{...note,ui:{protected:true}},{...note,ui:{managed:true}},{...note,ui:{recordType:'schedule'}},createNote({path:'Settings/custom.md',body:'old'})])assert.throws(()=>edits.prepareCorrection(blocked,'replace','{"action":"replace","find":"old","with":"new"}'),/unsupported|protected/i);
 assert.throws(()=>edits.prepareCorrection(note,'replace','{"action":"replace","find":"missing","with":"new"}'),/not found/);
});
test('undo appends a revision and refuses a changed target or repeated undo',()=>{
 assert.equal(typeof edits.undoCorrection,'function');
 const note=createNote({path:'Notes/a.md',body:'original'}),proposal=edits.prepareCorrection(note,'correct','{"action":"replace","find":"original","with":"corrected"}');
 const applied=edits.applyCorrection([note],proposal),undone=edits.undoCorrection([applied.note],applied.receipt);
 assert.equal(latest(undone.note).body,'original');assert.equal(undone.note.revisions.length,3);assert.equal(undone.note.revisions[1].body,'corrected');assert.equal(undone.receipt.status,'undone');
 assert.throws(()=>edits.undoCorrection([reviseNote(applied.note,{body:'later edit'},2)],applied.receipt),/conflict/i);
 assert.throws(()=>edits.undoCorrection([undone.note],undone.receipt),/already|unavailable/i);
});
test('correction target requires an exact path or a single filename match',()=>{
 assert.equal(typeof edits.resolveCorrectionTarget,'function');
 const a=createNote({path:'Notes/a.md',body:'one'}),b=createNote({path:'Inbox/a.md',body:'two'});
 assert.equal(edits.resolveCorrectionTarget([a,b],'Notes/a.md').id,a.id);
 assert.equal(edits.resolveCorrectionTarget([a],'a.md').id,a.id);
 assert.throws(()=>edits.resolveCorrectionTarget([a,b],'a.md'),/ambiguous/i);assert.throws(()=>edits.resolveCorrectionTarget([a,b],'one'),/matching/i);
});


test('correction inference remains read-only and cancellation rejects a proposed patch',async()=>{
 const {proposeCorrection}=await import('../src/note-corrections.ts');const note=createNote({path:'Notes/a.md',body:'Water 3L'}),before=structuredClone(note);let seen;
 const engine={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:50}),generate:async messages=>{seen=JSON.stringify(messages);return {text:'{"action":"replace","find":"3L","with":"4L"}'};}};
 const proposal=await proposeCorrection(engine,'Replace 3L with 4L',note);assert.equal(proposal.after,'Water 4L');assert.match(seen,/Water 3L/);assert.deepEqual(note,before);
 await assert.rejects(()=>proposeCorrection({...engine,generate:async()=>({text:'partial',stopped:true})},'correct',note),/Stopped/);
 await assert.rejects(()=>proposeCorrection({...engine,count:async()=>({prompt_tokens:2048})},'correct',note),/context limit/);
});


test('legacy correction review retains its canonical fallback path and rejects a forged display path',()=>{
 const note=createNote({title:'Legacy',body:'old'});note.id='legacy-123';delete note.revisions[0].path;
 const proposal=edits.prepareCorrection(note,'replace','{"action":"replace","find":"old","with":"new"}');
 assert.equal(proposal.path,'inbox/Legacy-legacy-123.md');
 assert.throws(()=>edits.applyCorrection([note],{...proposal,path:'Notes/other.md'}),/Invalid/);
});
test('History discards results after navigation and Undo requires the visible note identity',async()=>{
 assert.equal(typeof edits.loadCorrectionHistory,'function');const note=createNote({path:'Notes/a.md',body:'old'}),applied=edits.applyCorrection([note],edits.prepareCorrection(note,'replace','{"action":"replace","find":"old","with":"new"}'));
 assert.equal(edits.canUndoCorrection(applied.receipt,{id:'another-note',version:2}),false);
 assert.equal(edits.canUndoCorrection(applied.receipt,{id:note.id,version:2}),true);
 let resolve;const pending=new Promise(r=>resolve=r);let current=true;
 const loading=edits.loadCorrectionHistory(()=>pending,note.id,()=>current);current=false;resolve([applied.receipt]);assert.equal(await loading,null);
 const rows=await edits.loadCorrectionHistory(async()=>[applied.receipt], 'another-note',()=>true);assert.deepEqual(rows,[]);
});
test('post-commit refresh failure reports a committed correction while precommit failure stays rejected',async()=>{
 assert.equal(typeof edits.runReviewedCorrection,'function');const note=createNote({path:'Notes/a.md',body:'old'}),applied=edits.applyCorrection([note],edits.prepareCorrection(note,'replace','{"action":"replace","find":"old","with":"new"}'));
 let saved;const result=await edits.runReviewedCorrection(async()=>{saved=edits.undoCorrection([applied.note],applied.receipt);return saved.receipt;},async()=>{throw Error('Read failed');});
 assert.equal(result.receipt.status,'undone');assert.equal(latest(saved.note).body,'old');assert.match(result.refreshError.message,/Read failed/);
 let refreshed=false;await assert.rejects(()=>edits.runReviewedCorrection(async()=>{throw Error('Write failed');},async()=>{refreshed=true;}),/Write failed/);assert.equal(refreshed,false);
});


test('correction receipts reference retained revisions instead of duplicating entire histories',()=>{
 let note=createNote({path:'Notes/long-history.md',body:'OLD_ARCHIVE_'.repeat(10000)});note=reviseNote(note,{body:'old'},1);
 const proposal=edits.prepareCorrection(note,'replace','{"action":"replace","find":"old","with":"new"}'),applied=edits.applyCorrection([note],proposal);
 assert.ok(JSON.stringify(applied.receipt).length<2000);assert.equal(applied.receipt.beforeVersion,2);assert.equal(applied.receipt.afterVersion,3);
 const changedMetadata={...applied.note,other:'changed after approval'};assert.throws(()=>edits.undoCorrection([changedMetadata],applied.receipt),/conflict/i);
 assert.equal(edits.undoCorrection([applied.note],applied.receipt).note.revisions.at(-1).body,'old');
});

test('folder rename preserves canonical identities, source ranges and old paths together with empty descendants',()=>{
 const note=createNote({path:'Notes/Trip/original.md',body:'Exact original 水'}),generated=createNote({path:'Notes/Trip/answer.md',body:'Answer',kind:'generated',sources:[{noteId:note.id,revision:1,start:0,end:5,quote:'Exact'}]}),records=[note,generated],folders=['Notes/Trip/Empty','Notes/Trip/Empty/Deep'],before=structuredClone({records,folders});
 const result=planFolderRename(records,folders,'Notes/Trip','Travel',records.map(projectNote));
 assert.deepEqual({records,folders},before);assert.ok(result.folders.includes('Notes/Travel/Empty/Deep'));assert.ok(!result.folders.some(p=>p.startsWith('Notes/Trip')));
 for(const old of records){const n=result.records.find(n=>n.id===old.id);assert.deepEqual(n.revisions[0],old.revisions[0]);assert.equal(n.revisions.length,2);assert.equal(n.revisions[1].body,old.revisions[0].body);assert.equal(n.revisions[1].path,old.revisions[0].path.replace('Trip','Travel'));assert.deepEqual(n.sources,old.sources);}
 const empty=planFolderRename([],folders,'Notes/Trip','Travel',[]);assert.deepEqual(empty.records,[]);assert.ok(empty.folders.includes('Notes/Travel/Empty/Deep'));
});

test('folder rename refuses stale subtree membership, altered files, collisions and protected roots',()=>{
 const n=createNote({path:'Notes/Trip/a.md',body:'a'}),expected=[projectNote(n)];
 assert.throws(()=>planFolderRename([n,createNote({path:'Notes/Trip/new.md',body:'new'})],[],'Notes/Trip','Travel',expected),/changed|conflict/i);
 assert.throws(()=>planFolderRename([reviseNote(n,{body:'other tab'},1)],[],'Notes/Trip','Travel',expected),/changed|conflict/i);
 assert.throws(()=>planFolderRename([n],['Notes/Travel'],'Notes/Trip','Travel',expected),/exists/i);
 assert.throws(()=>planFolderRename([n],[],'Notes','Other',expected),/protected/i);
 assert.throws(()=>planFolderRename([n],[],'Notes/Missing','Travel',expected),/unavailable/i);
});

test('atomic recovery plans retain exact originals and empty folders across delete and restore',()=>{
 const n=createNote({path:'Notes/Trip/a.md',body:'Exact 水'}),records=[n],folders=['Notes/Trip','Notes/Trip/Empty'],before=structuredClone({records,folders});
 const removed=planMemoryRecovery(records,folders,[],{kind:'delete',target:{kind:'folder',value:'Notes/Trip'},expectedNotes:records.map(projectNote),id:'batch',label:'Trip'});
 assert.equal(removed.records[0].state,'withdrawn');assert.deepEqual(removed.records[0].revisions[0],n.revisions[0]);assert.deepEqual(removed.folders,[]);assert.equal(removed.trash.length,1);
 const restored=planMemoryRecovery(removed.records,removed.folders,removed.trash,{kind:'restore',batch:removed.trash[0]});assert.equal(restored.records[0].state,'active');assert.equal(restored.records[0].revisions.length,3);assert.equal(restored.records[0].revisions.at(-1).body,n.revisions[0].body);assert.deepEqual(restored.folders,folders);assert.deepEqual(restored.trash,[]);assert.deepEqual({records,folders},before);
});

test('recovery refuses changed snapshots and a later delete cycle instead of overwriting newer canonical bytes',()=>{
 const n=createNote({path:'Inbox/a.md',body:'Local'}),removed=planMemoryRecovery([n],[],[],{kind:'delete',target:{kind:'file',value:n.id},expectedNotes:[projectNote(n)],id:'batch',label:'a.md'}),batch=removed.trash[0],forged=structuredClone(batch);forged.notes[0].body='Forged';
 assert.throws(()=>planMemoryRecovery(removed.records,[],[forged],{kind:'restore',batch:forged}),/recovery.*changed/i);
 const revived=planMemoryRecovery(removed.records,[],removed.trash,{kind:'restore',batch}).records[0],edited=reviseNote(revived,{body:'Newer withdrawal'},3),later=withdrawNote(edited,4);assert.throws(()=>planMemoryRecovery([later],[],[batch],{kind:'restore',batch}),/recovery.*changed/i);
 assert.throws(()=>planMemoryRecovery([reviseNote(n,{body:'Other tab'},1)],[],[],{kind:'delete',target:{kind:'file',value:n.id},expectedNotes:[projectNote(n)],id:'batch',label:'a.md'}),/changed/i);
});

test('canonical-derived recovery works without a stored Trash batch while forged identifiers and roots refuse',()=>{
 const note=createNote({path:'Inbox/a.md',body:'Original'}),withdrawn=withdrawNote(note,1),projected=projectNote(withdrawn),batch={id:'recovered-'+note.id,label:'Recovered',notes:[projected],folders:[]};
 const result=planMemoryRecovery([withdrawn],[],[],{kind:'restore',batch});assert.equal(result.records[0].state,'active');assert.equal(result.records[0].revisions.at(-1).body,'Original');
 assert.throws(()=>planMemoryRecovery([withdrawn],[],[],{kind:'restore',batch:{...batch,id:'unknown'}}),/batch changed/i);
 const bad={...batch,id:'stored',folders:['Inbox']};assert.throws(()=>planMemoryRecovery([withdrawn],[],[bad],{kind:'restore',batch:bad}),/conflict|protected/i);
});
