import {ReaderOperationClient} from './reader-operation-client.ts';
import type {InferenceLease} from './inference-lease.ts';
export class SpeechClient extends ReaderOperationClient {
 constructor(factory:()=>any,update:(busy:boolean,progress?:string)=>void,before?:(check:()=>void)=>Promise<void>,acquire?:()=>Promise<InferenceLease>){super('Speech','transcribe',factory,update,before,acquire);}
}
export class MicrophoneGate {
 private epoch=0;pending=false;
 cancel(){this.epoch++;this.pending=false;}
 async acquire(request:()=>Promise<MediaStream>):Promise<MediaStream|undefined>{
  if(this.pending)return;this.pending=true;const epoch=++this.epoch;
  try{const stream=await request();if(epoch!==this.epoch){stream.getTracks().forEach(t=>t.stop());return;}return stream;}
  catch(e){if(epoch===this.epoch)throw e;return;}
  finally{if(epoch===this.epoch)this.pending=false;}
 }
}
export async function saveReviewedTranscript<T>(lock:()=>boolean,unlock:()=>void,commit:()=>Promise<T>,refresh:()=>Promise<void>):Promise<{note:T;refreshError?:string}|undefined>{
 if(!lock())return;try{const note=await commit();try{await refresh();return {note};}catch(e){return {note,refreshError:(e as Error).message};}}finally{unlock();}
}
