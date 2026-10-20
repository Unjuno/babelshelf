import {readOriginal,type OriginalAsset} from './original-assets.ts';
import {visionManifest} from './vision-assets.ts';
import {makeVideoVisionText,type VideoFrameObservation,type VideoAudioReading} from './video-observations.ts';
import type {SampledVideoFrame} from './video-frames.ts';
import type {VideoFramePlan} from './video-frame-plan.ts';
import type {Transcript} from './speech-transcript.ts';
// @ts-expect-error Shared streaming SHA implementation.
import {SHA256} from '../../../dist/sha256.js';
type ImageResult={model:string;revision:string;runtime:string;width:number;height:number;text:string};
type Ports={describe:(images:Blob[],prompt:string)=>Promise<{frames:ImageResult[]}>;audio:{selected:boolean;ready:boolean;read?:()=>Promise<Transcript>};sample?:(blob:Blob,signal:AbortSignal,consume:(frame:SampledVideoFrame,plan:VideoFramePlan,index:number)=>Promise<void>,progress:(status:string)=>void)=>Promise<VideoFramePlan>};
export async function describeVideoOriginal(asset:OriginalAsset,prompt:string,signal:AbortSignal,progress:(status:string)=>void,ports:Ports){
 const check=()=>{if(signal.aborted)throw Error('Stopped');};check();
 if(asset.kind!=='video'||!prompt.trim()||prompt.length>2000)throw Error('Video question required · maximum 2,000 characters');
 const frames:(Omit<VideoFrameObservation,'text'>&{image:Blob})[]=[],sample=ports.sample??(await import('./video-frames.ts')).readVideoFrames;
 const plan=await sample(new Blob([readOriginal(asset).slice().buffer],{type:asset.mime}),signal,async frame=>{
  check();const bytes=new Uint8Array(await frame.image.arrayBuffer());check();const {image,...metadata}=frame;
  frames.push({...metadata,image,imageSha256:new SHA256().update(bytes).hex()});
 },progress);check();
 if(frames.length!==plan.timestampsUs.length)throw Error('Video frame sampling incomplete');
 progress('Analyzing sampled video frames');const result=await ports.describe(frames.map(f=>f.image),prompt);check();
 if(!Array.isArray(result.frames)||result.frames.length!==frames.length)throw Error('Video observations incomplete');
 const observations=frames.map(({image,...frame},i)=>{const r=result.frames[i];if(r.model!==visionManifest.id||r.revision!==visionManifest.revision||r.runtime!==visionManifest.runtime||r.width!==frame.width||r.height!==frame.height)throw Error('Video observation model changed');return {...frame,text:r.text};});
 let audio:VideoAudioReading={status:!ports.audio.selected?'not-selected':!ports.audio.ready?'not-prepared':'too-long'};
 if(ports.audio.selected&&ports.audio.ready&&plan.endUs-plan.startUs<=120000000){
  if(!ports.audio.read)throw Error('Video audio reader unavailable');
  progress('Transcribing video audio');try{audio={status:'processed',value:await ports.audio.read()};check();}catch(error){check();if((error as Error).message!=='No audio track')throw error;audio={status:'no-audio-track'};}
 }
 check();return makeVideoVisionText(asset,prompt,plan,observations,audio);
}
