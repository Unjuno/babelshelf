import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOriginal} from '../src/original-assets.ts';
import {videoFramePlan} from '../src/video-frame-plan.ts';
import {describeVideoOriginal} from '../src/video-vision.ts';
import {visionManifest} from '../src/vision-assets.ts';
const fixture=async()=>{
 const asset=await prepareOriginal(new File(['controlled bytes'],'video.mp4',{type:'video/mp4'})),plan=videoFramePlan({trackId:1,start:0,end:12,width:640,height:360}),events=[];
 const sample=async(blob,signal,consume)=>{events.push('sample');for(const requestedUs of plan.timestampsUs)await consume({requestedUs,timestampUs:requestedUs,durationUs:40000,width:640,height:360,image:new Blob(['controlled frame'],{type:'image/jpeg'})},plan,events.length);events.push('decode-disposed');return plan;};
 const describe=async images=>{events.push('describe');assert.equal(images.length,3);return {frames:images.map(()=>({model:visionManifest.id,revision:visionManifest.revision,runtime:visionManifest.runtime,width:640,height:360,text:'Controlled visual observation.'}))};};
 return {asset,plan,events,sample,describe};
};
// Controlled ports verify orchestration/provenance, not codecs or vision accuracy.
test('one bounded image batch follows decoding; no audio model or network is invented',async()=>{
 const f=await fixture(),value=await describeVideoOriginal(f.asset,'What is visible?',new AbortController().signal,()=>{},{sample:f.sample,describe:f.describe,audio:{selected:false,ready:false}});
 assert.deepEqual(f.events,['sample','decode-disposed','describe']);assert.equal(value.frames.length,3);assert.equal(value.audio.status,'not-selected');assert.match(value.frames[0].imageSha256,/^[a-f0-9]{64}$/);assert.equal(value.plan.timebase,'container-presentation');
});
test('Stop or changed model output cannot commit late sampled observations or start audio',async()=>{
 for(const phase of ['decode','describe','identity']){const f=await fixture(),controller=new AbortController();let audio=0;
  const sample=async(...args)=>{const p=await f.sample(...args);if(phase==='decode')controller.abort();return p;};
  const describe=async images=>{const result=await f.describe(images);if(phase==='describe')controller.abort();if(phase==='identity')result.frames[0].revision='main';return result;};
  await assert.rejects(describeVideoOriginal(f.asset,'Describe',controller.signal,()=>{},{sample,describe,audio:{selected:true,ready:true,read:async()=>{audio++;throw Error('must not start');}}}),/Stopped|model changed/);assert.equal(audio,0);
 }
});
test('missing audio track is explicit partial coverage; decoder or transcription failures propagate',async()=>{
 const f=await fixture(),base={sample:f.sample,describe:f.describe};
 const partial=await describeVideoOriginal(f.asset,'Describe',new AbortController().signal,()=>{},{...base,audio:{selected:true,ready:true,read:async()=>{throw Error('No audio track');}}});assert.equal(partial.audio.status,'no-audio-track');
 await assert.rejects(describeVideoOriginal(f.asset,'Describe',new AbortController().signal,()=>{},{...base,audio:{selected:true,ready:true,read:async()=>{throw Error('Codec failure');}}}),/Codec failure/);
});
