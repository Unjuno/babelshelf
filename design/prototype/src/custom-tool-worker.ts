import {newAsyncRuntime,type QuickJSAsyncRuntime,type QuickJSAsyncContext,type QuickJSHandle} from 'quickjs-emscripten';
import {isCustomToolCapability} from './custom-tool-types.ts';

type Capability='memory.search'|'memory.list'|'memory.read'|'math.calculate'|'math.calculate.decimal'|'time.now';
type Incoming={type:'run';code:string;input:unknown;capabilities:Capability[];timeoutMs:number;memoryLimitBytes:number}|{type:'capability-result';requestId:number;value:unknown}|{type:'capability-error';requestId:number;message:string};
type Pending={resolve:(value:unknown)=>void;reject:(error:Error)=>void};
const workerScope=globalThis as typeof globalThis&{onmessage:((event:MessageEvent<Incoming>)=>void)|null;postMessage:(message:unknown)=>void};
let active=false,nextRequest=0,context:QuickJSAsyncContext|undefined,capabilityWaitDepth=0,capabilityWaitStarted=0,activeDeadline:{value:number}|undefined;
const pending=new Map<number,Pending>();
const encoder=new TextEncoder();

function checkedJson(value:unknown,limit:number,label:string):string{
 let serialized:string;try{serialized=JSON.stringify(value);}catch{throw Error(`${label} is not JSON data`);}
 if(typeof serialized!=='string'||encoder.encode(serialized).byteLength>limit)throw Error(`${label} exceeds its size limit`);
 return serialized;
}
function hostCapability(name:Capability,enabled:boolean):QuickJSHandle|undefined{
 if(!enabled||!context)return undefined;
 return context.newAsyncifiedFunction(name,async queryHandle=>{
  const query=context!.dump(queryHandle);
  if(typeof query!=='string'||!query.trim()||query.length>(name.startsWith('math.calculate')?200:2000))throw Error('Invalid capability input');
  if(capabilityWaitDepth++===0)capabilityWaitStarted=Date.now();
  const requestId=nextRequest++;
  workerScope.postMessage({type:'capability',requestId,capability:name,query});
  try{
   const value=await new Promise<unknown>((resolve,reject)=>pending.set(requestId,{resolve,reject}));
   return context!.newString(checkedJson(value,24_000,'Memory capability result'));
  }finally{
   if(--capabilityWaitDepth===0&&activeDeadline&&Number.isFinite(activeDeadline.value))activeDeadline.value+=Date.now()-capabilityWaitStarted;
  }
 });
}
async function run(message:Extract<Incoming,{type:'run'}>){
 if(active){workerScope.postMessage({type:'error',message:'Custom tool worker is already running'});return;}
 active=true;
 const deadline={value:Number.POSITIVE_INFINITY};
 activeDeadline=deadline;
 let runtime:QuickJSAsyncRuntime|undefined;
 let executing=false;
 try{
  runtime=await newAsyncRuntime({memoryLimitBytes:message.memoryLimitBytes,maxStackSizeBytes:256*1024,interruptHandler:()=>Date.now()>=deadline.value});
  deadline.value=Date.now()+message.timeoutMs;
  context=runtime.newContext({intrinsics:{BaseObjects:true,Date:false,Eval:true,StringNormalize:true,RegExp:true,RegExpCompiler:true,JSON:true,Proxy:true,MapSet:true,TypedArrays:true,Promise:true}});
  const capabilityObject=context.newObject();
  const search=hostCapability('memory.search',message.capabilities.includes('memory.search'));if(search){context.setProp(capabilityObject,'memorySearch',search);search.dispose();}
  const list=hostCapability('memory.list',message.capabilities.includes('memory.list'));if(list){context.setProp(capabilityObject,'memoryList',list);list.dispose();}
  const read=hostCapability('memory.read',message.capabilities.includes('memory.read'));if(read){context.setProp(capabilityObject,'memoryRead',read);read.dispose();}
  const calculate=hostCapability('math.calculate',message.capabilities.includes('math.calculate'));if(calculate){context.setProp(capabilityObject,'mathCalculate',calculate);calculate.dispose();}
  const calculateDecimal=hostCapability('math.calculate.decimal',message.capabilities.includes('math.calculate'));if(calculateDecimal){context.setProp(capabilityObject,'mathCalculateDecimal',calculateDecimal);calculateDecimal.dispose();}
  const now=hostCapability('time.now',message.capabilities.includes('time.now'));if(now){context.setProp(capabilityObject,'timeNow',now);now.dispose();}
  const inputResult=context.evalCode(`JSON.parse(${JSON.stringify(checkedJson(message.input,8_000,'Custom tool input'))})`);
  if(inputResult.error){const detail=String(context.dump(inputResult.error)?.message??'Invalid custom tool input');inputResult.error.dispose();throw Error(detail);}
  context.setProp(context.global,'__babelshelfInput',inputResult.value);inputResult.value.dispose();
  context.setProp(context.global,'__babelshelfCapabilities',capabilityObject);capabilityObject.dispose();
  const source=`(()=>{ const tool=(${message.code}); if(typeof tool!=="function") throw new TypeError("Tool entry must be a function"); const caps=Object.create(null); ${message.capabilities.includes('memory.search')?'caps.memorySearch=q=>JSON.parse(__babelshelfCapabilities.memorySearch(q));':''} ${message.capabilities.includes('memory.list')?'caps.memoryList=(path="",offset=0,limit=25)=>JSON.parse(__babelshelfCapabilities.memoryList(JSON.stringify({path,offset,limit})));':''} ${message.capabilities.includes('memory.read')?'caps.memoryRead=q=>JSON.parse(__babelshelfCapabilities.memoryRead(q));':''} ${message.capabilities.includes('math.calculate')?'caps.calculate=q=>JSON.parse(__babelshelfCapabilities.mathCalculate(q)); caps.calculateDecimal=q=>JSON.parse(__babelshelfCapabilities.mathCalculateDecimal(q));':''} ${message.capabilities.includes('time.now')?'caps.timeNow=()=>JSON.parse(__babelshelfCapabilities.timeNow("now"));':''} const value=tool({input:__babelshelfInput,capabilities:caps}); if(value&&typeof value.then==="function") throw new TypeError("Tool entry must be synchronous"); return JSON.stringify(value); })()`;
  executing=true;
  workerScope.postMessage({type:'running'});
  const evaluated=await context.evalCodeAsync(source,'custom-tool.js');
  if(evaluated.error){const detail=String(context.dump(evaluated.error)?.message??'Custom tool failed');evaluated.error.dispose();throw Error(detail);}
  const output=evaluated.value;let json:unknown;try{json=context.dump(output);}finally{output.dispose();}
  if(typeof json!=='string')throw Error('Custom tool must return a JSON value');
  workerScope.postMessage({type:'result',value:JSON.parse(checkedJson(JSON.parse(json),8_000,'Custom tool result'))});
 }catch(error){const messageText=String((error as Error)?.message??error);workerScope.postMessage({type:'error',message:!executing?'Custom tool runtime could not start':/interrupted/i.test(messageText)||Date.now()>=deadline.value?'Custom tool time limit exceeded':/out of memory|memory limit/i.test(messageText)?'Custom tool memory limit exceeded':messageText.slice(0,240)});}
 finally{
  // Release async host functions while their runtime callback registry still
  // exists. Leaving them on the global object until runtime disposal can make
  // QuickJS free a HostRef after the registry has already been removed.
  if(context){try{const cleanup=context.evalCode('delete globalThis.__babelshelfCapabilities; delete globalThis.__babelshelfInput');if(cleanup.error)cleanup.error.dispose();else cleanup.value.dispose();}catch{/* The disposable worker remains the final isolation boundary. */}}
  context?.dispose();context=undefined;runtime?.dispose();pending.clear();capabilityWaitDepth=0;capabilityWaitStarted=0;activeDeadline=undefined;active=false;
 }
}

workerScope.onmessage=event=>{
 const message=event.data;
 if(!message||typeof message!=='object')return;
 if(message.type==='run'){
  if(typeof message.code!=='string'||message.code.length>32_000||!Number.isSafeInteger(message.timeoutMs)||message.timeoutMs<10||message.timeoutMs>1000||!Number.isSafeInteger(message.memoryLimitBytes)||message.memoryLimitBytes<1024*1024||message.memoryLimitBytes>32*1024*1024||!Array.isArray(message.capabilities)||!message.capabilities.every(isCustomToolCapability)){workerScope.postMessage({type:'error',message:'Invalid custom tool run request'});return;}
  void run(message as Extract<Incoming,{type:'run'}>);
 }else if(message.type==='capability-result'||message.type==='capability-error'){
  const request=pending.get(message.requestId);if(!request)return;pending.delete(message.requestId);
  if(message.type==='capability-result')request.resolve(message.value);else request.reject(Error(String(message.message).slice(0,200)));
 }
};
