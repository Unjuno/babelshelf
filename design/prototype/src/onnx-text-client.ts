import {PlannerOutputError} from './planner-error.ts';
// A dedicated client for hard-stoppable WASM inference. No automatic replay after Stop.
export function createOnnxTextClient(worker:Worker){
 let seq=0,loaded:string|null=null,fault:Error|null=null;
 const pending=new Map<number,{resolve:(value:any)=>void;reject:(reason:Error)=>void;events?:any}>();
 function fail(error:Error){fault=error;loaded=null;for(const item of pending.values())item.reject(error);pending.clear();}
 worker.onmessage=({data})=>{const item=pending.get(data.id);if(!item)return;if(data.type==='done'||data.type==='error'){pending.delete(data.id);if(data.type==='done')item.resolve(data.value);else{const d=data.diagnostic;if(d&&typeof d.raw==='string'&&d.raw.length<=8192&&typeof d.reason==='string'&&d.reason.length<=100&&typeof d.truncated==='boolean'){const error=new PlannerOutputError(String(data.value),d.raw,d.reason);error.diagnostic.truncated=d.truncated;item.reject(error);}else item.reject(Error(data.value));}}else item.events?.(data.type,data.value);};
 worker.onerror=()=>{fail(Error('Text worker stopped'));worker.terminate();};
 const call=(cmd:string,args:any={},events?:any):Promise<any>=>{
  if(fault)return Promise.reject(fault);
  return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject,events});try{worker.postMessage({id,cmd,args});}catch(error){pending.delete(id);reject(error);}});
 };
 return {manifest:{},worker,get failed(){return !!fault;},get loaded(){return loaded;},init:()=>call('init'),call,
 async load(id:string,events?:any){loaded=null;await call('load',{model:id},events);if(fault)throw fault;loaded=id;},
 async unload(){await call('unload');loaded=null;},abort(){fail(Error('Stopped'));worker.terminate();}};
}
