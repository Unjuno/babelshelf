import test from 'node:test';
import assert from 'node:assert/strict';
import {settings,validateSettings} from '../src/app-settings.ts';
import {capabilityState} from '../src/local-capabilities.ts';

test('settings cannot declare installed media or grant remote/destructive execution',()=>{
 assert.equal(capabilityState('image.ocr','tesseract-7',false).status,'Not prepared');
 assert.equal(capabilityState('video.frames','',false).status,'Not configured');
 assert.equal(capabilityState('video.frames','lfm25-vl-450m-q4f16',false).status,'Not prepared');
 assert.equal(capabilityState('video.frames','lfm25-vl-450m-q4f16',true).status,'Ready');
 for(const key of ['implicitDownloads','automaticOverwrite','automaticDelete']){
  const candidate=structuredClone(settings);candidate.harness[key]=true;
  assert.throws(()=>validateSettings(candidate),/Unsafe/);
 }
 const candidate=structuredClone(settings);candidate.media.capabilities=[{id:'video.frames',label:'Ready'}];
 assert.throws(()=>validateSettings(candidate),/Unknown/);
});
test('configuration rejects unsupported models, budgets and missing fields',()=>{
 const candidate=structuredClone(settings);candidate.models.text[0].value='remote-model';
 assert.throws(()=>validateSettings(candidate),/Unsupported/);
 candidate.models.text[0].value='4B';candidate.media.maxTextBytes=2**30;
 assert.throws(()=>validateSettings(candidate),/budget/);
 delete candidate.media;assert.throws(()=>validateSettings(candidate));
 const speech=structuredClone(settings);speech.models.transcription[0].value='whisper-tiny.en';
 assert.throws(()=>validateSettings(speech),/transcription/);
 speech.models.transcription[0].value='whisper-tiny';speech.defaults.transcriptionModel='unregistered';
 assert.throws(()=>validateSettings(speech),/transcription/);
});
test('validated defaults are copied and immutable and preserve protected roots',()=>{
 const candidate=structuredClone(settings),validated=validateSettings(candidate);
 candidate.defaults.background='sand';assert.equal(validated.defaults.background,'paper');
 assert.throws(()=>validated.storage.protectedRoots.pop(),TypeError);
 candidate.storage.protectedRoots[0]='Other';assert.throws(()=>validateSettings(candidate));
});

test('OCR registry cannot claim installation or select an unregistered custom runtime',()=>{
 const candidate=structuredClone(settings);candidate.models.ocr[0].installed=true;assert.throws(()=>validateSettings(candidate),/Unknown/);candidate.models.ocr=[{value:'remote-ocr',label:'Remote'}];assert.throws(()=>validateSettings(candidate),/Unsupported/);
});
test('Vision catalog separates image understanding from OCR and remains unprepared by default',()=>{
 assert.equal(settings.models.vision[0].value,'lfm25-vl-450m-q4f16');
 assert.equal(settings.defaults.visionModel,'');
 assert.equal(capabilityState('image.describe','lfm25-vl-450m-q4f16',false).status,'Not prepared');
 const candidate=structuredClone(settings);candidate.models.vision[0].ready=true;
 assert.throws(()=>validateSettings(candidate),/Unknown/);
});

import {readDeviceStorage,requestStorageProtection,storageBytes} from '../src/device-storage.ts';
test('device storage reports only measured browser values and never asks permission while reading',async()=>{
 let requests=0;const port={estimate:async()=>({usage:20,quota:100}),persisted:async()=>false,persist:async()=>{requests++;return false;}};
 assert.deepEqual(await readDeviceStorage(port),{usage:20,quota:100,available:80,persistent:false,canRequest:true});assert.equal(requests,0);
 const result=await requestStorageProtection(port);assert.equal(requests,1);assert.equal(result.outcome,'not-granted');assert.equal(result.state.persistent,false);
 assert.equal((await readDeviceStorage({})).available,null);assert.equal((await readDeviceStorage({estimate:async()=>({usage:NaN,quota:Infinity})})).usage,null);
 assert.equal((await readDeviceStorage({estimate:async()=>({usage:200,quota:100})})).available,0);
 assert.equal((await readDeviceStorage({estimate:async()=>{throw Error('unavailable');},persisted:async()=>true})).persistent,true);
 assert.equal((await requestStorageProtection({})).outcome,'unsupported');assert.equal(storageBytes(null),'Unknown');assert.equal(storageBytes(0),'0 B');
});
test('persistence request cannot manufacture verified protection when the browser does not confirm it',async()=>{
 const result=await requestStorageProtection({persist:async()=>true,persisted:async()=>false});assert.equal(result.outcome,'granted');assert.equal(result.state.persistent,false);
 const denied=await requestStorageProtection({persist:async()=>{throw Error('NotAllowed');},persisted:async()=>false});assert.equal(denied.outcome,'not-granted');assert.equal(denied.state.persistent,false);
});
