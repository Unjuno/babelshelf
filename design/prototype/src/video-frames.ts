import {Input,BlobSource,MP4,WEBM,CanvasSink} from 'mediabunny';
import {videoFramePlan,validateSampledFrame,type VideoFramePlan} from './video-frame-plan.ts';
export type SampledVideoFrame=ReturnType<typeof validateSampledFrame>&{image:Blob};
async function encodeFrame(canvas:HTMLCanvasElement|OffscreenCanvas):Promise<Blob>{
 if('convertToBlob' in canvas)return canvas.convertToBlob({type:'image/jpeg',quality:.85});
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Video frame encoding failed')),'image/jpeg',.85));
}
// Local Blob only. The consumer finishes each frame before the next decode;
// no decoded-video queue, URL source, implicit download or model is owned here.
export async function readVideoFrames(blob:Blob,signal:AbortSignal,consume:(frame:SampledVideoFrame,plan:VideoFramePlan,index:number)=>Promise<void>,progress:(status:string)=>void=()=>{}){
 const check=()=>{if(signal.aborted)throw Error('Stopped');};check();
 if(!(blob instanceof Blob)||blob.size<1||blob.size>32*1024*1024)throw Error('Video file unsupported · maximum 32 MiB');
 const input=new Input({source:new BlobSource(blob),formats:[MP4,WEBM]}),abort=()=>input.dispose();
 signal.addEventListener('abort',abort,{once:true});
 try{
  const tracks=await input.getVideoTracks();check();
  if(tracks.length!==1)throw Error(tracks.length?'Multiple video tracks · selection required':'No video track');
  const track=tracks[0];if(!await track.canDecode())throw Error('Video frame codec unsupported');check();
  const plan=videoFramePlan({trackId:track.id,start:await track.getFirstTimestamp(),end:await track.computeDuration(),width:await track.getDisplayWidth(),height:await track.getDisplayHeight()});check();
  const sink=new CanvasSink(track,{width:plan.width,height:plan.height,fit:'contain',poolSize:1});
  for(let index=0;index<plan.timestampsUs.length;index++){
   check();progress('Reading video frame · '+(index+1)+' / '+plan.timestampsUs.length);
   const requestedUs=plan.timestampsUs[index],sample=await sink.getCanvas(requestedUs/1e6);check();
   if(!sample)throw Error('Requested video frame unavailable');
   const metadata=validateSampledFrame(plan,requestedUs,{timestamp:sample.timestamp,duration:sample.duration,width:sample.canvas.width,height:sample.canvas.height}),image=await encodeFrame(sample.canvas);check();
   if(image.type!=='image/jpeg'||image.size<1||image.size>2*1024*1024)throw Error('Video frame encoding unsupported');
   await consume({...metadata,image},plan,index);check();
  }
  return plan;
 }catch(error){check();throw error;}finally{signal.removeEventListener('abort',abort);input.dispose();}
}
