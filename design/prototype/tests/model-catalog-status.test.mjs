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
