import test from 'node:test';
import assert from 'node:assert/strict';
import {modelCatalogStatus} from '../src/model-catalog-status.ts';

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
