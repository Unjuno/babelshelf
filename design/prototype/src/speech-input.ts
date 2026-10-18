import {readOriginal,type OriginalAsset} from './original-assets.ts';
import {makeTranscript} from './speech-transcript.ts';
// Reject a known oversized audio duration before allocating full decoded PCM.
// Streaming/unknown metadata is only a hint; the decoded duration stays authoritative.
async function checkAudioDuration(bytes:ArrayBuffer,mime:string,signal:AbortSignal){
 const media=new Audio(),url=URL.createObjectURL(new Blob([bytes],{type:mime}));
 let timer:ReturnType<typeof setTimeout>|undefined,abort=()=>{};
 try{
  const duration=await new Promise<number|null>((resolve,reject)=>{
   abort=()=>reject(Error('Stopped'));signal.addEventListener('abort',abort,{once:true});
   if(signal.aborted){abort();return;}
   media.onloadedmetadata=()=>resolve(Number.isFinite(media.duration)&&media.duration>0?media.duration:null);
   media.onerror=()=>resolve(null);timer=setTimeout(()=>resolve(null),2000);
   media.preload='metadata';media.src=url;
  });
  if(signal.aborted)throw Error('Stopped');
  if(duration!==null&&duration>120)throw Error('Audio too long · maximum 2 minutes');
 }finally{
  if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);
  media.onloadedmetadata=null;media.onerror=null;media.removeAttribute('src');media.load();URL.revokeObjectURL(url);
 }
}
export async function transcribeOriginal(asset:OriginalAsset,language:string,signal:AbortSignal,transcribe:(samples:Float32Array,language:string)=>Promise<unknown>){
 const check=()=>{if(signal.aborted)throw Error('Stopped');};check();
 const bytes=readOriginal(asset).slice().buffer;
 if(asset.kind==='video'&&typeof AudioDecoder!=='undefined'){
  const {decodeVideoAudio}=await import('./video-audio.ts');check();
  const decoded=await decodeVideoAudio(new Blob([bytes],{type:asset.mime}),signal);check();
  const result=await transcribe(decoded.samples,language);check();
  return makeTranscript(asset,decoded.durationMs,result,language,decoded.timing);
 }
 if(asset.kind==='audio')await checkAudioDuration(bytes,asset.mime,signal);check();
 const audio=new AudioContext();let decoded:AudioBuffer;try{decoded=await audio.decodeAudioData(bytes);}finally{await audio.close();}check();
 if(decoded.duration<=0||decoded.duration>120)throw Error('Audio too long · maximum 2 minutes');
 const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000),node=offline.createBufferSource();node.buffer=decoded;node.connect(offline.destination);node.start();const mono=await offline.startRendering();check();
 const result=await transcribe(mono.getChannelData(0),language);check();return makeTranscript(asset,Math.ceil(decoded.duration*1000),result,language);
}
