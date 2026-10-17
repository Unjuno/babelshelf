import {readOriginal,type OriginalAsset} from './original-assets.ts';
import {makeTranscript} from './speech-transcript.ts';
export async function transcribeOriginal(asset:OriginalAsset,language:string,signal:AbortSignal,transcribe:(samples:Float32Array,language:string)=>Promise<unknown>){
 const check=()=>{if(signal.aborted)throw Error('Stopped');};check();
 const audio=new AudioContext();let decoded:AudioBuffer;try{decoded=await audio.decodeAudioData(readOriginal(asset).slice().buffer);}finally{await audio.close();}check();
 if(decoded.duration<=0||decoded.duration>120)throw Error('Audio too long · maximum 2 minutes');
 const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000),node=offline.createBufferSource();node.buffer=decoded;node.connect(offline.destination);node.start();const mono=await offline.startRendering();check();
 const result=await transcribe(mono.getChannelData(0),language);check();return makeTranscript(asset,Math.ceil(decoded.duration*1000),result,language);
}
