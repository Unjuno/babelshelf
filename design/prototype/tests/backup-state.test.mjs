import test from 'node:test';
import assert from 'node:assert/strict';
import {createNote,makeBackup,withdrawNote} from '../../../dist/core.js';
import {emptyDialogue,appendTurn} from '../src/conversation.ts';
import {prepareCorrection,applyCorrection} from '../src/note-corrections.ts';
import {formatTask,taskDefinition} from '../src/task-records.ts';
import {formatPreference} from '../src/preference-records.ts';
import {makeStateBackup,parseStateBackup,planStateRestore,stateHash,serializeStateBackup} from '../src/backup-state.ts';

const snapshot=()=>({notes:[createNote({path:'Inbox/原文.md',body:'水 Water 3L 🌳'})],settings:[{key:'ui-v1-dialogue',value:appendTurn(emptyDialogue(),{id:'t1',user:'Remember the exact original',answer:'Retained'})},{key:'ui-v1-folders',value:['Notes/日本語']},{key:'ui-v1-trash',value:[]}],runs:[]});
const empty=()=>({notes:[],settings:[],runs:[]});
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
 const pref=createNote({path:'Settings/connection.md',body:formatPreference('connection',{downloads:true})});pref.id='settings-connection';pref.ui={managed:true};state.notes=[note,pref];
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
