import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOriginal} from '../src/original-assets.ts';
import {makeOcrText} from '../src/ocr-text.ts';
import {makePdfText} from '../src/pdf-text.ts';
import {makeTranscript} from '../src/speech-transcript.ts';
import {visionManifest} from '../src/vision-assets.ts';
import {speechModelProvenance} from '../src/speech-models.ts';
import {createAutomaticReadingAdapters} from '../src/automatic-reading-adapters.ts';

const source=async(name='image.png',type='image/png')=>prepareOriginal(new File(['source bytes'],name,{type}));
const image={width:100,height:100,processedWidth:100,processedHeight:100,frame:0,orientation:'browser-decoded'};
const basePorts=overrides=>({
 prompt:' Describe this source. ',ocrModel:'tesseract-7',ocrReady:true,ocrLanguage:'eng',
 speechModel:'whisper-tiny',speechReady:true,speechLanguage:'ja',customSpeechModels:[],customVisionModels:[],
 ensureRuntime:async()=>{},releaseInference:async()=>{},
 vision:{describe:async()=>({model:visionManifest.id,revision:visionManifest.revision,runtime:visionManifest.runtime,text:'Visible content.',width:100,height:100}),describeFrames:async()=>({frames:[]})},
 ...overrides
});

test('image adapter verifies the local Vision runtime before describing the pinned original',async()=>{
 const asset=await source(),events=[],signal=new AbortController().signal;
 const adapters=createAutomaticReadingAdapters(basePorts({ensureRuntime:async(role,allowNetwork)=>events.push(['runtime',role,allowNetwork]),vision:{describe:async(blob,prompt)=>{events.push(['describe',blob.type,prompt]);return {model:visionManifest.id,revision:visionManifest.revision,runtime:visionManifest.runtime,text:'Visible content.',width:100,height:100};},describeFrames:async()=>({frames:[]})}}));
 const result=await adapters.vision(asset,signal,()=>{});
 assert.deepEqual(events,[['runtime','vision',false],['describe','image/png','Describe this source.']]);
 assert.equal(result.original.id,asset.id);assert.equal(result.prompt,'Describe this source.');assert.equal(result.text,'Visible content.');
});

test('OCR adapter releases idle inference before local OCR runtime verification and extraction',async()=>{
 const asset=await source(),events=[],signal=new AbortController().signal;
 const adapters=createAutomaticReadingAdapters(basePorts({releaseInference:async()=>events.push(['release']),ensureRuntime:async(role,allowNetwork)=>events.push(['runtime',role,allowNetwork]),loadOcrReader:async()=>({extractImageText:async(a,language,s,progress)=>{events.push(['ocr',language,a.id]);progress('Reading · 50%');return makeOcrText(a,language,image,'Extracted words.',[]);}})}));
 const progress=[];const result=await adapters.ocr(asset,signal,label=>progress.push(label));
 assert.deepEqual(events,[['release'],['runtime','ocr',false],['ocr','eng',asset.id]]);assert.deepEqual(progress,['Reading · 50%']);assert.equal(result.text,'Extracted words.');
});

test('PDF adapter prepares only local readers and releases inference only when a scanned page starts OCR',async()=>{
 const asset=await source('scan.pdf','application/pdf'),events=[],progress=[],signal=new AbortController().signal;
 const adapters=createAutomaticReadingAdapters(basePorts({ensureRuntime:async(role,allowNetwork)=>events.push(['runtime',role,allowNetwork]),releaseInference:async()=>events.push(['release']),loadPdfReader:async()=>({extractPdf:async(a,s,pageProgress,options)=>{events.push(['pdf',a.id,options.language]);pageProgress(2,3);await options.beforeOcr();options.progress('Page 2 / 3 · Reading');return makePdfText(a,3,[{page:1,text:'Extracted page.',regions:[]}]);}})}));
 const result=await adapters.pdf(asset,signal,label=>progress.push(label));
 assert.deepEqual(events,[['runtime','pdf',false],['runtime','ocr',false],['pdf',asset.id,'eng'],['release']]);assert.deepEqual(progress,['Reading · 2 / 3','Page 2 / 3 · Reading']);assert.equal(result.text,'Extracted page.');
});

test('PDF with no prepared OCR verifies only the PDF runtime and does not release inference',async()=>{
 const asset=await source('text.pdf','application/pdf'),events=[],signal=new AbortController().signal;
 const adapters=createAutomaticReadingAdapters(basePorts({ocrReady:false,ensureRuntime:async(role,allowNetwork)=>events.push(['runtime',role,allowNetwork]),releaseInference:async()=>events.push(['release']),loadPdfReader:async()=>({extractPdf:async(a,s,progress,options)=>{assert.equal(options,undefined);return makePdfText(a,1,[{page:1,text:'Text layer.',regions:[]}]);}})}));
 const result=await adapters.pdf(asset,signal,()=>{});assert.deepEqual(events,[['runtime','pdf',false]]);assert.equal(result.text,'Text layer.');
});

test('speech adapter uses the selected model provenance and verifies runtime locally before transcription',async()=>{
 const asset=await source('voice.wav','audio/wav'),events=[],signal=new AbortController().signal;
 const adapters=createAutomaticReadingAdapters(basePorts({ensureRuntime:async(role,allowNetwork)=>events.push(['runtime',role,allowNetwork]),transcribeOriginal:async(a,language,s,transcribe,provenance)=>{events.push(['transcribe',language,provenance.id,provenance.revision]);return makeTranscript(a,1000,{text:'こんにちは。',chunks:[{text:'こんにちは。',timestamp:[0,1]}]},language,undefined,provenance);}}));
 const result=await adapters.speech(asset,signal,()=>{});assert.deepEqual(events,[['runtime','speech',false],['transcribe','ja','whisper-tiny',speechModelProvenance('whisper-tiny').revision]]);assert.equal(result.text,'こんにちは。');assert.equal(result.language,'ja');
});

test('video Vision verifies its runtime and opens audio transcription only when the frame reader asks for it',async()=>{
 const asset=await source('clip.mp4','video/mp4'),events=[],signal=new AbortController().signal;
 const adapters=createAutomaticReadingAdapters(basePorts({ensureRuntime:async(role,allowNetwork)=>events.push(['runtime',role,allowNetwork]),transcribeOriginal:async(a,language,s,transcribe,provenance)=>{events.push(['transcribe',language,provenance.id]);return makeTranscript(a,1000,{text:'Spoken words.',chunks:[{text:'Spoken words.',timestamp:[0,1]}]},language,undefined,provenance);},loadVideoReader:async()=>({describeVideoOriginal:async(a,prompt,s,progress,ports)=>{events.push(['video',prompt,ports.audio.selected,ports.audio.ready]);const transcript=await ports.audio.read();events.push(['transcript',transcript.text]);return {scope:'controlled-video'};}})}));
 const result=await adapters.vision(asset,signal,()=>{});assert.deepEqual(events,[['runtime','vision',false],['video','Describe this source.',true,true],['runtime','speech',false],['transcribe','ja','whisper-tiny'],['transcript','Spoken words.']]);assert.deepEqual(result,{scope:'controlled-video'});
});

test('an already stopped attachment never enters a runtime or reader',async()=>{
 const asset=await source(),controller=new AbortController(),events=[];controller.abort();
 const adapters=createAutomaticReadingAdapters(basePorts({ensureRuntime:async(...args)=>events.push(args),loadOcrReader:async()=>{events.push(['reader']);return {};}}));
 await assert.rejects(adapters.ocr(asset,controller.signal,()=>{}),/Stopped|abort/i);assert.deepEqual(events,[]);
});
