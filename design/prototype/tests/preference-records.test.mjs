import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {initialPreferenceNotes,readPreference,readPreferenceWithFallback,restoreDefaultPreferences,updatePreference,parsePreference,formatPreference} from '../src/preference-records.ts';
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
const customDecision=()=>{const files=[{path:'config.json',bytes:1000,sha256:'1'.repeat(64)},{path:'tokenizer.json',bytes:1000,sha256:'2'.repeat(64)},{path:'tokenizer_config.json',bytes:1000,sha256:'3'.repeat(64)},{path:'onnx/model_quantized.onnx',bytes:1000,sha256:'4'.repeat(64)},{path:'onnx/model_quantized.onnx_data',bytes:1000,sha256:'5'.repeat(64)}],sha256=createHash('sha256').update(JSON.stringify(files)).digest('hex');return {id:'local-decision-'+sha256,label:'Fine-tuned D1',role:'decision',engine:'onnx-d1-text',revision:'sha256:'+sha256,files,inspection:{format:'D1-ONNX',architecture:'d1_omni',contextTokens:16384,inputLimit:2048,scope:'text-only'}};};
const customSpeech=()=>{const files=['config.json','generation_config.json','preprocessor_config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','onnx/encoder_model_quantized.onnx','onnx/decoder_model_merged_quantized.onnx'].map((path,i)=>({path,bytes:1000,sha256:String(i+1).repeat(64)})),sha256=createHash('sha256').update(JSON.stringify(files)).digest('hex');return {id:'local-speech-'+sha256,label:'Local Whisper',role:'speech',engine:'transformers-whisper-onnx',revision:'sha256:'+sha256,files,inspection:{format:'Whisper-ONNX',architecture:'whisper',device:'wasm',dtype:'q8',maxDurationSeconds:120}};};
test('custom model declarations persist through canonical revisions without inventing readiness',()=>{
 const notes=structuredClone(initialPreferenceNotes),old=notes.find(n=>n.id==='settings-models'),legacy=readPreference('models',notes);delete legacy.customModels;old.body=formatPreference('models',legacy);const body=old.body;
 assert.deepEqual(readPreference('models',notes).customModels,[]);assert.equal(old.body,body);
 const model=custom(),updated=updatePreference('models',notes,m=>({...m,customModels:[model],textLibrary:[...m.textLibrary,model.id],textModel:model.id}));
 assert.equal(readPreference('models',updated).textModel,model.id);assert.deepEqual(readPreference('models',updated).customModels,[model]);assert.deepEqual(updated.find(n=>n.id===old.id).history,[body]);
 for(const change of [m=>m.customModels.push(model),m=>m.customModels[0].ready=true,m=>m.customModels[0].file.url='https://example.com',m=>m.customModels=[],m=>m.customModels[0].engine='unknown']){
  const value=structuredClone(readPreference('models',updated));change(value);assert.throws(()=>parsePreference('models',formatPreference('models',value)));
 }
});

test('custom D1 declarations register only in the decision library and preserve old settings',()=>{
 const notes=structuredClone(initialPreferenceNotes),old=notes.find(n=>n.id==='settings-models'),legacy=readPreference('models',notes);delete legacy.customDecisionModels;old.body=formatPreference('models',legacy);const before=old.body;assert.deepEqual(readPreference('models',notes).customDecisionModels,[]);assert.equal(old.body,before);
 const model=customDecision(),updated=updatePreference('models',notes,m=>({...m,customDecisionModels:[model],decisionLibrary:[model.id],decisionModel:model.id}));
 assert.equal(readPreference('models',updated).decisionModel,model.id);assert.deepEqual(readPreference('models',updated).customDecisionModels,[model]);assert.deepEqual(updated.find(n=>n.id===old.id).history,[before]);
 for(const change of [m=>m.textLibrary.push(model.id),m=>m.customDecisionModels[0].ready=true,m=>m.customDecisionModels[0].files[0].url='https://example.com',m=>m.customModels.push(model)]){const invalid=structuredClone(readPreference('models',updated));change(invalid);assert.throws(()=>parsePreference('models',formatPreference('models',invalid)));}
});

test('custom Whisper declarations register in Speech library and retain history without readiness',()=>{
 const notes=structuredClone(initialPreferenceNotes),old=notes.find(n=>n.id==='settings-models'),legacy=readPreference('models',notes);delete legacy.customSpeechModels;old.body=formatPreference('models',legacy);const before=old.body;assert.deepEqual(readPreference('models',notes).customSpeechModels,[]);assert.equal(old.body,before);
 const model=customSpeech(),updated=updatePreference('models',notes,m=>({...m,customSpeechModels:[model],transcriptionLibrary:[model.id],transcriptionModel:model.id}));assert.equal(readPreference('models',updated).transcriptionModel,model.id);assert.deepEqual(readPreference('models',updated).customSpeechModels,[model]);assert.deepEqual(updated.find(n=>n.id===old.id).history,[before]);
 for(const change of [m=>m.textLibrary.push(model.id),m=>m.customSpeechModels[0].ready=true,m=>m.customSpeechModels[0].files[0].url='https://example.com',m=>m.customSpeechModels[0].engine='custom.js']){const bad=structuredClone(readPreference('models',updated));change(bad);assert.throws(()=>parsePreference('models',formatPreference('models',bad)));}
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


test('corrupt settings fall back safely and restore defaults with a versioned history while preserving memory',()=>{
 const notes=structuredClone(initialPreferenceNotes);const appearance=notes.find(n=>n.id==='settings-appearance');appearance.body='not valid settings';
 const read=readPreferenceWithFallback('appearance',notes);assert.equal(read.valid,false);assert.equal(read.value.background,readPreference('appearance',initialPreferenceNotes).background);
 const customized=structuredClone(notes);const models=customized.find(n=>n.id==='settings-models');models.body=formatPreference('models',{...readPreference('models',customized),textModel:'lfm2.5-230m-q4_0',textLibrary:['lfm2.5-230m-q4_0']});models.version=4;models.history=['v1','v2','v3'];models.paths=['Settings/models.md','Settings/models.md','Settings/models.md'];
 const unrelated={id:'user-note',path:'Projects/a.md',body:'keep me',version:2,history:['old'],paths:['Projects/a.md','Projects/a.md']};customized.push(unrelated);
 const before=structuredClone(customized),restored=restoreDefaultPreferences(customized),newModels=restored.find(n=>n.id==='settings-models'),newAppearance=restored.find(n=>n.id==='settings-appearance');
 assert.equal(newModels.version,5);assert.equal(newModels.history.at(-1),before.find(n=>n.id==='settings-models').body);assert.equal(newAppearance.history.at(-1),'not valid settings');
 assert.equal(readPreference('models',restored).textModel,readPreference('models',initialPreferenceNotes).textModel);assert.deepEqual(restored.find(n=>n.id==='user-note'),unrelated);
});

test('settings recovery refuses missing or tampered managed records without changing the input',()=>{
 for(const mutate of [records=>records.splice(records.findIndex(n=>n.id==='settings-models'),1),records=>{records.find(n=>n.id==='settings-models').path='Elsewhere/models.md';},records=>{records.find(n=>n.id==='settings-models').managed=false;}]){
  const records=structuredClone(initialPreferenceNotes);mutate(records);const before=structuredClone(records);assert.throws(()=>restoreDefaultPreferences(records),/Settings record unavailable/);assert.deepEqual(records,before);
 }
});
