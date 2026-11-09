type WorkerLike={postMessage:(value:unknown)=>void;terminate:()=>void;onmessage:((event:MessageEvent)=>void)|null;onerror:((event:ErrorEvent)=>void)|null;onmessageerror:((event:MessageEvent)=>void)|null};

/** Dedicated Worker RPC. Termination is the hard Stop boundary for WASM/model setup. */
export function createSemanticEmbeddingClient(worker:WorkerLike,{loadTimeoutMs=300000}:{loadTimeoutMs?:number}={}){
 if(!Number.isSafeInteger(loadTimeoutMs)||loadTimeoutMs<1000||loadTimeoutMs>900000)throw Error('Invalid embedding load timeout');
 let sequence=0,stopped=false,loaded=false;
 const pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;progress?:(value:string)=>void}>();
 const fail=(reason:Error)=>{stopped=true;loaded=false;for(const request of pending.values())request.reject(reason);pending.clear();};
 worker.onmessage=event=>{
  const data=event.data,request=pending.get(data?.id);if(!request)return;
  if(data.type==='progress'){if(typeof data.value==='string'&&data.value.length<=200)request.progress?.(data.value);return;}
  pending.delete(data.id);
  if(data.type==='done')request.resolve(data.value);
  else if(data.type==='error')request.reject(Error(typeof data.value==='string'?data.value:'Embedding operation failed'));
  else request.reject(Error('Invalid embedding worker response'));
 };
 worker.onerror=worker.onmessageerror=()=>fail(Error('Embedding worker stopped'));
 const call=(cmd:string,args:Record<string,unknown>={},progress?:(value:string)=>void)=>{
  if(stopped)return Promise.reject(Error('Embedding worker stopped'));
  return new Promise<any>((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject,progress});try{worker.postMessage({id,cmd,args});}catch(error){pending.delete(id);reject(error);}});
 };
 return {
  get loaded(){return loaded;},
  get failed(){return stopped;},
  status:()=>call('status'),
  verify:()=>call('verify'),
  prepare:(allowNetwork:boolean,localFiles:File[]=[],progress?:(value:string)=>void)=>call('prepare',{allowNetwork:allowNetwork===true,localFiles},progress),
  async load(progress?:(value:string)=>void){
   let timer:ReturnType<typeof setTimeout>|undefined;
   const timeout=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{const error=Error('Embedding model load timed out · retry');fail(error);try{worker.terminate();}catch{}reject(error);},loadTimeoutMs);});
   try{await Promise.race([call('load',{},progress),timeout]);loaded=true;}
   finally{if(timer)clearTimeout(timer);}
  },
  async embed(texts:readonly string[]){if(!loaded)throw Error('Embedding model not loaded');if(!Array.isArray(texts)||texts.length<1||texts.length>8||texts.some(text=>typeof text!=='string'||!text.trim()||text.length>8000))throw Error('Embedding batch must contain 1–8 short texts');return call('embed',{texts:[...texts]});},
  async unload(){if(loaded)await call('unload');loaded=false;},
  abort(){if(stopped)return;fail(Error('Stopped'));try{worker.terminate();}finally{stopped=true;}},
  worker:{terminate(){if(!stopped){fail(Error('Stopped'));worker.terminate();}}},
 };
}
