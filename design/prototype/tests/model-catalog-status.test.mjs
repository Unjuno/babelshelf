import test from 'node:test';
import assert from 'node:assert/strict';
import {modelCatalogStatus,textModelChoiceHint,textModelFileSize} from '../src/model-catalog-status.ts';

test('text choices expose pinned download size without claiming device readiness',()=>{
 const small=textModelFileSize('2B'),standard=textModelFileSize('4B'),large=textModelFileSize('9B');
 assert.ok(small>0&&small<standard&&standard<large);
 assert.match(textModelChoiceHint('9B'),/2\.00 GB · device check required/);
 assert.match(textModelChoiceHint('4B'),/MB · model files/);
 assert.equal(textModelFileSize('unknown'),null);
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
