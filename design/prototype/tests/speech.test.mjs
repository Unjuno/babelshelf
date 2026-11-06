import test from 'node:test';
import assert from 'node:assert/strict';
import {speechFile,verifySpeechBytes,speechManifest,speechRuntimeResponse} from '../src/speech-assets.ts';
import {makeTranscript,validateTranscript,transcriptNote,validateTranscriptLinks} from '../src/speech-transcript.ts';
import {prepareOriginal} from '../src/original-assets.ts';

test('video audio transcription retains video identity, explicit audio-only scope and exact backup provenance',async()=>{
 const {originalNote,originalKey}=await import('../src/original-assets.ts'),{makeStateBackup,parseStateBackup,stateHash}=await import('../src/backup-state.ts');
 const asset=await prepareOriginal(new File(['video container bytes'],'clip.webm',{type:'video/webm'}),'video-track');
 const t=makeTranscript(asset,5000,{text:'The blue code is Cedar 27.',chunks:[{text:'The blue code is Cedar 27.',timestamp:[1,4]}]});
 assert.equal(t.sourceTrack,'video-audio');assert.equal(asset.kind,'video');const n=transcriptNote('video-transcript',asset,t);
 const pack=await makeStateBackup({notes:[originalNote(asset),n],settings:[],runs:[{key:originalKey(asset.id),value:asset}]});const restored=await parseStateBackup(JSON.stringify(pack));assert.deepEqual(restored.notes[1].transcription,t);
 for(const mutate of [p=>delete p.payload.notes[1].transcription.sourceTrack,p=>p.payload.notes[1].transcription.sourceTrack='video-frames',p=>p.payload.notes[1].transcription.timebase='video-container']){const bad=structuredClone(pack);mutate(bad);bad.sha256=stateHash(bad.payload);await assert.rejects(parseStateBackup(JSON.stringify(bad)),/transcript/i);}
 const audio=await prepareOriginal(new File(['audio'],'audio.wav',{type:'audio/wav'}));const a=makeTranscript(audio,1000,{text:'Audio',chunks:[{text:'Audio',timestamp:[0,1]}]});assert.equal(a.sourceTrack,undefined);assert.throws(()=>validateTranscript({...a,sourceTrack:'video-audio'},audio),/transcript/i);
 const image=await prepareOriginal(new File(['image'],'image.png',{type:'image/png'}));assert.throws(()=>makeTranscript(image,1000,{text:'Invented image words',chunks:[{text:'Invented image words',timestamp:[0,1]}]}),/transcript/i);
});
test('speech assets only resolve exact pinned local files; corrupt bytes and unrelated URLs refuse',()=>{
 const f=speechManifest.files[0];assert.equal(speechFile('/asr-model/whisper-tiny/'+f.path)?.sha256,f.sha256);
 for(const path of [f.url,'https://evil.invalid/asr-model/whisper-tiny/'+f.path,'/asr-model/whisper-unknown/'+f.path,'/asr-model/whisper-tiny/../'+f.path])assert.equal(speechFile(path),undefined);
 assert.throws(()=>verifySpeechBytes(f,new Uint8Array(f.bytes)),/verification/i);
});
test('reviewed transcript pins exact original, model and bounded time segments without modifying raw projection',async()=>{
 const asset=await prepareOriginal(new File(['audio bytes'],'voice.wav',{type:'audio/wav'}),'audio1');
 const value=makeTranscript(asset,1000,{text:'Hello world',chunks:[{text:'Hello world',timestamp:[0,1]}]});validateTranscript(value,asset);
 assert.equal(value.original.sha256,asset.sha256);assert.equal(value.model.revision,speechManifest.revision);assert.equal(value.segments[0].endMs,1000);
 for(const patch of [{durationMs:0},{text:''},{original:{...value.original,sha256:'0'.repeat(64)}},{segments:[{text:'wrong',startMs:0,endMs:2000}]}])assert.throws(()=>validateTranscript({...value,...patch},asset),/transcript|original/i);
 assert.throws(()=>makeTranscript(asset,1000,{text:'Hallucinated',chunks:[{text:'Hallucinated',timestamp:[2,3]}]}),/transcript/i);
});

test('custom Whisper transcript records its exact local model revision and rejects lookalikes',async()=>{
 const asset=await prepareOriginal(new File(['audio bytes'],'voice.wav',{type:'audio/wav'}),'custom-audio'),id='local-speech-'+'a'.repeat(64),model={id,revision:'sha256:'+'a'.repeat(64),runtime:speechManifest.runtime,dtype:'q8'},result={text:'Custom model words',chunks:[{text:'Custom model words',timestamp:[0,1]}]};
 const transcript=makeTranscript(asset,1000,result,'en',undefined,model);assert.deepEqual(transcript.model,model);validateTranscript(transcript,asset);
 for(const change of [{...model,revision:'main'},{...model,runtime:'remote-api'},{...model,id:'whisper-base'}])assert.throws(()=>validateTranscript({...transcript,model:change},asset),/transcript/i);
});

test('transcript backup preserves raw source and segment identity; tampered original text or model revision refuses',async()=>{
 const {originalNote,originalKey}=await import('../src/original-assets.ts'),{makeStateBackup,parseStateBackup,stateHash}=await import('../src/backup-state.ts');
 const asset=await prepareOriginal(new File(['raw audio'],'source.wav',{type:'audio/wav'}),'source1'),t=makeTranscript(asset,2000,{text:'Water four liters.',chunks:[{text:'Water four liters.',timestamp:[0,2]}]}),n=transcriptNote('transcript1',asset,t),runs=[{key:originalKey(asset.id),value:asset}];
 validateTranscriptLinks([n],runs);const pack=await makeStateBackup({notes:[originalNote(asset),n],settings:[],runs});const result=await parseStateBackup(JSON.stringify(pack));assert.equal(result.notes[1].transcription.original.sha256,asset.sha256);
 for(const mutate of [v=>v.payload.notes[1].revisions[0].body='Invented transcript',v=>v.payload.notes[1].transcription.model.revision='main',v=>v.payload.runs=[]]){const bad=structuredClone(pack);mutate(bad);bad.sha256=stateHash(bad.payload);await assert.rejects(parseStateBackup(JSON.stringify(bad)));}
});

test('note-only legacy cannot admit an orphan transcript without its raw source',async()=>{
 const {makeBackup}=await import('../../../dist/core.js'),{parseStateBackup}=await import('../src/backup-state.ts');const asset=await prepareOriginal(new File(['raw'],'source.wav',{type:'audio/wav'})),t=makeTranscript(asset,1000,{text:'Water',chunks:[{text:'Water',timestamp:[0,1]}]}),n=transcriptNote('legacyTranscript',asset,t);await assert.rejects(parseStateBackup(JSON.stringify(await makeBackup([n]))),/state backup/);
});

test('transcription language is explicit and retained, and legacy settings gain a readable default without rewriting bytes',async()=>{
 const {parsePreference,initialPreferenceNotes,readPreference}=await import('../src/preference-records.ts');const asset=await prepareOriginal(new File(['raw'],'speech.wav',{type:'audio/wav'}));const t=makeTranscript(asset,1000,{text:'日本語',chunks:[{text:'日本語',timestamp:[0,1]}]},'ja');assert.equal(t.language,'ja');assert.throws(()=>makeTranscript(asset,1000,{text:'x',chunks:[{text:'x',timestamp:[0,1]}]},'invalid'),/language/i);
 const current=readPreference('models',initialPreferenceNotes);assert.equal(current.transcriptionLanguage,'en');const prior={...current};delete prior.transcriptionLanguage;delete prior.schemaVersion;const old='# Models\n\n```json\n'+JSON.stringify(prior)+'\n```\n';assert.equal(parsePreference('models',old).transcriptionLanguage,'en');
});

test('actual Transformers cache helper cannot fall through to HTTP after missing or corrupt model assets',async()=>{
 const {env}=await import('../node_modules/@huggingface/transformers/src/env.js'),{getModelJSON}=await import('../node_modules/@huggingface/transformers/src/utils/hub.js');let requests=0;const prior=globalThis.fetch;globalThis.fetch=async()=>{requests++;throw Error('Unexpected HTTP');};
 try{env.allowLocalModels=true;env.allowRemoteModels=false;env.localModelPath='/asr-model/';env.useFSCache=false;env.useBrowserCache=false;env.useCustomCache=true;env.customCache={match:path=>speechRuntimeResponse(path,async()=>{throw Error('Corrupt verified cache');}),put:async()=>{throw Error('No runtime cache writes');}};await assert.rejects(getModelJSON('whisper-tiny','config.json',true,{local_files_only:true}));assert.equal(requests,0);}finally{globalThis.fetch=prior;}
});

test('Whisper padded end timestamp clips to actual audio while preserving the original model estimate',async()=>{
 const asset=await prepareOriginal(new File(['raw'],'speech.wav',{type:'audio/wav'})),t=makeTranscript(asset,6944,{text:'日本語',chunks:[{text:'日本語',timestamp:[3.8,7.6]}]},'ja');assert.equal(t.segments[0].endMs,6944);assert.equal(t.segments[0].modelEndMs,7600);assert.equal(t.timing,'model-estimated');validateTranscript(t,asset);
});
