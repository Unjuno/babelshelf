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
  assert.match(selectedTextFileGuidance(id),/Selected model only.*matching GGUF.*tokenizer and chat-template metadata/);
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
 assert.match(selectedDecisionFileGuidance(false),/selected built-in D1 only.*six pinned files.*tokenizer.*does not add a model/);
 assert.match(selectedDecisionFileGuidance(true),/selected custom D1 only.*five matching ONNX, config and tokenizer files.*does not add a model/);
});

test('media statuses separate supported text and audio paths from unsupported video frames',async()=>{
 const {mediaReadingStatus}=await import('../src/model-file-guidance.ts');
 const status=mediaReadingStatus({ocrSelected:false,ocrReady:false,visionSelected:false,visionReady:false,speechStatus:'Speech model not prepared'});
 assert.deepEqual(status.pdf,['Text layer · ready','Scanned pages · OCR model not selected']);
 assert.deepEqual(status.image,['Text · OCR model not selected','Description · model not selected']);
 assert.deepEqual(status.audio,['Transcription · not prepared']);
 assert.deepEqual(status.video,['Original preview · browser-dependent','Audio transcription · not prepared','Frame understanding · unsupported']);
});

test('text choices expose pinned download size without claiming device readiness',()=>{
 const small=textModelFileSize('2B'),standard=textModelFileSize('4B'),large=textModelFileSize('9B');
 assert.ok(small>0&&small<standard&&standard<large);
 assert.match(textModelChoiceHint('9B'),/2\.00 GB · device check recommended/);
 assert.match(textModelChoiceHint('4B'),/MB · model files/);
 assert.equal(textModelFileSize('unknown'),null);
});
test('the standard add list contains at least three prepared-path text choices and hides disconnected candidates',()=>{
 const available=settings.models.text.filter(model=>canAddModel('text',model.value));
 assert.ok(available.length>=3);
 for(const model of available)assert.ok(textModelFileSize(model.value)>0);
 assert.equal(canAddModel('decision','d1-omni-600M'),true);
 assert.equal(canAddModel('decision','d1-3B'),false);
 assert.equal(canAddModel('speech','whisper-tiny'),true);
 assert.equal(canAddModel('speech','whisper-base'),false);
});

test('every fresh-library text choice has an explicit pinned preparation route',()=>{
 const prefs=readPreference('models',structuredClone(initialPreferenceNotes));
 assert.ok(prefs.textLibrary.length>=3);
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
 assert.equal(modelCatalogStatus('speech','whisper-base'),'Runtime not connected');
 assert.equal(modelCatalogStatus('ocr','tesseract-7'),'Not prepared');
 assert.equal(modelCatalogStatus('ocr','whisper-tiny'),'Runtime not connected');
 assert.equal(modelCatalogStatus('text','4B'),'Not prepared');
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
