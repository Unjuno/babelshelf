import type {CustomToolCapability} from './custom-tool-types.ts';
import {AgentToolResultTooLargeError} from './agent-tool-errors.ts';
import {validateMemoryListArgs} from './tools/tool-host.ts';
import type {DecimalReceipt} from './tools/math.calculate/decimal-receipt.ts';
import {MAX_CONTEXT_SOURCE_REFS} from './agent-limits.ts';
export type {CustomToolCapability} from './custom-tool-types.ts';
export type CustomToolHost={search?:(query:string,signal:AbortSignal)=>Promise<unknown>;list?:(path:string,offset:number,limit:number,signal:AbortSignal)=>Promise<unknown>;read?:(query:string,signal:AbortSignal)=>Promise<unknown>;calculate?:(expression:string)=>number|Promise<number>;calculateDecimal?:(expression:string)=>DecimalReceipt|Promise<DecimalReceipt>};
export type CustomToolRunInput={code:string;input:unknown;capabilities:readonly CustomToolCapability[];host?:CustomToolHost;signal?:AbortSignal;timeoutMs?:number;memoryLimitBytes?:number;maxResultBytes?:number};
type WorkerReply={type:'result';value:unknown}|{type:'error';message:string}|{type:'running'}|{type:'capability';requestId:number;capability:CustomToolCapability|'math.calculate.decimal';query:string};
const maxSourceBytes=32_000,maxInputBytes=8_000,maxCapabilityResultBytes=24_000,maxResultBytes=8_000;
// Bound broker bookkeeping to the existing evidence capacity while allowing
// a single package to inspect more than eight records when the request needs it.
const maxCapabilityCalls=MAX_CONTEXT_SOURCE_REFS,maxConcurrentCapabilityCalls=2;
// Local IndexedDB operations can legitimately take longer than the small
// QuickJS CPU budget. Keep them cancellable, but give the whole run a separate
// bounded wall-clock allowance instead of charging database latency as code CPU.
const maxCapabilityWaitMs=10_000;
const textEncoder=new TextEncoder();

function encodeJson(value:unknown,maxBytes:number,label:string):string{
 let encoded:string;
 try{encoded=JSON.stringify(value);}catch{throw Error(`${label} is not JSON data`);}
 if(typeof encoded!=='string'||textEncoder.encode(encoded).byteLength>maxBytes)throw Error(`${label} exceeds its size limit`);
 return encoded;
}
function workerError(error:ErrorEvent|string):string{
 const message=typeof error==='string'?error:String(error.message||'');
 return safeWorkerFailure(message);
}
const safeWorkerFailures=new Set(['Custom tool runtime could not start','Custom tool worker is already running','Invalid custom tool run request','Custom tool time limit exceeded','Custom tool memory limit exceeded','Tool entry must be a function','Custom tool must return a JSON value','Custom tool result is not JSON data','Custom tool result exceeds its size limit']);
function safeWorkerFailure(message:unknown):string{
 const value=typeof message==='string'?message:'';
 // User code and host capability errors can contain note excerpts or prompt data.
 // Only fixed runtime outcomes cross into durable activity receipts and logs.
 return safeWorkerFailures.has(value)?value:'Custom tool failed · inspect package source and selected capabilities';
}

/** User code runs in a disposable Web Worker and QuickJS WASM VM, never the application realm. */
export function runCustomToolSource(options:CustomToolRunInput):Promise<unknown>{
 const code=options.code;
 if(typeof code!=='string'||!code.trim()||textEncoder.encode(code).byteLength>maxSourceBytes)throw Error('Custom tool source too large or empty');
 const timeoutMs=options.timeoutMs??750,memoryLimitBytes=options.memoryLimitBytes??8*1024*1024,resultBytes=options.maxResultBytes??maxResultBytes;
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<10||timeoutMs>1000||!Number.isSafeInteger(memoryLimitBytes)||memoryLimitBytes<1024*1024||memoryLimitBytes>32*1024*1024||!Number.isSafeInteger(resultBytes)||resultBytes<64||resultBytes>maxResultBytes)throw Error('Invalid custom tool runtime limits');
 if(!Array.isArray(options.capabilities)||new Set(options.capabilities).size!==options.capabilities.length||options.capabilities.some(value=>value!=='memory.search'&&value!=='memory.list'&&value!=='memory.read'&&value!=='math.calculate'))throw Error('Invalid custom tool capabilities');
 if(options.signal?.aborted)return Promise.reject(Error('Stopped'));
 const inputJson=encodeJson(options.input,maxInputBytes,'Custom tool input');
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./custom-tool-worker.ts',import.meta.url),{type:'module',name:'BabelShelf custom tool'});
  const capabilityAbort=new AbortController(),stopFromCaller=()=>finish(Error('Stopped'));
  let settled=false,executing=false,inFlightCapabilities=0,capabilityWaitConsumed=0,capabilityWaitStarted=0;
  const requests=new Map<number,Promise<void>>();
  const finish=(error?:Error,value?:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);options.signal?.removeEventListener('abort',stopFromCaller);if(!capabilityAbort.signal.aborted)capabilityAbort.abort();worker.terminate();if(error)reject(error);else resolve(value);};
  // Bound cold WASM startup separately, then begin the strict wall clock only
  // after the disposable interpreter signals that user code is about to run.
  let timer=setTimeout(()=>finish(Error('Custom tool runtime startup timed out')),10_000);
  options.signal?.addEventListener('abort',stopFromCaller,{once:true});
  if(options.signal?.aborted){stopFromCaller();return;}
  worker.onerror=event=>{event.preventDefault();finish(Error(executing?workerError(event):'Custom tool runtime could not start'));};
  worker.onmessage=event=>{
   const message=event.data as WorkerReply;
   if((message as any)?.type==='debug')return;
   if(!message||typeof message!=='object')return finish(Error('Invalid custom tool worker message'));
   if(message.type==='running'){executing=true;clearTimeout(timer);timer=setTimeout(()=>finish(Error('Custom tool time limit exceeded')),timeoutMs+200);return;}
   if(message.type==='error'){const messageText=safeWorkerFailure(message.message);return finish(messageText==='Custom tool result exceeds its size limit'?new AgentToolResultTooLargeError(messageText):Error(messageText));}
   if(message.type==='result'){
    try{const valueJson=encodeJson(message.value,resultBytes,'Custom tool result');finish(undefined,JSON.parse(valueJson));}catch(error){const message=error instanceof Error?error.message:'';finish(message==='Custom tool result exceeds its size limit'?new AgentToolResultTooLargeError(message):error instanceof Error?error:Error('Invalid custom tool result'));}
    return;
   }
   if(message.type==='capability'){
    const callback=message.capability==='memory.search'&&options.capabilities.includes(message.capability)?options.host?.search:message.capability==='memory.list'&&options.capabilities.includes(message.capability)?options.host?.list:message.capability==='memory.read'&&options.capabilities.includes(message.capability)?options.host?.read:message.capability==='math.calculate'&&options.capabilities.includes(message.capability)?options.host?.calculate:message.capability==='math.calculate.decimal'&&options.capabilities.includes('math.calculate')?options.host?.calculateDecimal:undefined;
    const maxQueryLength=message.capability==='math.calculate'||message.capability==='math.calculate.decimal'?200:2000;
    if(!callback||!Number.isSafeInteger(message.requestId)||message.requestId<0||typeof message.query!=='string'||message.query.length>maxQueryLength)return finish(Error('Custom tool capability is not available'));
    if(requests.has(message.requestId))return finish(Error('Duplicate custom tool capability request'));
    if(requests.size>=maxCapabilityCalls)return finish(Error('Custom tool capability call limit exceeded'));
    if(inFlightCapabilities>=maxConcurrentCapabilityCalls)return finish(Error('Custom tool concurrent capability limit exceeded'));
    if(inFlightCapabilities++===0){capabilityWaitStarted=Date.now();clearTimeout(timer);timer=setTimeout(()=>finish(Error('Custom tool time limit exceeded')),Math.max(0,maxCapabilityWaitMs-capabilityWaitConsumed)+200);}
    const operation=Promise.resolve().then(()=>{
     if(message.capability==='math.calculate'||message.capability==='math.calculate.decimal')return (callback as (expression:string)=>unknown)(message.query);
     if(message.capability==='memory.list'){
      let requested:unknown;try{requested=JSON.parse(message.query);}catch{throw Error('Invalid folder listing arguments');}
      const args=validateMemoryListArgs(requested);
      return (callback as (path:string,offset:number,limit:number,signal:AbortSignal)=>unknown)(args.path,args.offset,args.limit,capabilityAbort.signal);
     }
     return (callback as (query:string,signal:AbortSignal)=>unknown)(message.query,capabilityAbort.signal);
    }).then(value=>{
     if(settled)return;
     const json=encodeJson(value,maxCapabilityResultBytes,'Memory capability result');worker.postMessage({type:'capability-result',requestId:message.requestId,value:JSON.parse(json)});
    }).catch(()=>{if(!settled)worker.postMessage({type:'capability-error',requestId:message.requestId,message:message.capability==='math.calculate'||message.capability==='math.calculate.decimal'?'Calculation capability failed':'Memory capability failed'});}).finally(()=>{inFlightCapabilities--;if(inFlightCapabilities===0){capabilityWaitConsumed+=Date.now()-capabilityWaitStarted;clearTimeout(timer);if(!settled)timer=setTimeout(()=>finish(Error('Custom tool time limit exceeded')),timeoutMs+200);}});
    requests.set(message.requestId,operation);
   }
  };
  worker.postMessage({type:'run',code,input:JSON.parse(inputJson),capabilities:[...options.capabilities],timeoutMs,memoryLimitBytes});
 });
}
