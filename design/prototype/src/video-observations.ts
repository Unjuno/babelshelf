import {visionManifest} from './vision-assets.ts';
import {originalRef,readOriginal,type OriginalAsset,type OriginalRef} from './original-assets.ts';
import {videoFramePlan,validateSampledFrame,type VideoFramePlan} from './video-frame-plan.ts';
import {validateTranscript,type Transcript} from './speech-transcript.ts';
import {transcriptCitationRange,type AudioRange} from './voice-input.ts';
import {validVisionModelIdentity,type VisionModelIdentity} from './vision-model-identity.ts';
export type VideoFrameObservation={requestedUs:number;timestampUs:number;durationUs:number;width:number;height:number;imageSha256:string;text:string};
export type VideoAudioReading={status:'processed';value:Transcript}|{status:'not-selected'|'not-prepared'|'no-audio-track'|'too-long'};
export type VideoVisionText={schema:2;scope:'sampled-video';model:string;revision:string;runtime:string;original:OriginalRef;prompt:string;text:string;width:number;height:number;plan:VideoFramePlan;frames:(VideoFrameObservation&{start:number;end:number})[];audio:VideoAudioReading;audioStart?:number};
function render(frames:VideoFrameObservation[],audio:VideoAudioReading){
 let text='Sampled video frames only; other frames and events were not inspected.\n';
 const mapped=frames.map(frame=>{text+='\nFrame at '+(frame.timestampUs/1e6).toFixed(3)+' s\n';const start=text.length;text+=frame.text;const end=text.length;text+='\n';return {...frame,start,end};});
 let audioStart:number|undefined;
 if(audio.status==='processed'){text+='\nAudio transcript (model-estimated timing)\n';audioStart=text.length;text+=audio.value.text;}
 else text+='\nAudio not processed · '+audio.status;
 return {text,frames:mapped,...(audioStart!==undefined?{audioStart}:{})};
}
export function makeVideoVisionText(asset:OriginalAsset,prompt:string,plan:VideoFramePlan,frames:VideoFrameObservation[],audio:VideoAudioReading,identity:VisionModelIdentity={model:visionManifest.id,revision:visionManifest.revision,runtime:visionManifest.runtime}):VideoVisionText{
 const value:VideoVisionText={schema:2,scope:'sampled-video',...identity,original:originalRef(asset),prompt,width:plan.width,height:plan.height,plan:structuredClone(plan),audio:structuredClone(audio),...render(frames,audio)};
 validateVideoVisionText(value,asset);return value;
}
export function validateVideoVisionText(value:VideoVisionText,asset:OriginalAsset){
 readOriginal(asset,value?.original);
 if(asset.kind!=='video'||value.schema!==2||value.scope!=='sampled-video'||!validVisionModelIdentity(value)||typeof value.prompt!=='string'||!value.prompt.trim()||value.prompt.length>2000||typeof value.text!=='string'||value.text.length>50000||value.text.includes('\0'))throw Error('Video observation metadata invalid');
 const p=value.plan,reconstructed=videoFramePlan({trackId:p?.trackId,start:p?.startUs/1e6,end:p?.endUs/1e6,width:p?.width,height:p?.height});
 if(JSON.stringify(p)!==JSON.stringify(reconstructed)||value.width!==p.width||value.height!==p.height||!Array.isArray(value.frames)||value.frames.length!==p.timestampsUs.length)throw Error('Video observation plan invalid');
 for(let i=0;i<value.frames.length;i++){
  const f=value.frames[i];validateSampledFrame(p,f.requestedUs,{timestamp:f.timestampUs/1e6,duration:f.durationUs/1e6,width:f.width,height:f.height});
  if(f.requestedUs!==p.timestampsUs[i]||typeof f.text!=='string'||!f.text.trim()||f.text.length>16000||f.text.includes('\0')||typeof f.imageSha256!=='string'||!/^[a-f0-9]{64}$/.test(f.imageSha256))throw Error('Video frame observation invalid');
 }
 if(value.audio?.status==='processed')validateTranscript(value.audio.value,asset);
 else if(!value.audio||!['not-selected','not-prepared','no-audio-track','too-long'].includes(value.audio.status)||Object.keys(value.audio).join(',')!=='status')throw Error('Video audio coverage invalid');
 const rendered=render(value.frames.map(({start,end,...frame})=>frame),value.audio);
 if(rendered.text!==value.text||JSON.stringify(rendered.frames)!==JSON.stringify(value.frames)||rendered.audioStart!==value.audioStart)throw Error('Video observation text ranges invalid');
}
export function videoVisionCoverage(value:VideoVisionText){return 'Generated observations of '+value.frames.length+' sampled video frames only; may be incorrect; other frames/events not inspected; '+(value.audio.status==='processed'?'audio transcript with estimated timing':'audio not processed ('+value.audio.status+')');}
export function videoVisionCitationRange(value:VideoVisionText,body:string,revision:number,start:number,end:number):AudioRange{
 const whole={startMs:0,endMs:value.plan.endUs/1000,label:'Whole video · sampled observations'};
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>body.length)throw Error('Source range invalid');
 if(revision!==1||body!==value.text)return {...whole,label:'Whole video · edited observations'};
 const frames=value.frames.filter(frame=>start<frame.end&&end>frame.start);
 const audioOverlap=value.audio.status==='processed'&&value.audioStart!==undefined&&end>value.audioStart;
 if(audioOverlap&&frames.length)return whole;
 if(audioOverlap&&value.audio.status==='processed'){
  const offset=value.audioStart!,range=transcriptCitationRange(value.audio.value,value.audio.value.text,1,Math.max(0,start-offset),end-offset);
  return {...range,label:'Video audio · '+range.label};
 }
 if(!frames.length)return whole;
 return {startMs:Math.min(...frames.map(f=>f.timestampUs))/1000,endMs:Math.max(...frames.map(f=>f.timestampUs+f.durationUs))/1000,seekable:true,label:'Sampled frame'+(frames.length>1?'s':'')+' · '+frames.map(f=>(f.timestampUs/1e6).toFixed(3)+' s').join(', ')};
}
