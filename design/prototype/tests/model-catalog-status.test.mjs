import test from 'node:test';
import assert from 'node:assert/strict';
import {canAddModel,modelCatalogStatus,textModelChoiceHint,textModelFileSize} from '../src/model-catalog-status.ts';
import {settings} from '../src/app-settings.ts';
import {selectedTextFileGuidance,selectedDecisionFileGuidance} from '../src/model-file-guidance.ts';
import {initialPreferenceNotes,readPreference} from '../src/preference-records.ts';
import {initialPreparationPlan} from '../src/initial-preparation.ts';
import {textAssetInput} from '../src/asset-activity.ts';

test('selected-file guidance follows the executable model format, including LFM GGUF',()=>{
 for(const id of ['4B','2B','9B','lfm25-230m-qad-q4-0','lfm25-350m-qad-q4-0']){
  assert.match(selectedTextFileGuidance(id),/Selected model only.*matching GGUF.*Tokenizer and chat template are normally embedded/);
  assert.match(selectedTextFileGuidance(id),/does not add another model/);
  assert.doesNotMatch(selectedTextFileGuidance(id),/ONNX weights/);
 }
 for(const id of ['smollm2-360m-instruct','qwen25-05b-instruct']){
  assert.match(selectedTextFileGuidance(id),/matching ONNX weights, config and tokenizer files/);
  assert.match(selectedTextFileGuidance(id),/does not add or select a different model/);
 }
 assert.match(selectedTextFileGuidance('unknown'),/No compatible import package/);
 assert.match(selectedTextFileGuidance(''),/Choose a model before supplying/);
});

test('decision file guidance distinguishes a new custom package from files for the selected model',()=>{
 assert.match(selectedDecisionFileGuidance(false,false),/Choose a decision model before supplying/);
 assert.match(selectedDecisionFileGuidance(false),/Selected built-in D1 only.*six pinned files.*tokenizer.*does not add a model/);
 assert.match(selectedDecisionFileGuidance(true),/Custom D1 uses its verified ONNX, config and tokenizer package.*cannot silently replace/);
});

test('media statuses separate sampled video model preparation from audio and original preview',async()=>{
 const {mediaReadingStatus}=await import('../src/model-file-guidance.ts');
 const status=mediaReadingStatus({ocrSelected:false,ocrReady:false,visionSelected:false,visionReady:false,speechStatus:'Speech model not prepared'});
 assert.deepEqual(status.pdf,['Text layer · not checked','Scanned pages · OCR model not selected']);
 assert.equal(mediaReadingStatus({pdfReady:true,ocrSelected:false,ocrReady:false,visionSelected:false,visionReady:false,speechStatus:'Ready'}).pdf[0],'Text layer · files verified');
 assert.equal(mediaReadingStatus({pdfReady:false,ocrSelected:false,ocrReady:false,visionSelected:false,visionReady:false,speechStatus:'Ready'}).pdf[0],'Text layer · check failed');
 assert.deepEqual(status.image,['Text · OCR model not selected','Description · model not selected']);
 assert.deepEqual(status.audio,['Transcription · not prepared']);
 assert.deepEqual(status.video,['Original preview · browser-dependent','Audio track transcription · not prepared','Sampled video frames · model not selected']);
 assert.equal(mediaReadingStatus({ocrSelected:false,ocrReady:false,visionSelected:true,visionReady:true,speechStatus:'Ready'}).video.at(-1),'Sampled video frames · files verified');
});

test('text choices expose pinned download size without claiming device readiness',()=>{
 const small=textModelFileSize('2B'),standard=textModelFileSize('4B'),large=textModelFileSize('9B');
 assert.ok(small>0&&small<standard&&standard<large);
 assert.match(textModelChoiceHint('9B'),/2\.00 GB · experimental · PC prose unstable/);
 assert.match(textModelChoiceHint('4B'),/MB · model files/);
 assert.match(textModelChoiceHint('lfm3-1.7b-qad-q4-0'),/1\.05 GB · WebGPU first · CPU fallback if unavailable · device execution not tested/);
 assert.equal(textModelFileSize('lfm3-1.7b-q8-0'),1846238496);
 assert.match(textModelChoiceHint('lfm3-1.7b-q8-0'),/1\.85 GB · WebGPU first · CPU fallback if unavailable · device execution not tested/);
 assert.equal(textModelFileSize('unknown'),null);
});
test('custom model choices disclose their app-owned adapter class and untested generation',()=>{
 const sha='c'.repeat(64),bytes=2310125920,model={id:'local-'+sha,label:'Bonsai 8B',role:'text',engine:'wllama-qwen3',revision:'sha256:'+sha,file:{bytes,sha256:sha},contextTokens:4096,inspection:{format:'GGUF',version:3,bytes,name:'Bonsai 8B',architecture:'qwen3',contextLength:65536,tokenizer:'gpt2',chatTemplate:true,tokenCount:151669,tensorCount:399,tensorTypes:[0,42],tensorExtentsChecked:true,dataOffset:16777216}};
 const lfm={...model,id:'local-lfm',engine:'wllama-lfm2',label:'Custom LFM2'};
 const qwen35={...model,id:'local-'+'d'.repeat(64),file:{...model.file,sha256:'d'.repeat(64)},engine:'webml-qwen35',label:'Custom Qwen3.5',inspection:{...model.inspection,architecture:'qwen35',tensorTypes:[0,143]}};
 const lfm3={...model,id:'local-'+'e'.repeat(64),file:{...model.file,sha256:'e'.repeat(64)},engine:'wllama-lfm3',label:'Custom LFM3'};
 assert.match(textModelChoiceHint(model.id,[model]),/2\.31 GB · CPU WASM path · execution not tested/);
 assert.match(textModelChoiceHint(lfm.id,[lfm]),/2\.31 GB · CPU WASM path · execution not tested/);
 assert.match(textModelChoiceHint(qwen35.id,[qwen35]),/2\.31 GB · WebGPU path · execution not tested/);
 assert.match(textModelChoiceHint(lfm3.id,[lfm3]),/2\.31 GB · WebGPU first · CPU fallback if unavailable · execution not tested/);
});
test('the standard add list contains at least three prepared-path text choices and hides disconnected candidates',()=>{
 const available=settings.models.text.filter(model=>canAddModel('text',model.value));
 assert.ok(available.length>=3);
 for(const model of available)assert.ok(textModelFileSize(model.value)>0);
 assert.equal(canAddModel('decision','d1-omni-600M'),true);
 assert.equal(canAddModel('decision','d1-3B'),false);
 assert.equal(canAddModel('speech','whisper-tiny'),true);
 assert.equal(canAddModel('speech','whisper-base'),true);
});

test('every fresh-library text choice has an explicit pinned preparation route',()=>{
 const prefs=readPreference('models',structuredClone(initialPreferenceNotes));
 assert.deepEqual(prefs.textLibrary,['lfm3-1.7b-qad-q4-0','2B']);
 for(const id of prefs.textLibrary){
  assert.equal(canAddModel('text',id),true);
  const selection={...prefs,textModel:id};
  const plan=initialPreparationPlan(selection,{text:false,speech:false,ocr:false},'text');
  const audit=textAssetInput(id,true);
  const pins='files' in audit.model?audit.model.files:[audit.model.file];
  assert.deepEqual(plan.steps.map(step=>step.role),['text']);
  assert.ok(plan.bytes>=pins.reduce((total,file)=>total+file.bytes,0));
  assert.equal(audit.allowNetwork,true);
  assert.equal(audit.method,'explicit-preparation');
  assert.ok(pins.length>0);
  for(const pin of pins)assert.match(pin.sha256,/^[a-f0-9]{64}$/);
 }
});

test('only installed app-owned role adapters can be added from model libraries',()=>{
 assert.equal(modelCatalogStatus('decision','d1-omni-600M'),'Not prepared');
 assert.equal(modelCatalogStatus('decision','d1-3B'),'Runtime not connected');
 assert.equal(modelCatalogStatus('speech','whisper-tiny'),'Not prepared');
 assert.equal(modelCatalogStatus('speech','whisper-base'),'Not prepared');
 assert.equal(modelCatalogStatus('ocr','tesseract-7'),'Not prepared');
 assert.equal(modelCatalogStatus('ocr','whisper-tiny'),'Runtime not connected');
 assert.equal(modelCatalogStatus('text','4B'),'Not prepared');
});

test('non-recommended text candidates disclose their current evidence limits in the model picker',()=>{
 for(const id of ['9B','lfm25-230m-qad-q4-0','lfm25-350m-qad-q4-0'])assert.match(textModelChoiceHint(id),/experimental/i);
 assert.match(textModelChoiceHint('9B'),/prose unstable/i);
 for(const id of ['lfm25-230m-qad-q4-0','lfm25-350m-qad-q4-0'])assert.match(textModelChoiceHint(id),/diagnostic generation only/i);
});

test('validated supported custom text engines share the text role but unknown models stay unavailable',()=>{
 const record={id:'custom-model',engine:'wllama-lfm2'};
 assert.equal(modelCatalogStatus('text','custom-model',[record]),'Not prepared');
 assert.equal(modelCatalogStatus('text','custom-model'), 'Runtime not connected');
 assert.equal(modelCatalogStatus('decision','custom-model',[record]), 'Runtime not connected');
});
test('custom decision registrations are addable only through the owned D1 text adapter',()=>{
 const record={id:'local-decision-a'.padEnd(78,'a'),role:'decision',engine:'onnx-d1-text'};
 assert.equal(modelCatalogStatus('decision',record.id,[],[record]),'Not prepared');
 assert.equal(modelCatalogStatus('decision',record.id,[],[{...record,engine:'untrusted'}]),'Runtime not connected');
 assert.equal(modelCatalogStatus('text',record.id,[],[record]),'Runtime not connected');
});
test('custom Whisper registrations use the fixed local speech adapter',()=>{
 const record={id:'local-speech-'+'a'.repeat(64),role:'speech',engine:'transformers-whisper-onnx'};
 assert.equal(modelCatalogStatus('speech',record.id,[],[],[record]),'Not prepared');
 assert.equal(modelCatalogStatus('speech',record.id,[],[],[{...record,engine:'untrusted'}]),'Runtime not connected');
});
test('the pinned Vision model is selectable only through its app-owned local image adapter',()=>{
 assert.equal(modelCatalogStatus('vision','lfm25-vl-450m-q4f16'),'Not prepared');
 assert.equal(modelCatalogStatus('vision','unknown-vision'),'Runtime not connected');
 assert.equal(modelCatalogStatus('ocr','lfm25-vl-450m-q4f16'),'Runtime not connected');
});
test('custom LFM2-VL declarations are addable only through the app-owned Vision adapter',()=>{
 const record={id:'local-vision-'+'a'.repeat(64),role:'vision',engine:'transformers-lfm2-vl-onnx'};
 assert.equal(modelCatalogStatus('vision',record.id,[],[],[],[record]),'Not prepared');
 assert.equal(modelCatalogStatus('vision',record.id,[],[],[],[{...record,engine:'untrusted'}]),'Runtime not connected');
 assert.equal(modelCatalogStatus('text',record.id,[],[],[],[record]),'Runtime not connected');
 assert.equal(canAddModel('vision',record.id,[],[],[],[record]),true);
});
