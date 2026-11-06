import test from 'node:test';
import assert from 'node:assert/strict';
import {createNote,reviseNote,withdrawNote} from '../../../dist/core.js';
import {prepareCorrection} from '../src/note-corrections.ts';
import {makePendingCorrection,validatePendingCorrection,pendingCorrectionProblem,PENDING_CORRECTION_KEY} from '../src/pending-correction.ts';
import {makeStateBackup,parseStateBackup,planStateRestore} from '../src/backup-state.ts';
import {initialPreferenceNotes} from '../src/preference-records.ts';
import {prepareHarnessProfileChange} from '../src/harness-profile-review.ts';
import {createTaskNote} from '../src/task-records.ts';
import {createCustomToolPackageFiles} from '../src/custom-tool-package.ts';

const original=()=>createNote({path:'Notes/meeting.md',body:'Meet at 09:00.\n青いノート。'});
const proposal=note=>prepareCorrection(note,'Move the meeting to 10:00',JSON.stringify({action:'replace',find:'09:00',with:'10:00'}));

test('pending proposal is inert, exact, bounded and independent of later current state',()=>{
 const note=original(),before=structuredClone(note),p=proposal(note),pending=makePendingCorrection(p,'turn-one');
 assert.equal(validatePendingCorrection(pending).proposal.after,'Meet at 10:00.\n青いノート。');
 assert.deepEqual(note,before);assert.equal(pendingCorrectionProblem(pending,[note]),'');assert.deepEqual(note,before);
 assert.match(pendingCorrectionProblem(pending,[reviseNote(note,{body:'Changed elsewhere'},1)]),/conflict/i);
 assert.match(pendingCorrectionProblem(pending,[withdrawNote(note,1)]),/unavailable/i);
 assert.equal(validatePendingCorrection(pending).proposal.before,before.revisions[0].body);
 for(const altered of [{...pending,approved:true},{...pending,turnId:''},{...pending,proposal:{...p,after:'Injected'}},{...pending,proposal:{...p,execute:true}},{...pending,createdAt:'not-a-date'}])assert.throws(()=>validatePendingCorrection(altered));
 p.after='Mutated caller object';assert.equal(pending.proposal.after,'Meet at 10:00.\n青いノート。');
});

test('settings, schedule, custom-tool dependencies and generated-note sources remain inert and revalidated',async()=>{
 const seed=initialPreferenceNotes.find(note=>note.id==='settings-harness'),harness={...createNote({path:seed.path,body:seed.body}),id:seed.id,ui:{managed:true,protected:false}};
 const hp=await prepareHarnessProfileChange([harness],'conversation',[]);
 assert.equal(pendingCorrectionProblem(makePendingCorrection(hp),[harness]),'');
 const task=createTaskNote([],{repeat:'daily',time:'09:00',days:[],date:'2099-01-01',monthDay:1,interval:1,unit:'days',prompt:'Original prompt',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,enabled:false,notify:true});
 const sp=prepareCorrection(task,'Change the prompt',JSON.stringify({action:'patch',changes:{prompt:'Revised prompt'}}));
 assert.equal(pendingCorrectionProblem(makePendingCorrection(sp),[task]),'');
 const files=createCustomToolPackageFiles({id:'user.lookup',title:'Lookup',instructions:'Return a local value.',code:'({input})=>({value:1})',capabilities:[]}).map(file=>createNote(file));
 const tool=files.find(note=>note.revisions[0].path.endsWith('/tool.js'));
 const tp=prepareCorrection(tool,'Change the returned value',JSON.stringify({action:'rewrite',body:'({input})=>({value:2})'}),files),saved=makePendingCorrection(tp);
 assert.equal(saved.proposal.dependencies.length,1);assert.equal(pendingCorrectionProblem(saved,files),'');
 const changed=files.map(note=>note===tool?note:reviseNote(note,{body:note.revisions[0].body+'\nChanged instructions.'},1));
 assert.match(pendingCorrectionProblem(saved,changed),/conflict/i);
 const source=original(),generated=createNote({path:'Notes/derived.md',body:'red',kind:'generated',sources:[{noteId:source.id,revision:1,start:0,end:4,quote:'Meet'}]});
 const gp=prepareCorrection(generated,'Make it blue',JSON.stringify({action:'replace',find:'red',with:'blue'}));
 assert.equal(pendingCorrectionProblem(makePendingCorrection(gp),[source,generated]),'');
});

test('backup preserves a pending proposal as inert data, including a stale snapshot',async()=>{
 const note=original(),pending=makePendingCorrection(proposal(note)),newer=reviseNote(note,{body:'Another edit'},1);
 const pack=await makeStateBackup({notes:[newer],settings:[{key:PENDING_CORRECTION_KEY,value:pending}],runs:[]});
 const parsed=await parseStateBackup(JSON.stringify(pack));assert.deepEqual(parsed.settings[0].value,pending);
 assert.match(pendingCorrectionProblem(parsed.settings[0].value,parsed.notes),/conflict/i);
 const other=makePendingCorrection(prepareCorrection(note,'Move to 11:00',JSON.stringify({action:'replace',find:'09:00',with:'11:00'})));
 const local={notes:[newer],settings:[{key:PENDING_CORRECTION_KEY,value:other}],runs:[]},before=structuredClone(local);
 const plan=planStateRestore(local,parsed);assert.equal(plan.conflicts.length,1);assert.equal(plan.writes,null);assert.deepEqual(local,before);
 await assert.rejects(makeStateBackup({notes:[note],settings:[{key:PENDING_CORRECTION_KEY,value:{...pending,proposal:{...pending.proposal,after:'Tampered'}}}],runs:[]}));
});
