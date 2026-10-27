export class Engine{
 get failed(){return !!this.workerFault;}
 constructor(manifest,onState=()=>{},worker=null){
  this.manifest=manifest;this.onState=onState;this.seq=0;this.pending=new Map();this.resourceEpoch=0;
  this.worker=worker??new Worker(new URL('./model-worker.js',import.meta.url),{type:'module'});
  this.worker.onmessage=({data:m})=>{
   if(m.type==='lost'){
    this.loaded=null;this.resourceEpoch++;const error=Error('GPU disconnected: '+m.value);this.lastResourceError=error;
    // Asset inspection/preparation is independent of the lost inference session.
    for(const [id,p] of this.pending)if(['load','generate','count'].includes(p.cmd)){this.pending.delete(id);p.reject(error);}
    this.onState(error.message);return;
   }
   const p=this.pending.get(m.id);if(!p)return;
   if(m.type==='done'||m.type==='error'){this.pending.delete(m.id);if(m.type==='done')p.resolve(m.value);else{const error=Error(m.value),d=m.diagnostic;if(d&&typeof d.raw==='string'&&typeof d.reason==='string'){error.diagnostic={raw:d.raw.slice(0,8192),reason:d.reason.slice(0,128),truncated:d.truncated===true||d.raw.length>8192};}p.reject(error);}}else p.events?.(m.type,m.value);
  };
  this.worker.onerror=(event)=>{this.loaded=null;this.resourceEpoch++;this.workerFault=Error('Model worker stopped');this.lastResourceError=this.workerFault;console.error(event.message??'Model worker stopped');for(const p of this.pending.values())p.reject(this.workerFault);this.pending.clear();this.onState(this.workerFault.message);};
 }
 call(cmd,args={},events){if(this.workerFault)return Promise.reject(this.workerFault);return new Promise((resolve,reject)=>{const id=++this.seq;this.pending.set(id,{cmd,resolve,reject,events});this.worker.postMessage({id,cmd,args});});}
 async init(){return this.call('init',{manifest:this.manifest});}
 async load(model,events){const epoch=this.resourceEpoch;this.loaded=null;const r=await this.call('load',{model},events);if(this.workerFault)throw this.workerFault;if(epoch!==this.resourceEpoch)throw this.lastResourceError??Error('GPU disconnected');this.loaded=model;return r;}
 abort(){
  this.cancelRequested=true;this.worker.postMessage({cmd:'abort'});
  // Only inference operations can be retired this way. Asset writes must finish
  // their own abort/cleanup instead of being interrupted halfway through.
  const active=[...this.pending].filter(([,p])=>['load','generate','count'].includes(p.cmd)).map(([id])=>id);
  if(!active.length||this.stopTimer)return;
  this.stopTimer=setTimeout(()=>{
   this.stopTimer=null;
   if(!active.some(id=>this.pending.has(id)))return;
   if([...this.pending.values()].some(p=>['prepare','verify'].includes(p.cmd)))return;
   const error=Error('Stopped');this.workerFault=error;this.lastResourceError=error;this.loaded=null;this.resourceEpoch++;
   this.worker.terminate();for(const p of this.pending.values())p.reject(error);this.pending.clear();this.onState(error.message);
  },2500);
 }
 async unload(){await this.call('unload');this.loaded=null;}
 generate(messages,events,maxTokens=256){return this.call('generate',{messages,maxTokens},events);}
}
