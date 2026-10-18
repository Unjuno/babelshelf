export class Engine{
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
   if(m.type==='done'||m.type==='error'){this.pending.delete(m.id);m.type==='done'?p.resolve(m.value):p.reject(Error(m.value));}else p.events?.(m.type,m.value);
  };
  this.worker.onerror=(event)=>{this.loaded=null;this.resourceEpoch++;this.workerFault=Error('Model worker stopped');this.lastResourceError=this.workerFault;console.error(event.message??'Model worker stopped');for(const p of this.pending.values())p.reject(this.workerFault);this.pending.clear();};
 }
 call(cmd,args={},events){if(this.workerFault)return Promise.reject(this.workerFault);return new Promise((resolve,reject)=>{const id=++this.seq;this.pending.set(id,{cmd,resolve,reject,events});this.worker.postMessage({id,cmd,args});});}
 async init(){return this.call('init',{manifest:this.manifest});}
 async load(model,events){const epoch=this.resourceEpoch;this.loaded=null;const r=await this.call('load',{model},events);if(this.workerFault)throw this.workerFault;if(epoch!==this.resourceEpoch)throw this.lastResourceError??Error('GPU disconnected');this.loaded=model;return r;}
 abort(){this.cancelRequested=true;this.worker.postMessage({cmd:'abort'});}
 async unload(){await this.call('unload');this.loaded=null;}
 generate(messages,events,maxTokens=256){return this.call('generate',{messages,maxTokens},events);}
}
