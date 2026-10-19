import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {initialPreparationPlan,runInitialPreparation} from '../src/initial-preparation.ts';
import {initialPreferenceNotes,readPreference} from '../src/preference-records.ts';
const initial=()=>readPreference('models',structuredClone(initialPreferenceNotes));
test('initial preparation respects text-only selection without acquiring unselected readers',()=>{
 const prefs=initial(),plan=initialPreparationPlan(prefs,{text:false,speech:false,ocr:false});assert.equal(plan.models.textModel,prefs.textModel);assert.equal(plan.models.transcriptionModel,'');assert.equal(plan.models.ocrModel,'');assert.equal(prefs.transcriptionModel,'');assert.ok(plan.bytes>950000000);assert.deepEqual(plan.steps.map(s=>s.role),['text']);
 assert.throws(()=>initialPreparationPlan({...prefs,transcriptionModel:'whisper-base'},{text:false,speech:false,ocr:false}),/runtime/);assert.throws(()=>initialPreparationPlan({...prefs,textModel:''},{text:false,speech:false,ocr:false}),/text model/);
});

test('only explicitly selected readers enter preparation, including vision',async()=>{
 const {visionManifest}=await import('../src/vision-assets.ts');
 const prefs=initial();prefs.transcriptionModel='whisper-tiny';prefs.transcriptionLibrary=['whisper-tiny'];prefs.visionModel=visionManifest.id;prefs.visionLibrary=[visionManifest.id];
 const plan=initialPreparationPlan(prefs,{text:true,speech:false,ocr:false,vision:false});
 assert.deepEqual(plan.steps.map(step=>step.role),['text','speech','vision']);
 assert.equal(plan.models.ocrModel,'');
 assert.equal(plan.steps.at(-1).bytes,visionManifest.files.reduce((total,file)=>total+file.bytes,0));
 const calls=[];await runInitialPreparation(plan,async role=>calls.push(role),async()=>calls.push('commit'));
 assert.deepEqual(calls,['text','speech','vision','commit']);
 const verified=initialPreparationPlan(prefs,{text:true,speech:true,ocr:false,vision:true});
 assert.equal(verified.bytes,0);
 assert.deepEqual(verified.steps.map(step=>step.role),['text','speech','vision']);
});
test('a model card prepares only its own role while initial preparation keeps the full set',async()=>{
 const prefs=initial();prefs.transcriptionModel='whisper-tiny';prefs.transcriptionLibrary=['whisper-tiny'];prefs.decisionModel='d1-omni-600M';prefs.decisionLibrary=['d1-omni-600M'];
 const ready={text:false,speech:false,ocr:false,decision:false};
 const all=initialPreparationPlan(prefs,ready),text=initialPreparationPlan(prefs,ready,'text'),decision=initialPreparationPlan(prefs,ready,'decision');
 assert.deepEqual(all.steps.map(step=>step.role),['text','speech','decision']);
 assert.deepEqual(text.steps.map(step=>step.role),['text']);assert.equal(text.bytes,text.steps[0].bytes);
 assert.deepEqual(decision.steps.map(step=>step.role),['decision']);assert.equal(decision.bytes,decision.steps[0].bytes);
 const calls=[];await runInitialPreparation(decision,async role=>calls.push(role),async()=>calls.push('commit'));
 assert.deepEqual(calls,['decision','commit']);
 assert.throws(()=>initialPreparationPlan(prefs,ready,'ocr'),/Choose a ocr model/);
});
test('Stop or failed preparation cannot commit choices or start a later role',async()=>{
 const plan=initialPreparationPlan(initial(),{text:false,speech:false,ocr:false}),calls=[];let stopped=false;
 await assert.rejects(runInitialPreparation(plan,async role=>{calls.push(role);stopped=true;},async()=>calls.push('commit'),()=>{if(stopped)throw Error('Stopped');}),/Stopped/);assert.deepEqual(calls,['text']);
 const done=[];await runInitialPreparation(initialPreparationPlan(initial(),{text:true,speech:true,ocr:true}),async role=>done.push(role),async()=>done.push('commit'));assert.deepEqual(done,['text','commit']);
});

test('text verification failure preserves optional decision selection and never commits the initial set',async()=>{
 const prefs=initial();prefs.decisionModel='d1-omni-600M';prefs.decisionLibrary=['d1-omni-600M'];const plan=initialPreparationPlan(prefs,{text:true,speech:false,ocr:false});assert.equal(plan.models.decisionModel,'d1-omni-600M');assert.deepEqual(plan.models.decisionLibrary,['d1-omni-600M']);const calls=[];
 await assert.rejects(runInitialPreparation(plan,async role=>{calls.push(role);throw Error('Asset verification failed');},async()=>calls.push('commit')),/verification/);assert.deepEqual(calls,['text']);assert.equal(prefs.transcriptionModel,'');
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
 assert.deepEqual(calls,['text','decision','commit']);
 assert.equal(initialPreparationPlan(prefs,{text:true,speech:true,ocr:true,decision:true}).bytes,0);
 assert.throws(()=>initialPreparationPlan({...prefs,decisionModel:'d1-3B'},{text:true,speech:true,ocr:true}),/Decision runtime not connected/);
 assert.equal(initialPreparationPlan(initial(),{text:true,speech:true,ocr:true}).steps.some(s=>s.role==='decision'),false);
});

test('standard-set presence is not reported as text verification',()=>{
 const plan=initialPreparationPlan(initial(),{text:true,speech:true,ocr:true});
 assert.equal(plan.steps[0].readyLabel,'Files present');assert.equal(plan.bytes,0);
});


test('LFM initial preparation budgets only selected weights; packaged runtime is independent',()=>{
 const prefs=initial();prefs.textModel='lfm25-350m-qad-q4-0';prefs.textLibrary.push(prefs.textModel);
 const plan=initialPreparationPlan(prefs,{text:false,speech:true,ocr:true});assert.equal(plan.bytes,219312832);assert.equal(plan.steps[0].readyLabel,'Files present');assert.equal(plan.models.textModel,prefs.textModel);assert.equal(initial().textModel,'4B');
});
test('custom LFM2 preparation uses the trusted runtime budget and keeps the default model unchanged',()=>{
 const prefs=initial(),sha='c'.repeat(64),custom={id:'local-'+sha,label:'My LFM2',role:'text',engine:'wllama-lfm2',revision:'sha256:'+sha,file:{bytes:149081056,sha256:sha},inspection:{format:'GGUF',version:3,bytes:149081056,name:'My LFM2',architecture:'lfm2',contextLength:32768,tokenizer:'gpt2',chatTemplate:true,tokenCount:65536,tensorCount:3,tensorTypes:[0,2,14],tensorExtentsChecked:true,dataOffset:2387936}};
 prefs.customModels=[custom];prefs.textLibrary.push(custom.id);prefs.textModel=custom.id;
 const plan=initialPreparationPlan(prefs,{text:true,speech:true,ocr:true});assert.equal(plan.steps[0].label,'My LFM2');assert.equal(plan.steps[0].bytes,custom.file.bytes);assert.equal(plan.models.textModel,custom.id);assert.equal(plan.bytes,0);assert.equal(initial().textModel,'4B');
});
test('a registered custom D1 decision model stays in the app-owned local runtime during initial preparation',()=>{
 const prefs=initial(),files=[{path:'config.json',bytes:1,sha256:'1'.repeat(64)},{path:'tokenizer.json',bytes:1,sha256:'2'.repeat(64)},{path:'tokenizer_config.json',bytes:1,sha256:'3'.repeat(64)},{path:'onnx/model_quantized.onnx',bytes:1,sha256:'4'.repeat(64)},{path:'onnx/model_quantized.onnx_data',bytes:1,sha256:'5'.repeat(64)}],sha=createHash('sha256').update(JSON.stringify(files)).digest('hex'),custom={id:'local-decision-'+sha,label:'My D1',role:'decision',engine:'onnx-d1-text',revision:'sha256:'+sha,files,inspection:{format:'D1-ONNX',architecture:'d1_omni',contextTokens:16384,inputLimit:2048,scope:'text-only'}};
 prefs.customDecisionModels=[custom];prefs.decisionLibrary=[custom.id];prefs.decisionModel=custom.id;
 const plan=initialPreparationPlan(prefs,{text:true,speech:true,ocr:true,decision:false});assert.equal(plan.steps.at(-1).label,'My D1 · text decisions');assert.equal(plan.steps.at(-1).bytes,0);assert.equal(plan.bytes,0);assert.equal(plan.models.decisionModel,custom.id);
 assert.equal(initialPreparationPlan(prefs,{text:true,speech:true,ocr:true,decision:true}).bytes,0);
});
test('local speech and decision verification does not require model downloads',async()=>{
 const prefs=initial(),speech={id:'local-speech',label:'My Whisper',role:'speech',engine:'transformers-whisper-onnx',revision:'sha256:test',files:[{path:'tokenizer.json',bytes:12,sha256:'a'.repeat(64)}]};
 prefs.customSpeechModels=[speech];prefs.transcriptionModel=speech.id;prefs.transcriptionLibrary=[speech.id];
 const decision={id:'local-d1',label:'My D1',role:'decision',engine:'onnx-d1-text',revision:'sha256:test',files:[{path:'tokenizer.json',bytes:12,sha256:'b'.repeat(64)}]};
 prefs.customDecisionModels=[decision];prefs.decisionModel=decision.id;prefs.decisionLibrary=[decision.id];
 const plan=initialPreparationPlan(prefs,{text:true,speech:false,ocr:true,decision:false});
 assert.equal(plan.bytes,0);
 assert.equal(plan.steps.find(step=>step.role==='speech').ready,false);
 assert.equal(plan.steps.find(step=>step.role==='speech').bytes,0);
 assert.equal(plan.steps.find(step=>step.role==='decision').bytes,0);
 const calls=[];await runInitialPreparation(plan,async role=>calls.push(role),async()=>calls.push('commit'));
 assert.deepEqual(calls,['text','speech','decision','commit']);
});
