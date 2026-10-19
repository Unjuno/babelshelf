import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOriginal,originalRef,originalNote,originalKey} from '../src/original-assets.ts';
import {makeOcrText} from '../src/ocr-text.ts';
import {makePdfText} from '../src/pdf-text.ts';
import {makeTranscript} from '../src/speech-transcript.ts';
import {buildInputReadings,readingRef,validateInputReadings,readingEvidence} from '../src/input-readings.ts';
import {readInputOriginal} from '../src/automatic-reading.ts';
import {recordProcessingOperation} from '../src/processing-history.ts';
import {appendTurn,emptyDialogue} from '../src/conversation.ts';
const policy={ocrModel:'tesseract-7',ocrReady:true,ocrLanguage:'eng',speechModel:'whisper-tiny',speechReady:true,speechLanguage:'en'};
const record=(events,signal)=>(tool,input,work,project)=>recordProcessingOperation(tool,input,work,async a=>{events.push(a);},project,()=>signal.aborted);
const raw=async(name='image.png',type='image/png')=>prepareOriginal(new File(['controlled bytes'],name,{type}));
const image={width:100,height:100,processedWidth:100,processedHeight:100,frame:0,orientation:'browser-decoded'};
// Adapter results are controlled metadata for orchestration, not OCR/ASR acceptance.
test('Send auto OCR retains raw identity, returns extracted not reviewed text, and records real operation lifecycle',async()=>{
 const asset=await raw(),controller=new AbortController(),events=[],before=structuredClone(asset);let called=0;
 const value=await readInputOriginal(asset,policy,{ocr:async a=>{called++;return makeOcrText(a,'eng',image,'The code is LIME-7781.',[]);}},controller.signal,()=>{},record(events,controller.signal));
 assert.equal(called,1);assert.equal(value.reading.kind,'ocr');assert.match(value.status,/extracted/i);assert.doesNotMatch(value.status,/reviewed/i);assert.deepEqual(asset,before);assert.equal(events[0].status,'running');assert.equal(events[1].status,'succeeded');assert.equal(events[1].output.automatic,true);assert.equal(events[1].output.reviewRequired,false);
 const notes=[originalNote(asset),...buildInputReadings([value.reading],[{key:originalKey(asset.id),value:asset}])];assert.equal(notes[1].revisions[0].body,'The code is LIME-7781.');
});
test('missing preparation and unsupported formats never invoke adapters or automatic downloads; empty PDF stays unread',async()=>{
 const asset=await raw(),controller=new AbortController(),events=[];let called=0;const adapters={ocr:async()=>{called++;throw Error('must not run');},pdf:async a=>makePdfText(a,1,[{page:1,text:'',regions:[]}])};
 const missing=await readInputOriginal(asset,{...policy,ocrReady:false},adapters,controller.signal,()=>{},record(events,controller.signal));assert.equal(missing.reading,undefined);assert.match(missing.status,/not prepared/i);assert.equal(called,0);assert.equal(events.at(-1).status,'failed');
 const gif=await raw('image.gif','image/gif'),unsupported=await readInputOriginal(gif,policy,adapters,controller.signal,()=>{},record(events,controller.signal));assert.equal(unsupported.reading,undefined);assert.match(unsupported.status,/unsupported/i);assert.equal(called,0);
 const pdf=await raw('scan.pdf','application/pdf'),blank=await readInputOriginal(pdf,policy,adapters,controller.signal,()=>{},record(events,controller.signal));assert.equal(blank.reading,undefined);assert.match(blank.status,/OCR/i);assert.equal(events.at(-1).status,'failed');
});
test('audio/video extraction becomes separate current text evidence, preserving audio-only video coverage and original source',async()=>{
 for(const [name,mime] of [['voice.wav','audio/wav'],['clip.webm','video/webm']]){
  const asset=await raw(name,mime),controller=new AbortController(),events=[],value=await readInputOriginal(asset,policy,{speech:async a=>makeTranscript(a,2000,{text:'The copper code is Maple 42.',chunks:[{text:'The copper code is Maple 42.',timestamp:[0,2]}]})},controller.signal,()=>{},record(events,controller.signal));
  assert.equal(value.reading.kind,'speech');assert.match(value.status,/extracted/i);if(asset.kind==='video')assert.match(value.status,/frames not processed/i);
  const runs=[{key:originalKey(asset.id),value:asset}],notes=[originalNote(asset),...buildInputReadings([value.reading],runs)],dialogue=appendTurn(emptyDialogue(),{id:'turn',user:'What is the code?',attachments:[{id:asset.id,name:asset.name,kind:asset.kind,status:value.status,asset:originalRef(asset),reading:readingRef(value.reading)}]});validateInputReadings(dialogue,notes,runs);const evidence=readingEvidence(notes,[readingRef(value.reading)],'copper');assert.ok(evidence.length);if(asset.kind==='video')assert.match(evidence[0].coverage,/audio.only/i);
 }
});
test('Stop while extracting or persisting completion propagates and never becomes a normal unread fallback',async()=>{
 const asset=await raw();for(const phase of ['extract','completion']){
  const controller=new AbortController(),events=[];const adapters={ocr:async a=>{if(phase==='extract')controller.abort();return makeOcrText(a,'eng',image,'Text.',[]);}};
  const persist=async a=>{events.push(a);if(phase==='completion'&&a.status==='succeeded')controller.abort();};
  await assert.rejects(readInputOriginal(asset,policy,adapters,controller.signal,()=>{},(tool,input,work,project)=>recordProcessingOperation(tool,input,work,persist,project,()=>controller.signal.aborted)),/Stopped|abort/i);assert.equal(events[0].status,'running');assert.equal(events.at(-1).status,phase==='extract'?'stopped':'succeeded');
 }
});


test('processing ledger write failure aborts Send instead of silently degrading to an unread attachment',async()=>{
 const asset=await raw(),controller=new AbortController();
 for(const phase of ['start','completion','failure']){let count=0;await assert.rejects(readInputOriginal(asset,policy,{ocr:async a=>{if(phase==='failure')throw Error('reader failed');return makeOcrText(a,'eng',image,'Text.',[]);}},controller.signal,()=>{},(tool,input,work,project)=>recordProcessingOperation(tool,input,work,async()=>{count++;if(phase==='start'||count===2)throw Error('disk full');},project,()=>false)),/disk full|activity record unavailable/);}
});

import {capabilityState,localAdapters,requireCapability,videoCapabilityStatus} from '../src/local-capabilities.ts';
test('shared capability dispatch separates role, engine support and verified assets',()=>{
 assert.equal(capabilityState('image.ocr','tesseract-7',false).status,'Not prepared');
 assert.equal(requireCapability('image.ocr','tesseract-7',true).engine,'tesseract-wasm');
 assert.equal(capabilityState('audio.transcribe','whisper-base',true).status,'Runtime not connected');
 assert.equal(capabilityState('audio.transcribe','d1-omni-600M',true).status,'Runtime not connected');
 assert.equal(capabilityState('decision.classify','d1-omni-600M',true).status,'Ready');
 assert.equal(capabilityState('text.generate','lfm25-230m-qad-q4-0',false).status,'Not prepared');
 assert.equal(requireCapability('text.generate','lfm25-230m-qad-q4-0',true).engine,'wllama-cpu-count');
 assert.equal(capabilityState('image.describe','d1-omni-600M',true).status,'Unsupported');
 assert.equal(capabilityState('audio.transcribe','',true).status,'Not configured');
 assert.equal(capabilityState('video.frames','whisper-tiny',true).status,'Unsupported');
 assert.equal(videoCapabilityStatus('whisper-tiny',true),'Ready');
 assert.equal(videoCapabilityStatus('',true),'Speech model required');
 const customSpeech=[{id:'local-whisper',role:'speech',engine:'transformers-whisper-onnx'}];
 assert.equal(videoCapabilityStatus('local-whisper',false,customSpeech),'Speech model not prepared');
 assert.equal(videoCapabilityStatus('local-whisper',true,customSpeech),'Ready');
 assert.equal(capabilityState('pdf.text','',false).status,'Ready');
 for(const c of ['text.embed','text.rerank','audio.synthesize'])assert.equal(capabilityState(c,'4B',true).status,'Unsupported');
 assert.throws(()=>localAdapters[0].capabilities.push('image.describe'),TypeError);
 assert.throws(()=>requireCapability('video.frames','whisper-tiny',true),/Unsupported/);
});
test('only the app-owned D1 text adapter accepts a validated custom Decision registration',()=>{
 const custom=[{id:'local-decision-example',role:'decision',engine:'onnx-d1-text'}];
 assert.equal(capabilityState('decision.classify',custom[0].id,false,custom).status,'Not prepared');
 assert.equal(capabilityState('decision.classify',custom[0].id,true,custom).adapter.engine,'onnx-d1');
 assert.equal(capabilityState('audio.transcribe',custom[0].id,true,custom).status,'Runtime not connected');
 assert.equal(capabilityState('decision.classify','custom-unknown',true,custom).status,'Runtime not connected');
});
test('a different selected role or unsupported model cannot reach a prepared media adapter',async()=>{
 const asset=await raw(),controller=new AbortController();let called=0;
 for(const bad of ['d1-omni-600M','custom-ocr','whisper-tiny']){
  const value=await readInputOriginal(asset,{...policy,ocrModel:bad,ocrReady:true},{ocr:async()=>{called++;throw Error('must not run');}},controller.signal,()=>{},record([],controller.signal));
  assert.equal(value.reading,undefined);assert.match(value.status,/not prepared/);
 }
 assert.equal(called,0);
});

import {recoverSubmittedInput} from '../src/input-recovery.ts';
test('failed submitted input returns only to an empty composer without duplicate originals or automatic replay',()=>{
 const sent={text:'質問',attachments:[{asset:{id:'raw',revision:1,sha256:'pin'},reading:{kind:'ocr',noteId:'derived',revision:1},status:'Image text extracted'}]};
 const recovered=recoverSubmittedInput({text:'',attachments:[]},sent);
 assert.deepEqual(recovered,sent);assert.notEqual(recovered.attachments,sent.attachments);assert.notEqual(recovered.attachments[0],sent.attachments[0]);
 assert.equal(recoverSubmittedInput({text:'new draft',attachments:[]},sent),null);
 assert.equal(recoverSubmittedInput({text:' ',attachments:[]},sent),null);
 assert.equal(recoverSubmittedInput({text:'',attachments:[{}]},sent),null);
 assert.equal(recoverSubmittedInput({text:'',attachments:[]},null),null);
 for(const extra of [{file:{}},{prepared:{}},{reviewedText:{}},{asset:undefined}])assert.throws(()=>recoverSubmittedInput({text:'',attachments:[]},{...sent,attachments:[{...sent.attachments[0],...extra}]}),/originals/);
});

import {processorAssetControls} from '../src/local-capabilities.ts';
test('processor verification stays local even when downloads are enabled; unsupported registrations stay inert',()=>{
 for(const [capability,model] of [['audio.transcribe','whisper-tiny'],['image.ocr','tesseract-7'],['decision.classify','d1-omni-600M']]){
  for(const downloads of [false,true])assert.deepEqual(processorAssetControls(capability,model,true,false,downloads),{label:'Verify',enabled:true,allowNetwork:false});
  assert.equal(processorAssetControls(capability,model,false,false,false).enabled,false);
  assert.equal(processorAssetControls(capability,model,false,false,true).allowNetwork,true);
  assert.equal(processorAssetControls(capability,model,true,true,true).enabled,false);
 }
 assert.equal(processorAssetControls('audio.transcribe','whisper-base',true,false,true).enabled,false);
 assert.equal(processorAssetControls('image.describe','d1-omni-600M',true,false,true).enabled,false);
});

import {prepareSpeech} from '../src/speech-assets.ts';
import {prepareOcr} from '../src/ocr-assets.ts';
test('offline processor verification refuses missing or corrupt local bytes without fetch or replacement',async()=>{
 const saved={caches:globalThis.caches,fetch:globalThis.fetch,location:globalThis.location};let fetches=0,writes=0;
 try{globalThis.location={origin:'http://localhost'};globalThis.fetch=async()=>{fetches++;throw Error('Unexpected network');};
 for(const response of [undefined,new Response('corrupt')]){globalThis.caches={open:async()=>({match:async()=>response?.clone(),put:async()=>{writes++;}})};
 await assert.rejects(prepareSpeech(false,()=>{}),/not prepared/);
 await assert.rejects(prepareOcr('eng',false,new AbortController().signal,()=>{}),/not prepared/);}
 assert.equal(fetches,0);assert.equal(writes,0);
 }finally{for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
