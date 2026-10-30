import test from 'node:test';
import assert from 'node:assert/strict';
import {createNote,makeBackup,withdrawNote} from '../../../dist/core.js';
import {emptyDialogue,appendTurn,completeTurn,currentDialogueResult} from '../src/conversation.ts';
import {prepareCorrection,applyCorrection} from '../src/note-corrections.ts';
import {formatTask,taskDefinition,createTaskNote,claimTaskRun,finishTaskRun} from '../src/task-records.ts';
import {formatPreference,initialPreferenceNotes,readPreference} from '../src/preference-records.ts';
import {makeStateBackup,parseStateBackup,planStateRestore,stateHash,serializeStateBackup} from '../src/backup-state.ts';
import {planSettingsRestore,validateSettingsRestoreReceipt} from '../src/settings-restore.ts';
import {makeDecimalReceipt} from '../src/tools/math.calculate/decimal-receipt.ts';
import {noteSourceMetadata} from '../src/note-provenance.ts';

test('calculation execution survives backup and rejects a forged result',async()=>{
 const now=new Date('2026-10-17T00:00:00Z'),task={repeat:'once',time:'09:00',days:[],date:'2026-10-18',monthDay:1,interval:1,unit:'days',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,enabled:false,notify:false,prompt:'Calculate 12 + 10'};
 const original={...createTaskNote([],task,crypto.randomUUID(),now),taskCursor:{definition:taskDefinition(task),nextAt:'2026-10-18T00:00:00Z'}},claim=claimTaskRun([original],original.id,'owner',now,{manual:true});
 const done=finishTaskRun([original,claim.run],claim.run.id,'owner',{status:'succeeded',answer:'12 + 10 = 22',sources:[],calculation:makeDecimalReceipt('12 + 10')},now);
 const state={notes:[done.task,done.run],settings:[],runs:[]};const restored=await parseStateBackup(JSON.stringify(await makeStateBackup(state)));assert.deepEqual(restored.notes,state.notes);
 const forged=structuredClone(state);forged.notes[1].revisions.at(-1).body=forged.notes[1].revisions.at(-1).body.replace('12 + 10 = 22','12 + 10 = 23');await assert.rejects(()=>makeStateBackup(forged),/Invalid scheduled calculation/);
});

test('reviewed settings recovery appends destination history and retains source versions without network permission',async()=>{
 const pref=(group,value)=>{const n=createNote({path:'Settings/'+group+'.md',body:formatPreference(group,{...readPreference(group,initialPreferenceNotes),...value})});n.id='settings-'+group;n.ui={managed:true};n.unknown={retained:true};return n;};
 const current={notes:[pref('appearance',{theme:'light',background:'paper',glass:'clear'}),pref('connection',{downloads:false})],settings:[],runs:[]};
 const incoming={schema:2,createdAt:new Date().toISOString(),notes:[pref('appearance',{theme:'dark',background:'sage',glass:'frosted'}),pref('connection',{downloads:true})],settings:[],runs:[]};
 const before=structuredClone({current,incoming}),plan=planSettingsRestore(current,incoming);
 assert.equal(plan.changes.length,1);assert.equal(plan.writes.length,1);
 assert.deepEqual(plan.writes[0].revisions.slice(0,-1),current.notes[0].revisions);assert.deepEqual(plan.writes[0].unknown,{retained:true});
 assert.deepEqual(plan.changes[0].source,incoming.notes[0]);assert.deepEqual({current,incoming},before);
 const receipt={schema:1,type:'settings-restore',id:'recovery',appliedAt:new Date().toISOString(),backupHash:stateHash(incoming),changes:plan.changes.map(c=>({group:c.group,noteId:c.noteId,beforeVersion:c.beforeVersion,afterVersion:c.beforeVersion+1,source:c.source}))};
 const state={...current,notes:[plan.writes[0],current.notes[1]],runs:[{key:'ui-v1-settings-restore-recovery',value:receipt}]};
 assert.deepEqual((await parseStateBackup(JSON.stringify(await makeStateBackup(state)))).runs,state.runs);
 const changed=structuredClone(receipt);changed.changes[0].source.revisions[0].body=formatPreference('appearance',{...readPreference('appearance',initialPreferenceNotes),background:'sand'});
 assert.throws(()=>validateSettingsRestoreReceipt('ui-v1-settings-restore-recovery',changed,state.notes),/source changed/);
 const on={...current,notes:[current.notes[0],pref('connection',{downloads:true})]},offline=planSettingsRestore(on,incoming);
 assert.match(offline.writes.find(n=>n.id==='settings-connection').revisions.at(-1).body,/"downloads": false/);
 assert.match(offline.changes.find(c=>c.group==='connection').source.revisions[0].body,/"downloads": true/);
});

test('settings-only recovery cannot select arbitrary IDs, protected paths or legacy state',()=>{
 const n=createNote({path:'Settings/appearance.md',body:formatPreference('appearance',{theme:'dark',background:'paper',glass:'clear'})});n.id='settings-appearance';n.ui={managed:true};
 const current={notes:[structuredClone(n)],settings:[],runs:[]},incoming={schema:2,notes:[n]};
 current.notes[0].ui.protected=true;assert.throws(()=>planSettingsRestore(current,incoming),/unavailable/);
 assert.deepEqual(planSettingsRestore({notes:[],settings:[],runs:[]},incoming).changes,[]);
 assert.deepEqual(planSettingsRestore(current,{schema:1,notes:[n]}).changes,[]);
});

const snapshot=()=>({notes:[createNote({path:'Inbox/原文.md',body:'水 Water 3L 🌳'})],settings:[{key:'ui-v1-dialogue',value:appendTurn(emptyDialogue(),{id:'t1',user:'Remember the exact original',answer:'Retained'})},{key:'ui-v1-folders',value:['Notes/日本語']},{key:'ui-v1-trash',value:[]}],runs:[]});
const empty=()=>({notes:[],settings:[],runs:[]});

test('backup retains answer source-state guards without upgrading legacy dialogue',async()=>{
 const state=snapshot(),note=state.notes[0],turn=state.settings[0].value.turns[0];
 const guard={noteId:note.id,revision:1,snapshot:stateHash(noteSourceMetadata(state.notes,note.id,1))};
 turn.sourceMetadataGuards=[guard];
 const parsed=await parseStateBackup(JSON.stringify(await makeStateBackup(state)));
 assert.deepEqual(parsed.settings[0].value.turns[0].sourceMetadataGuards,[guard]);
 const many=Array.from({length:65},(_,i)=>({...guard,noteId:`observed-${i}`}));turn.sourceMetadataGuards=many;
 assert.deepEqual((await parseStateBackup(JSON.stringify(await makeStateBackup(state)))).settings[0].value.turns[0].sourceMetadataGuards,many);
 const legacy=snapshot();assert.equal((await parseStateBackup(JSON.stringify(await makeStateBackup(legacy)))).settings[0].value.turns[0].sourceMetadataGuards,undefined);
 state.settings[0].value.turns[0].sourceMetadataGuards[0].snapshot='invalid';await assert.rejects(()=>makeStateBackup(state),/source metadata/i);
});

test('working-result identity roundtrips with exact dialogue and rejects dangling backup pointers',async()=>{
 const state=snapshot();state.settings[0].value=completeTurn(state.settings[0].value,'t1',{answer:'Exact\nresult 🌳'});
 const before=structuredClone(state),parsed=await parseStateBackup(JSON.stringify(await makeStateBackup(state)));
 assert.deepEqual(parsed.settings,state.settings);assert.deepEqual(state,before);
 const restored=planStateRestore(empty(),parsed);assert.equal(restored.conflicts.length,0);
 assert.equal(currentDialogueResult(restored.writes.settings[0].value).quote,'Exact\nresult 🌳');
 state.settings[0].value.currentResult.turnId='missing';await assert.rejects(()=>makeStateBackup(state),/result/);
});
test('state backup retains exact originals, compaction, recovery metadata and correction receipts; tampering fails',async()=>{
 const state=snapshot(),p=prepareCorrection(state.notes[0],'Replace 3L with 4L','{"action":"replace","find":"3L","with":"4L"}'),a=applyCorrection(state.notes,p);
 state.notes=[a.note];state.runs=[{key:'ui-v1-correction-'+p.id,value:a.receipt}];
 const pack=await makeStateBackup(state),parsed=await parseStateBackup(JSON.stringify(pack));
 assert.equal(parsed.schema,2);assert.deepEqual(parsed.notes,state.notes);assert.deepEqual(parsed.settings,state.settings);assert.deepEqual(parsed.runs,state.runs);
 const bad=structuredClone(pack);bad.payload.settings[0].value.turns[0].user='Changed';await assert.rejects(parseStateBackup(JSON.stringify(bad)),/verification/i);
 assert.deepEqual(pack.payload.excluded,['model-assets','runtime-assets','unsaved-drafts','unpersisted-attachments']);
});
test('legacy note-only brainpacks remain readable and explicitly distinguish missing auxiliary state',async()=>{
 const state=snapshot(),pack=await makeBackup(state.notes),parsed=await parseStateBackup(JSON.stringify(pack));assert.equal(parsed.schema,1);assert.deepEqual(parsed.notes,state.notes);assert.equal(parsed.settings,undefined);
});
test('historical dialogue citations remain portable after the original is withdrawn',async()=>{
 const state=snapshot(),n=state.notes[0];state.settings[0].value.turns[0].refs=[{noteId:n.id,revision:1,start:0,end:1,quote:'水'}];state.notes=[withdrawNote(n,1)];
 const pack=await makeStateBackup(state);assert.equal((await parseStateBackup(JSON.stringify(pack))).notes[0].state,'withdrawn');
});
test('optional undefined fields survive file JSON roundtrip and remain distinct from missing or null during review',async()=>{
 const state=snapshot();state.settings[0].value.turns[0].status=undefined;state.notes[0].legacyOptional=undefined;
 const pack=await makeStateBackup(state),parsed=await parseStateBackup(JSON.stringify(pack));assert.deepEqual(parsed.notes,state.notes);assert.deepEqual(parsed.settings,state.settings);
 const absent=structuredClone(state);delete absent.notes[0].legacyOptional;assert.notEqual(stateHash(absent),stateHash(state));
 const nullValue=structuredClone(state);nullValue.notes[0].legacyOptional=null;assert.notEqual(stateHash(nullValue),stateHash(state));
 assert.equal(planStateRestore(absent,parsed).conflicts.length,1);assert.equal(planStateRestore(nullValue,parsed).conflicts.length,1);
});
test('restore refuses any conflicting note, dialogue or receipt without mutating inputs; identical data skips',async()=>{
 const incoming=snapshot(),pack=await makeStateBackup(incoming),payload=await parseStateBackup(JSON.stringify(pack));
 const first=planStateRestore(empty(),payload);assert.equal(first.conflicts.length,0);assert.equal(first.added.notes,1);assert.equal(first.added.settings,3);
 const same=planStateRestore(incoming,payload);assert.equal(same.conflicts.length,0);assert.equal(same.added.notes,0);
 const local=structuredClone(incoming);local.notes[0].revisions[0].body='Local change';local.settings[0].value.turns[0].user='Local dialogue';
 const before=structuredClone(local),plan=planStateRestore(local,payload);assert.equal(plan.conflicts.length,2);assert.deepEqual(local,before);assert.equal(plan.writes,null);
 assert.notEqual(stateHash(local),stateHash(incoming));
});
test('restored schedules require review; downloads ON becomes a retained revision followed by OFF',async()=>{
 const state=empty(),task={repeat:'once',time:'09:00',date:'2026-10-20',days:[],monthDay:1,interval:1,unit:'days',timezone:'Asia/Tokyo',enabled:true,notify:true,prompt:'Read local knowledge'};
 const note=createNote({path:'Schedule/task.md',body:formatTask(task)});note.ui={recordType:'schedule'};note.taskCursor={definition:taskDefinition(task),nextAt:'2026-10-20T00:00:00.000Z'};
 const pref=createNote({path:'Settings/connection.md',body:formatPreference('connection',{...readPreference('connection',initialPreferenceNotes),downloads:true})});pref.id='settings-connection';pref.ui={managed:true};state.notes=[note,pref];
 const payload=(await makeStateBackup(state)).payload,plan=planStateRestore(empty(),payload);
 assert.equal(plan.writes.notes.find(n=>n.id===note.id).ui.requiresReview,true);
 const offline=plan.writes.notes.find(n=>n.id===pref.id);assert.equal(offline.revisions.length,2);assert.equal(offline.revisions[0].body,pref.revisions[0].body);assert.match(offline.revisions[1].body,/"downloads": false/);assert.equal(pref.revisions.length,1);
});
test('backup rejects unsupported structured-clone values, duplicate keys, invalid dialogue sources and orphan receipts',async()=>{
 const state=snapshot();state.settings.push({key:'opaque',value:new Date()});await assert.rejects(makeStateBackup(state),/JSON/i);
 const duplicates=snapshot();duplicates.settings.push(duplicates.settings[0]);await assert.rejects(makeStateBackup(duplicates),/duplicate/i);
 const broken=snapshot();broken.settings[0].value.turns[0].refs=[{noteId:'missing',revision:1,start:0,end:1,quote:'x'}];await assert.rejects(makeStateBackup(broken),/source/i);
 const orphan=snapshot();orphan.runs=[{key:'ui-v1-correction-x',value:{schema:1,type:'note-correction',id:'x',noteId:'missing'}}];await assert.rejects(makeStateBackup(orphan),/correction/i);
});
test('export refuses a file beyond its readable UTF8 byte budget before offering an unusable backup',()=>{
 const payload={text:'日本語'.repeat(30)},encoded=JSON.stringify(payload);assert.ok(encoded.length<200);assert.throws(()=>serializeStateBackup(payload,200),/large/i);assert.equal(serializeStateBackup(payload,1000),encoded);
});

test('file working target retains its historical version through backup and rejects nonexistent identities',async()=>{
 const state=snapshot(),pin={noteId:state.notes[0].id,revision:1};state.settings[0].value.currentFile=pin;
 const pack=await parseStateBackup(JSON.stringify(await makeStateBackup(state)));assert.deepEqual(pack.settings[0].value.currentFile,pin);
 state.settings[0].value.currentFile={noteId:'missing',revision:1};await assert.rejects(()=>makeStateBackup(state),/Working file/);
});

test('explicit new-only restore keeps every conflicting current entry and validates the merged graph',async()=>{
 const current=snapshot(),incoming=await parseStateBackup(JSON.stringify(await makeStateBackup(current)));
 incoming.notes[0].localFixture='conflicting metadata';incoming.settings[0].value=appendTurn(incoming.settings[0].value,{id:'incoming-only',user:'Do not replace current dialogue'});
 const fresh=createNote({path:'Inbox/new-restore.md',body:'Only this note is new'});incoming.notes.push(fresh);
 const before=structuredClone({current,incoming});
 assert.equal(planStateRestore(current,incoming).writes,null);
 const plan=planStateRestore(current,incoming,'new-only');assert.ok(plan.writes);assert.deepEqual(plan.writes.notes,[fresh]);assert.equal(plan.conflicts.length,2);assert.deepEqual(plan.writes.settings,[]);assert.deepEqual(plan.writes.runs,[]);
 assert.deepEqual({current,incoming},before);
 assert.throws(()=>planStateRestore(current,incoming,'unknown'),/restore mode/i);
 const collision=structuredClone(incoming);collision.notes.at(-1).revisions[0].path=current.notes[0].revisions[0].path;assert.throws(()=>planStateRestore(current,collision,'new-only'));
});

test('new-only restore refuses dependent source changes instead of using skipped backup bytes',async()=>{
 const current=snapshot(),incoming=await parseStateBackup(JSON.stringify(await makeStateBackup(current)));
 const original=incoming.notes[0],quote='Backup-only text';original.revisions[0].body=quote;
 const generated=createNote({path:'Inbox/dependent.md',body:'Dependent',kind:'generated',sources:[{noteId:original.id,revision:1,start:0,end:quote.length,quote}]});incoming.notes.push(generated);
 assert.throws(()=>planStateRestore(current,incoming,'new-only'));
 const legacy={schema:1,createdAt:'test',notes:incoming.notes};assert.throws(()=>planStateRestore(current,legacy,'new-only'),/schema/i);
});

test('new-only execution history cannot bind to a skipped conflicting task snapshot',async()=>{
 const now=new Date('2026-10-17T00:00:00Z'),task={repeat:'once',time:'09:00',days:[],date:'2026-10-18',monthDay:1,interval:1,unit:'days',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,enabled:false,notify:false,prompt:'Backup prompt'};
 const original={...createTaskNote([],task,crypto.randomUUID(),now),taskCursor:{definition:taskDefinition(task),nextAt:'2026-10-18T00:00:00Z'}},claim=claimTaskRun([original],original.id,'owner',now,{manual:true}),failed=finishTaskRun([original,claim.run],claim.run.id,'owner',{status:'failed',error:'Not prepared'},now);
 const incoming=await parseStateBackup(JSON.stringify(await makeStateBackup({notes:[original,failed.run],settings:[],runs:[]})));
 const retained={...original,revisions:[{...original.revisions[0],body:formatTask({...task,prompt:'Current prompt'})}]},current={notes:[retained],settings:[],runs:[]};
 assert.throws(()=>planStateRestore(current,incoming,'new-only'),/execution/i);
 assert.throws(()=>planStateRestore({...current,notes:[original]},incoming,'new-only'),/retained schedule/i);
 const advanced={...original,taskCursor:{...original.taskCursor,nextAt:null}};assert.ok(planStateRestore({notes:[],settings:[],runs:[]},incoming,'new-only').writes);assert.throws(()=>planStateRestore({...current,notes:[advanced]},incoming,'new-only'),/retained schedule/i);
});

test('new-only restore cannot import Trash snapshots over a kept withdrawn original',async()=>{
 const note=withdrawNote(createNote({path:'Inbox/recovery.md',body:'Local original'}),1),other=structuredClone(note);other.revisions[0].body='Backup original';other.revisions.at(-1).body='Backup original';
 const incoming=await parseStateBackup(JSON.stringify(await makeStateBackup({notes:[other],settings:[{key:'ui-v1-trash',value:[{id:'batch',label:'Recovery',notes:[{id:other.id,path:'Inbox/recovery.md',body:'Backup original',version:other.revisions.length,history:other.revisions.slice(0,-1).map(r=>r.body)}],folders:[]}]}],runs:[]})));
 const current={notes:[note],settings:[],runs:[]},before=structuredClone(current);
 assert.throws(()=>planStateRestore(current,incoming,'new-only'),/recovery.*conflicting/i);assert.deepEqual(current,before);
});

import {createHash} from 'node:crypto';
import {utf8BytesWithin,visitUtf8Chunks} from '../src/utf8-text.ts';
test('bounded UTF8 size and chunked encoding exactly match TextEncoder across surrogate boundaries',()=>{
 const cases=['','ascii','日本語 العربية🙂','\ud800','\udc00','x'.repeat(65535)+'🙂next','x'.repeat(65536)+'\ud800x','🙂'.repeat(40000)];
 for(const text of cases){const exact=new TextEncoder().encode(text);assert.equal(utf8BytesWithin(text,exact.length),true);if(exact.length)assert.equal(utf8BytesWithin(text,exact.length-1),false);const parts=[];visitUtf8Chunks(text,part=>parts.push(part));assert.deepEqual(Buffer.concat(parts),Buffer.from(exact));assert.ok(parts.every(part=>part.length<=65536*3));}
});
test('chunked canonical hashing retains the existing payload digest and optional-property distinction',()=>{
 for(const body of ['', 'x'.repeat(65516)+'🙂日本語'.repeat(20000)]){
  const value={body},encoded=JSON.stringify({data:value,undefinedPaths:[]});
  assert.equal(stateHash(value),createHash('sha256').update(encoded).digest('hex'));
 }
 assert.notEqual(stateHash({a:undefined}),stateHash({a:null}));
});

import {noteRestoreCandidates,planNoteRestore,validateNoteRestoreReceipt} from '../src/note-restore.ts';
import {reviseNote} from '../../../dist/core.js';

test('restore conflict labels use familiar controls while retaining their exact internal identities',async()=>{
 const {restoreConflictLabel}=await import('../src/backup-conflicts.ts');
 assert.equal(typeof restoreConflictLabel,'function');
 for(const [key,label] of [['ui-v1-dialogue','Messages'],['ui-v1-folders','Folders'],['ui-v1-trash','Trash'],['ui-v1-pending-correction','Pending changes'],['custom-private-key','Settings']]){
  const conflict={store:'settings',key,label:key},before=structuredClone(conflict);
  assert.equal(restoreConflictLabel(conflict),label);assert.deepEqual(conflict,before);
 }
 assert.equal(restoreConflictLabel({store:'runs',key:'ui-v1-note-restore-secret',label:'ui-v1-note-restore-secret'}),'History');
 assert.equal(restoreConflictLabel({store:'notes',key:'id',label:'Notes/travel.md'}),'Notes/travel.md');
});

test('saved generated answer recovery appends a revision only with unchanged provenance and retains archival source proof',async()=>{
 const parent=createNote({path:'Notes/source.md',body:'Source fact'}),ref={noteId:parent.id,revision:1,start:0,end:11,quote:'Source fact'};
 const source={...createNote({path:'Inbox/answer.md',body:'Saved answer',kind:'generated',sources:[ref]}),dialogueCopy:{schema:1,noteRevision:1,turnId:'answer',turnIndex:0,speaker:'assistant',quote:'Saved answer',refs:[ref],edited:false}};
 const local=reviseNote(source,{body:'Local edit'},1),current={notes:[parent,local],settings:[],runs:[]},incoming={schema:2,createdAt:new Date().toISOString(),notes:[parent,source],settings:[],runs:[]};
 assert.equal(noteRestoreCandidates(current,incoming).length,1);
 const {write}=planNoteRestore(current,incoming,local.id);
 assert.deepEqual(write.revisions.slice(0,2),local.revisions);assert.equal(write.revisions[2].body,'Saved answer');assert.deepEqual(write.sources,local.sources);assert.deepEqual(write.dialogueCopy,local.dialogueCopy);
 for(const differentParent of [{...parent,revisions:[{...parent.revisions[0],body:'Source fact with different unseen context'}]},{...parent,origin:'different source metadata'}]){
  assert.equal(noteRestoreCandidates(current,{...incoming,notes:[differentParent,source]}).filter(change=>change.noteId===local.id).length,0,'Matching quote alone is not matching source-version identity');
 }
 const receipt={schema:1,type:'note-restore',id:'generated-restore',appliedAt:new Date().toISOString(),backupHash:'b'.repeat(64),noteId:local.id,beforeVersion:2,afterVersion:3,source};
 const state={notes:[parent,write],settings:[],runs:[{key:'ui-v1-note-restore-generated-restore',value:receipt}]};
 await parseStateBackup(JSON.stringify(await makeStateBackup(state)));
 state.notes[0]={...parent,state:'withdrawn'};state.notes[1]={...write,state:'withdrawn',withdrawnAt:new Date().toISOString()};
 await parseStateBackup(JSON.stringify(await makeStateBackup(state)));
 for(const altered of [{...source,sources:[]},{...source,dialogueCopy:{...source.dialogueCopy,turnId:'different'}},{...source,origin:'different provenance'}]){
  assert.equal(noteRestoreCandidates(current,{...incoming,notes:[parent,altered]}).length,0);
  assert.throws(()=>validateNoteRestoreReceipt(state.runs[0].key,{...receipt,source:altered},[parent,write]),/source|recovery/i);
 }
 const damagedParent={...parent,revisions:[{...parent.revisions[0],body:'Changed old source'}]};
 assert.throws(()=>validateNoteRestoreReceipt(state.runs[0].key,receipt,[damagedParent,write]),/source/i);
});
test('reviewed divergent ordinary note recovery appends and retains both histories without adopting source paths',async()=>{
 const original=createNote({path:'Notes/work.md',body:'base'}),local=reviseNote(original,{body:'local branch'},1),source=reviseNote(original,{body:'backup branch',path:'Notes/old-name.md'},1),current={notes:[local],settings:[],runs:[]},incoming={schema:2,createdAt:new Date().toISOString(),notes:[source],settings:[],runs:[]},before=structuredClone(current);
 const plan=planNoteRestore(current,incoming,local.id);assert.deepEqual(plan.write.revisions.slice(0,2),local.revisions);assert.equal(plan.write.revisions[2].body,'backup branch');assert.equal(plan.write.revisions[2].path,'Notes/work.md');assert.deepEqual(current,before);
 const receipt={schema:1,type:'note-restore',id:'restore',appliedAt:new Date().toISOString(),backupHash:'a'.repeat(64),noteId:local.id,beforeVersion:2,afterVersion:3,source};const state={...current,notes:[plan.write],runs:[{key:'ui-v1-note-restore-restore',value:receipt}]};validateNoteRestoreReceipt(state.runs[0].key,receipt,state.notes);const parsed=await parseStateBackup(JSON.stringify(await makeStateBackup(state)));assert.deepEqual(parsed.runs[0].value.source,source);
 const forged=structuredClone(receipt);forged.source.revisions[1].body='forged';assert.throws(()=>validateNoteRestoreReceipt(state.runs[0].key,forged,state.notes),/source changed/);
 for(const change of [{state:'withdrawn'},{ui:{protected:true}},{kind:'generated'},{originalAsset:{}},{mediaSource:{}}])assert.equal(noteRestoreCandidates(current,{...incoming,notes:[{...source,...change}]}).length,0);
});

import {visitJsonChunks} from '../src/json-chunks.ts';
import {stateBackupBlob} from '../src/backup-state.ts';
test('chunked JSON matches JSON.stringify for Unicode escapes, ordering and optional values',()=>{
 const value={z:'x'.repeat(65535)+'😀\ud800\n"\\',a:[undefined,null,1,-0,true,'日本語'],skip:undefined,'__proto__key':'x',nested:{'2':'two','1':'one'}};
 const parts=[];visitJsonChunks(value,s=>parts.push(s));assert.equal(parts.join(''),JSON.stringify(value));assert.ok(parts.every(s=>s.length<=65536));
});
test('chunked backup Blob retains exact format/hash and refuses byte overflow',async()=>{
 const pack=await makeStateBackup(snapshot()),blob=stateBackupBlob(pack);assert.equal(await blob.text(),serializeStateBackup(pack));assert.equal(blob.type,'application/json');await parseStateBackup(await blob.text());
 assert.throws(()=>stateBackupBlob({text:'日本語'.repeat(30)},200),/large/i);
});

 test('multi-megabyte chunked backup keeps exact bytes and parses retained state',async()=>{
 const state=snapshot();state.settings.push({key:'large-local-data',value:{text:('日本語😀\\\n').repeat(220000)}});
 const pack=await makeStateBackup(state),expected=serializeStateBackup(pack),blob=stateBackupBlob(pack);assert.ok(blob.size>2000000);assert.equal(await blob.text(),expected);
 const restored=await parseStateBackup(await blob.text());assert.deepEqual(restored.settings,state.settings);
 });

test('a valid outer checksum cannot import a file/folder collision or use a file as a folder parent',async()=>{const state={notes:[createNote({path:'Notes/held.md',body:'Keep original'})],settings:[],runs:[]},pack=await makeStateBackup(state);for(const folder of ['Notes/held.md','Notes/held.md/child','Notes/HELD.md']){const forged=structuredClone(pack);forged.payload.settings.push({key:'ui-v1-folders',value:[folder]});forged.sha256=stateHash(forged.payload);await assert.rejects(parseStateBackup(JSON.stringify(forged)),/collid/i);}assert.deepEqual((await parseStateBackup(JSON.stringify(pack))).notes,state.notes);});

test('valid outer checksum cannot admit invalid conversation or file-focus revisions',async()=>{
 const state=snapshot(),pack=await makeStateBackup(state);
 for(const revision of [-1,Number.MAX_SAFE_INTEGER+1]){const forged=structuredClone(pack);forged.payload.settings[0].value.revision=revision;forged.sha256=stateHash(forged.payload);await assert.rejects(parseStateBackup(JSON.stringify(forged)),/invalid/i);}
 const forged=structuredClone(pack);forged.payload.settings[0].value.currentFile={noteId:state.notes[0].id,revision:Number.MAX_SAFE_INTEGER+1};forged.sha256=stateHash(forged.payload);await assert.rejects(parseStateBackup(JSON.stringify(forged)),/invalid/i);
 assert.deepEqual((await parseStateBackup(JSON.stringify(pack))).settings,state.settings);
});
