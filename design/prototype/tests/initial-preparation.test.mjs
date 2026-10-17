import test from 'node:test';
import assert from 'node:assert/strict';
import {initialPreparationPlan,runInitialPreparation} from '../src/initial-preparation.ts';
import {initialPreferenceNotes,readPreference} from '../src/preference-records.ts';
const initial=()=>readPreference('models',structuredClone(initialPreferenceNotes));
test('initial preparation uses selected text and fills only unconfigured reader roles',()=>{
 const prefs=initial(),plan=initialPreparationPlan(prefs,{text:false,speech:false,ocr:false});assert.equal(plan.models.textModel,prefs.textModel);assert.equal(plan.models.transcriptionModel,'whisper-tiny');assert.equal(plan.models.ocrModel,'tesseract-7');assert.equal(prefs.transcriptionModel,'');assert.ok(plan.bytes>950000000);assert.deepEqual(plan.steps.map(s=>s.role),['text','speech','ocr']);
 assert.throws(()=>initialPreparationPlan({...prefs,transcriptionModel:'whisper-base'},{text:false,speech:false,ocr:false}),/runtime/);assert.throws(()=>initialPreparationPlan({...prefs,textModel:''},{text:false,speech:false,ocr:false}),/text model/);
});
test('Stop or failed preparation cannot commit choices or start a later role',async()=>{
 const plan=initialPreparationPlan(initial(),{text:false,speech:false,ocr:false}),calls=[];let stopped=false;
 await assert.rejects(runInitialPreparation(plan,async role=>{calls.push(role);stopped=true;},async()=>calls.push('commit'),()=>{if(stopped)throw Error('Stopped');}),/Stopped/);assert.deepEqual(calls,['text']);
 const done=[];await runInitialPreparation(initialPreparationPlan(initial(),{text:true,speech:true,ocr:true}),async role=>done.push(role),async()=>done.push('commit'));assert.deepEqual(done,['commit']);
});

test('reader failure preserves optional decision selection and never commits the initial set',async()=>{
 const prefs=initial();prefs.decisionModel='d1-omni-600M';prefs.decisionLibrary=['d1-omni-600M'];const plan=initialPreparationPlan(prefs,{text:true,speech:false,ocr:false});assert.equal(plan.models.decisionModel,'d1-omni-600M');assert.deepEqual(plan.models.decisionLibrary,['d1-omni-600M']);const calls=[];
 await assert.rejects(runInitialPreparation(plan,async role=>{calls.push(role);throw Error('Asset verification failed');},async()=>calls.push('commit')),/verification/);assert.deepEqual(calls,['speech']);assert.equal(prefs.transcriptionModel,'');
});

test('additional ONNX preparation pins its own assets and preserves text selection',()=>{
 const prefs=initial();prefs.textModel='smollm2-360m-instruct';prefs.textLibrary.push(prefs.textModel);
 const plan=initialPreparationPlan(prefs,{text:false,speech:true,ocr:true});assert.equal(plan.bytes,366674624);assert.equal(plan.steps[0].readyLabel,'Files present');assert.equal(plan.models.textModel,prefs.textModel);
});

test('Qwen initial preparation uses its own combined files without unrelated runtime capacity',()=>{
 const prefs=initial();prefs.textModel='qwen25-05b-instruct';prefs.textLibrary.push(prefs.textModel);
 const plan=initialPreparationPlan(prefs,{text:false,speech:true,ocr:true});assert.equal(plan.bytes,519137612);assert.equal(plan.models.textModel,prefs.textModel);assert.equal(plan.steps[0].readyLabel,'Files present');
});

import {decisionManifest} from '../src/decision-assets.ts';
test('selected connected decision role is prepared once without silently adding or replacing a selection',async()=>{
 const prefs=initial();prefs.decisionModel='d1-omni-600M';prefs.decisionLibrary=['d1-omni-600M'];
 const plan=initialPreparationPlan(prefs,{text:true,speech:true,ocr:true,decision:false});
 assert.equal(plan.bytes,decisionManifest.files.reduce((n,f)=>n+f.bytes,0));
 assert.equal(plan.steps.at(-1).role,'decision');const calls=[];
 await runInitialPreparation(plan,async role=>calls.push(role),async()=>calls.push('commit'));
 assert.deepEqual(calls,['decision','commit']);
 assert.equal(initialPreparationPlan(prefs,{text:true,speech:true,ocr:true,decision:true}).bytes,0);
 assert.throws(()=>initialPreparationPlan({...prefs,decisionModel:'d1-3B'},{text:true,speech:true,ocr:true}),/Decision runtime not connected/);
 assert.equal(initialPreparationPlan(initial(),{text:true,speech:true,ocr:true}).steps.some(s=>s.role==='decision'),false);
});

test('standard-set presence is not reported as text verification',()=>{
 const plan=initialPreparationPlan(initial(),{text:true,speech:true,ocr:true});
 assert.equal(plan.steps[0].readyLabel,'Files present');assert.equal(plan.bytes,0);
});
