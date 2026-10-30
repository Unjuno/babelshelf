import test from 'node:test';
import assert from 'node:assert/strict';
import {createNote,latest,reviseNote} from '../../../dist/core.js';
import {initialPreferenceNotes,parsePreference,formatPreference} from '../src/preference-records.ts';
import {addToolToActiveProfile,prepareHarnessProfileChange} from '../src/harness-profile-review.ts';
import {applyCorrection,undoCorrection,proposeCorrection} from '../src/note-corrections.ts';
import {createCustomToolPackageFiles} from '../src/custom-tool-package.ts';
import {makeStateBackup,parseStateBackup} from '../src/backup-state.ts';

function fixture(custom=false){
 const seed=initialPreferenceNotes.find(n=>n.id==='settings-harness'),value=parsePreference('harness',seed.body);
 if(custom)value.profiles.push({id:'lookup',label:'Lookup',enabledTools:['user.lookup'],maxToolCalls:1,maxResultChars:1000});
 const harness={...createNote({path:seed.path,body:formatPreference('harness',value)}),id:seed.id,ui:{managed:true,protected:false}};
 const files=custom?createCustomToolPackageFiles({id:'user.lookup',title:'Lookup',instructions:'Read local notes.',code:'({input})=>({query:input.query})',capabilities:['memory.read']}).map(file=>createNote(file)):[];
 return {harness,files,records:[harness,...files]};
}

test('profile selection stays a proposal and shares canonical history, CAS and Undo',async()=>{
 const {harness,records}=fixture(),before=structuredClone(harness),proposal=await prepareHarnessProfileChange(records,'conversation',[]);
 assert.deepEqual(harness,before);
 const applied=applyCorrection(records,proposal),preferences=parsePreference('harness',latest(applied.note).body);
 assert.equal(preferences.activeProfileId,'conversation');
 assert.deepEqual(preferences.profiles,parsePreference('harness',latest(harness).body).profiles);
 assert.equal(applied.note.revisions.length,2);
 assert.equal(parsePreference('harness',latest(undoCorrection([applied.note],applied.receipt).note).body).activeProfileId,'standard');
 await assert.rejects(prepareHarnessProfileChange(records,'missing',[]),/Profile unavailable/);
 const newer=reviseNote(harness,{body:proposal.after},1);
 assert.throws(()=>applyCorrection([newer],proposal),/Version conflict/);
});

test('custom profile activation checks inert source pairs and refuses changed or removed review dependencies',async()=>{
 const {harness,files,records}=fixture(true);
 await assert.rejects(prepareHarnessProfileChange([harness,files[0]],'lookup',[]),/incomplete/);
 const proposal=await prepareHarnessProfileChange(records,'lookup',[]);
 assert.ok(Array.isArray(proposal.dependencies),'review must pin the selected package sources');
 assert.equal(proposal.dependencies.length,2);
 assert.equal(parsePreference('harness',latest(applyCorrection(records,proposal).note).body).activeProfileId,'lookup');
 const changed=reviseNote(files[1],{body:'({input})=>({different:input.query})'},1);
 assert.throws(()=>applyCorrection([harness,files[0],changed],proposal),/Version conflict/);
 assert.throws(()=>applyCorrection([harness,files[0]],proposal),/Version conflict/);
 assert.equal(latest(harness).version,1);
});

test('saving a custom skill adds it to the active profile in the same revisioned settings update',()=>{
 const harness=structuredClone(initialPreferenceNotes.find(note=>note.id==='settings-harness')),before=structuredClone(harness);
 const after=addToolToActiveProfile([harness],'user.lookup'),updated=after.find(note=>note.id==='settings-harness');
 assert.deepEqual(harness,before);
 const value=parsePreference('harness',updated.body);
 assert.deepEqual(value.profiles[0].enabledTools,['memory.search','memory.list','memory.read','math.calculate','time.now','user.lookup']);
 assert.equal(updated.version,2);assert.equal(updated.history.length,1);
 assert.equal(value.activeProfileId,'standard');
 assert.throws(()=>addToolToActiveProfile(after,'user.lookup'),/already exists/);
 assert.throws(()=>addToolToActiveProfile(after,'memory.search'),/Custom tool ID unavailable/);
});

test('chat profile proposals use the same package snapshot and cannot drop its review dependencies',async()=>{
 const {harness,files,records}=fixture(true);
 const engine={manifest:{contextTokens:4096},count:async()=>({prompt_tokens:100}),generate:async()=>({text:JSON.stringify({action:'patch',changes:{activeProfileId:'lookup'}})})};
 const proposal=await proposeCorrection(engine,'Use the Lookup profile',harness,()=>{},records);
 assert.equal(proposal.dependencies.length,2);
 assert.throws(()=>applyCorrection(records,{...proposal,dependencies:undefined}),/Version conflict/);
 const changed=reviseNote(files[0],{body:latest(files[0]).body+'Changed usage.'},1);
 assert.throws(()=>applyCorrection([harness,changed,files[1]],proposal),/Version conflict/);
 await assert.rejects(proposeCorrection(engine,'Use Lookup',harness),/context unavailable/);
});

test('a historical profile-selection receipt stays portable after its tool files are unavailable',async()=>{
 const {records}=fixture(true),proposal=await prepareHarnessProfileChange(records,'lookup',[]),applied=applyCorrection(records,proposal);
 const backup=await makeStateBackup({notes:[applied.note],settings:[],runs:[{key:'ui-v1-correction-'+applied.receipt.id,value:applied.receipt}]});
 const restored=await parseStateBackup(JSON.stringify(backup));
 assert.equal(parsePreference('harness',latest(restored.notes[0]).body).activeProfileId,'lookup');
 assert.equal(restored.runs[0].value.id,applied.receipt.id);
});

test('chat discovers a new inert tool before adding it to a reviewed profile',async()=>{
 const {harness}=fixture(),{files}=fixture(true),settings=parsePreference('harness',latest(harness).body);
 const broken=createNote({path:'Tools/user.broken/SKILL.md',body:'invalid'});
 const privateNote=createNote({path:'Notes/private.md',body:'PRIVATE_NOTE_SENTINEL'});
 const records=[harness,...files,broken,privateNote];let payload;
 const engine={manifest:{contextTokens:4096},count:async messages=>{payload=JSON.parse(messages[1].content);return {prompt_tokens:500};},generate:async()=>({text:JSON.stringify({action:'patch',changes:{profiles:[...settings.profiles,{id:'lookup',label:'Lookup',enabledTools:['user.lookup'],maxToolCalls:1,maxResultChars:1000}],activeProfileId:'lookup'}})})};
 const proposal=await proposeCorrection(engine,'Add the Lookup tool to a new profile and use it',harness,()=>{},records);
 assert.deepEqual(payload.customTools,[{id:'user.lookup',title:'Lookup',capabilities:['memory.read']}]);
 assert.deepEqual(payload.unavailableCustomTools,['user.broken']);
 assert.doesNotMatch(JSON.stringify(payload),/PRIVATE_NOTE_SENTINEL|Read local notes\.|\(\{input\}\)/);
 assert.equal(parsePreference('harness',latest(harness).body).activeProfileId,'standard');
 assert.equal(proposal.dependencies.length,2);
 assert.equal(parsePreference('harness',latest(applyCorrection(records,proposal).note).body).activeProfileId,'lookup');
});

test('tool source identity is captured before settings inference and cannot change under the proposal',async()=>{
 const {harness,files,records}=fixture(true),originalCode=latest(files[1]).body;
 const engine={manifest:{contextTokens:4096},count:async()=>({prompt_tokens:500}),generate:async()=>{
  records[2]=reviseNote(files[1],{body:'({input})=>({changed:input.query})'},1);
  return {text:JSON.stringify({action:'patch',changes:{activeProfileId:'lookup'}})};
 }};
 const proposal=await proposeCorrection(engine,'Use Lookup',harness,()=>{},records);
 assert.equal(latest(proposal.dependencies.find(note=>note.id===files[1].id)).body,originalCode);
 assert.throws(()=>applyCorrection(records,proposal),/Version conflict/);
});
