export class SpeechClient {
 private worker:any=null;private sequence=0;private pending:{type:string;resolve:(v:any)=>void;reject:(e:Error)=>void}|null=null;
 private factory:()=>any;private update:(busy:boolean,progress?:string)=>void;
 constructor(factory:()=>any,update:(busy:boolean,progress?:string)=>void){this.factory=factory;this.update=update;}
 call(type:string,values:any={}):Promise<any>{
  if(this.pending)return Promise.reject(Error('Speech model busy'));
  if(!this.worker){const w=this.factory();this.worker=w;
   w.onmessage=({data}:any)=>{if(this.worker!==w||data.id!==this.sequence)return;if(data.progress){this.update(this.pending?.type!=='status',data.progress);return;}const p=this.pending;this.pending=null;this.update(false,data.error);if(data.error)p?.reject(Error(data.error));else p?.resolve(data.value);};
   w.onerror=()=>{if(this.worker!==w)return;this.worker=null;w.terminate();const p=this.pending;this.pending=null;this.update(false,'Speech runtime failed');p?.reject(Error('Speech runtime failed'));};
  }
  this.update(type!=='status');return new Promise((resolve,reject)=>{this.pending={type,resolve,reject};this.worker.postMessage({id:++this.sequence,type,...values});});
 }
 stop(){this.sequence++;this.worker?.terminate();this.worker=null;const p=this.pending;this.pending=null;this.update(false,'Stopped');p?.reject(Error('Stopped'));}
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
