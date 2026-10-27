import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOriginal,originalNote,originalKey} from '../src/original-assets.ts';
import {videoFramePlan} from '../src/video-frame-plan.ts';
import {makeVideoVisionText,videoVisionCitationRange} from '../src/video-observations.ts';
import {visionTextNote,validateVisionLinks} from '../src/vision-text.ts';
import {visionManifest} from '../src/vision-assets.ts';
import {makeStateBackup,parseStateBackup} from '../src/backup-state.ts';
import {makeTranscript} from '../src/speech-transcript.ts';
import {buildInputReadings,readingRef,validateInputReadings,readingEvidence,readingStatus} from '../src/input-readings.ts';
import {groundedAnswer} from '../src/grounded-answer.ts';

const fixture=async()=>{
 const asset=await prepareOriginal(new File(['controlled video bytes'],'scene.mp4',{type:'video/mp4'}),'video-original'),plan=videoFramePlan({trackId:1,start:0,end:12,width:640,height:360});
 const frames=plan.timestampsUs.map((requestedUs,i)=>({requestedUs,timestampUs:requestedUs,durationUs:40000,width:640,height:360,imageSha256:String(i+1).repeat(64),text:['A red card.','A blue card.','A green card.'][i]}));
 return {asset,plan,frames};
};
test('sampled observations remain separate original-linked files and survive full backup validation',async()=>{
 const {asset,plan,frames}=await fixture(),value=makeVideoVisionText(asset,'What colors are visible?',plan,frames,{status:'not-selected'}),reading={id:'observations',kind:'vision',value},runs=[{key:originalKey(asset.id),value:asset}],notes=[originalNote(asset),...buildInputReadings([reading],runs)];
 validateVisionLinks(notes,runs);const dialogue={schema:1,revision:1,compaction:null,turns:[{id:'turn',user:'Colors?',attachments:[{id:asset.id,name:asset.name,kind:'video',status:readingStatus(reading,false),asset:value.original,reading:readingRef(reading)}]}]};
 validateInputReadings(dialogue,notes,runs);assert.match(readingStatus(reading,false),/sampled/i);assert.match(readingEvidence(notes,[readingRef(reading)],'colors')[0].coverage,/sampled.*audio not processed/i);
 const evidence=readingEvidence(notes,[readingRef(reading)],'colors');assert.equal(evidence[0].quote,frames[0].text);assert.equal(evidence[0].start,value.frames[0].start);assert.match(evidence[0].coverage,/2\.000 s/);
 for(const hit of evidence){assert.equal(value.text.slice(hit.start,hit.end),hit.quote);assert.doesNotMatch(hit.quote,/frames only|not inspected|Audio not processed/);}
 const restored=await parseStateBackup(JSON.stringify(await makeStateBackup({notes,settings:[{key:'ui-v1-dialogue',value:dialogue}],runs})));
 assert.equal(restored.notes.find(n=>n.id==='observations').visionText.scope,'sampled-video');assert.equal(restored.runs[0].value.sha256,asset.sha256);
 const selected=value.frames[1],range=videoVisionCitationRange(value,value.text,1,selected.start,selected.end);
 assert.equal(range.startMs,6000);assert.equal(range.seekable,true);assert.match(range.label,/sampled/i);
 assert.equal(videoVisionCitationRange(value,'edited',2,0,6).seekable,undefined);
});
test('video observation metadata cannot invent timing, model pins or source text',async()=>{
 const {asset,plan,frames}=await fixture(),value=makeVideoVisionText(asset,'Describe',plan,frames,{status:'not-selected'}),note=visionTextNote('observations',asset,value),runs=[{key:originalKey(asset.id),value:asset}];
 assert.equal(value.model,visionManifest.id);assert.equal(value.revision,visionManifest.revision);
 for(const mutate of [v=>v.frames[0].timestampUs=8000000,v=>v.frames[0].start++,v=>v.plan.trackId=-1,v=>v.revision='main',v=>v.text+=' invented',v=>v.original.sha256='a'.repeat(64)]){const changed=structuredClone(note);mutate(changed.visionText);assert.throws(()=>validateVisionLinks([changed],runs));}
 assert.throws(()=>makeVideoVisionText(asset,'Describe',plan,frames.slice(1),{status:'not-selected'}),/invalid/i);
});
test('audio transcript is an independently pinned optional source, not a visual model assertion',async()=>{
 const {asset,plan,frames}=await fixture(),audio=makeTranscript(asset,12000,{text:'Controlled spoken words.',chunks:[{text:'Controlled spoken words.',timestamp:[0,12]}]}),value=makeVideoVisionText(asset,'Describe',plan,frames,{status:'processed',value:audio});
 assert.equal(value.text.slice(value.audioStart),audio.text);assert.deepEqual(value.audio.value.model,audio.model);
 const note=visionTextNote('observations',asset,value),state={notes:[originalNote(asset),note],settings:[],runs:[{key:originalKey(asset.id),value:asset}]};await parseStateBackup(JSON.stringify(await makeStateBackup(state)));
 const range=videoVisionCitationRange(value,value.text,1,value.audioStart,value.text.length);assert.match(range.label,/Video audio/);assert.equal(range.seekable,undefined);
 const refs=readingEvidence(state.notes,[{kind:'vision',noteId:note.id,revision:1}],'spoken');assert.ok(refs.some(r=>r.quote==='Controlled spoken words.'));for(const ref of refs)assert.equal(value.text.slice(ref.start,ref.end),ref.quote);
 const audioRefs=readingEvidence(state.notes,[{kind:'video-audio',noteId:note.id,revision:1}],'spoken');assert.ok(audioRefs.length);for(const ref of audioRefs){assert.equal(value.text.slice(ref.start,ref.end),ref.quote);assert.ok(ref.start>=value.audioStart);assert.doesNotMatch(ref.quote,/card/i);assert.match(videoVisionCitationRange(value,value.text,1,ref.start,ref.end).label,/Video audio/);}
 let prompt='';const engine={loaded:'local',manifest:{contextTokens:4096,models:[],runtime:{}},count:async()=>({prompt_tokens:100}),generate:async messages=>{prompt=JSON.stringify(messages);return {text:JSON.stringify({answer:'Controlled spoken words.',citations:[{id:'S1',quote:'Controlled spoken words.'}]})};}};
 const answer=await groundedAnswer({store:{all:async()=>state.notes,search:async()=>[]},engine},{model:'local',question:'What is spoken in the attached video? Use only the audio.',mode:'answer',scope:{kind:'attachments',readings:[{kind:'video-audio',noteId:note.id,revision:1}]},context:{summary:'Earlier red card',recent:[{id:'old',user:'A green card',answer:'A blue card'}],refs:[]}});
 assert.equal(answer.sources[0].quote,'Controlled spoken words.');assert.doesNotMatch(prompt,/red card|green card|blue card/i);
 const noAudio=visionTextNote('no-audio',asset,makeVideoVisionText(asset,'Describe',plan,frames,{status:'not-selected'}));assert.throws(()=>readingEvidence([originalNote(asset),noAudio],[{kind:'video-audio',noteId:noAudio.id,revision:1}],'spoken'),/Audio-only transcript unavailable/);
 const tampered=structuredClone(note);tampered.visionText.audio.value.original.sha256='f'.repeat(64);assert.throws(()=>validateVisionLinks([tampered],state.runs));
});
