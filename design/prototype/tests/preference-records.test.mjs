import test from 'node:test';
import assert from 'node:assert/strict';
import {initialPreferenceNotes,readPreference,updatePreference,parsePreference,formatPreference} from '../src/preference-records.ts';
import {createNote} from '../../../dist/core.js';
import {makeStateBackup,parseStateBackup,planStateRestore} from '../src/backup-state.ts';
import {settingsPatchResult} from '../src/settings-corrections.ts';
import {deletionContents} from '../src/memory-trash.ts';

test('view edits produce a canonical settings revision retaining original bytes and ID',()=>{
 const original=structuredClone(initialPreferenceNotes),before=original.find(n=>n.id==='settings-appearance');
 const changed=updatePreference('appearance',original,p=>({...p,background:'sand'}));
 const after=changed.find(n=>n.id===before.id);
 assert.equal(readPreference('appearance',changed).background,'sand');
 assert.equal(after.path,before.path);assert.equal(after.version,2);assert.deepEqual(after.history,[before.body]);
 assert.equal(readPreference('appearance',original).background,'paper');
});
test('file edits reject malformed values and execution/readiness fields without changing active records',()=>{
 const original=structuredClone(initialPreferenceNotes);
 assert.throws(()=>updatePreference('appearance',original,p=>({...p,theme:'unknown'})),/appearance/);
 assert.equal(readPreference('appearance',original).theme,'system');
 assert.throws(()=>parsePreference('connection','# Connection\n\n```json\n{"downloads":true,"remoteInference":true}\n```'),/Unknown/);
 assert.throws(()=>parsePreference('models',formatPreference('models',{...readPreference('models',original),ready:true})),/Unknown/);
 const edited=formatPreference('connection',{downloads:true});assert.equal(parsePreference('connection',edited).downloads,true);
});
test('model selections reference the library and managed settings cannot be deleted',()=>{
 const original=structuredClone(initialPreferenceNotes);
 assert.throws(()=>updatePreference('models',original,m=>({...m,transcriptionModel:'whisper-tiny'})),/before selecting/);
 const registered=updatePreference('models',original,m=>({...m,transcriptionLibrary:['whisper-tiny'],transcriptionModel:'whisper-tiny'}));
 assert.equal(readPreference('models',registered).transcriptionModel,'whisper-tiny');
 assert.throws(()=>deletionContents({kind:'file',value:'settings-models'},original,['Settings']),/protected/);
});

test('all roles require registration; old model records migrate without losing history',()=>{
 const original=structuredClone(initialPreferenceNotes),before=original.find(n=>n.id==='settings-models');
 assert.throws(()=>updatePreference('models',original,m=>({...m,textModel:'2B'})),/before selecting/);
 assert.throws(()=>updatePreference('models',original,m=>({...m,decisionModel:'d1-3B'})),/before selecting/);
 const registered=updatePreference('models',original,m=>({...m,textLibrary:[...m.textLibrary,'2B'],textModel:'2B',decisionLibrary:['d1-3B'],decisionModel:'d1-3B'}));
 assert.equal(readPreference('models',registered).textModel,'2B');
 assert.deepEqual(registered.find(n=>n.id===before.id).history,[before.body]);
 const legacy={...readPreference('models',original)};delete legacy.textLibrary;delete legacy.decisionLibrary;
 const body=formatPreference('models',legacy),parsed=parsePreference('models',body);
 assert.deepEqual(parsed.textLibrary,['4B']);assert.deepEqual(parsed.decisionLibrary,[]);
 const older=original.map(n=>n.id===before.id?{...n,body}:n);
 const changed=updatePreference('models',older,m=>({...m,textLibrary:['4B','2B'],textModel:'2B'}));
 assert.deepEqual(changed.find(n=>n.id===before.id).history,[body]);
});

test('legacy model settings project OCR defaults without rewriting bytes; explicit registration appends history',()=>{
 const notes=structuredClone(initialPreferenceNotes),old=notes.find(n=>n.id==='settings-models'),value=readPreference('models',notes);delete value.ocrModel;delete value.ocrLibrary;delete value.ocrLanguage;old.body=formatPreference('models',value);const bytes=old.body,parsed=readPreference('models',notes);assert.equal(old.body,bytes);assert.equal(parsed.ocrModel,'');assert.deepEqual(parsed.ocrLibrary,[]);assert.equal(parsed.ocrLanguage,'eng+jpn');const next=updatePreference('models',notes,m=>({...m,ocrLibrary:['tesseract-7'],ocrModel:'tesseract-7'}));assert.equal(next.find(n=>n.id===old.id).history[0],bytes);assert.equal(readPreference('models',next).textModel,parsed.textModel);assert.throws(()=>parsePreference('models',formatPreference('models',{...parsed,ocrModel:'remote-ocr'})),/Unsupported/);
});

const custom=()=>{const sha256='b'.repeat(64);return {id:'local-'+sha256,label:'My fine tune',role:'text',engine:'webml-qwen35',revision:'sha256:'+sha256,file:{bytes:1000,sha256},inspection:{format:'GGUF',version:3,bytes:1000,name:'Custom',architecture:'qwen35',contextLength:4096,tokenizer:'gpt2',chatTemplate:true,tokenCount:1024,tensorCount:1,tensorTypes:[143],tensorExtentsChecked:true,dataOffset:512}};};
test('custom model declarations persist through canonical revisions without inventing readiness',()=>{
 const notes=structuredClone(initialPreferenceNotes),old=notes.find(n=>n.id==='settings-models'),legacy=readPreference('models',notes);delete legacy.customModels;old.body=formatPreference('models',legacy);const body=old.body;
 assert.deepEqual(readPreference('models',notes).customModels,[]);assert.equal(old.body,body);
 const model=custom(),updated=updatePreference('models',notes,m=>({...m,customModels:[model],textLibrary:[...m.textLibrary,model.id],textModel:model.id}));
 assert.equal(readPreference('models',updated).textModel,model.id);assert.deepEqual(readPreference('models',updated).customModels,[model]);assert.deepEqual(updated.find(n=>n.id===old.id).history,[body]);
 for(const change of [m=>m.customModels.push(model),m=>m.customModels[0].ready=true,m=>m.customModels[0].file.url='https://example.com',m=>m.customModels=[],m=>m.customModels[0].engine='unknown']){
  const value=structuredClone(readPreference('models',updated));change(value);assert.throws(()=>parsePreference('models',formatPreference('models',value)));
 }
});

test('custom declarations survive backup without assets and model proposals cannot register them',async()=>{
 const model=custom(),notes=updatePreference('models',structuredClone(initialPreferenceNotes),m=>({...m,customModels:[model],textLibrary:[...m.textLibrary,model.id]}));
 const view=notes.find(n=>n.id==='settings-models'),note=createNote({path:view.path,body:view.body});note.id=view.id;note.ui={managed:true};
 const state={notes:[note],settings:[],runs:[]},pack=await makeStateBackup(state),parsed=await parseStateBackup(JSON.stringify(pack));assert.deepEqual(parsed.notes,state.notes);
 const plan=planStateRestore({notes:[],settings:[],runs:[]},parsed);assert.equal(plan.conflicts.length,0);assert.deepEqual(parsePreference('models',plan.writes.notes[0].revisions.at(-1).body).customModels,[model]);
 assert.deepEqual(pack.payload.excluded,['model-assets','runtime-assets','unsaved-drafts','unpersisted-attachments']);
 assert.throws(()=>settingsPatchResult(note,JSON.stringify({action:'patch',changes:{customModels:[]}})),/Invalid settings patch/);
 assert.throws(()=>settingsPatchResult(note,JSON.stringify({action:'patch',changes:{textLibrary:[model.id]}})),/Invalid settings patch/);
});
