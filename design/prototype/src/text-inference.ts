import type {StructuredFormat} from './structured-grammar.ts';
// Local inference only. This port has no preparation, network, knowledge or write API.
export type GenerationFormat=StructuredFormat|'prose';
export type RuntimeGenerationMetrics={countMs?:number;visibleTextTtftMs?:number;generationMs?:number;outputTokens?:number;generationTokensPerSecond?:number;runtimeTtftMs?:number;runtimePrefillMs?:number;runtimeDecodeMs?:number;runtimeDecodeTokensPerSecond?:number;runtimePromptTokens?:number;runtimeCachedTokens?:number;requestedThreads?:number;runtimeThreads?:number;decodePipelineDepth?:number;memoryBefore?:Record<string,number>;memoryAfter?:Record<string,number>};
export type GenerationResult={text:string;stopped?:boolean;finishReason?:string;outputTokens?:number;metrics?:RuntimeGenerationMetrics};
export type TextEngine={pin?:()=>TextEngine;manifest:{contextTokens:number};count:(messages:any[],format?:GenerationFormat)=>Promise<{prompt_tokens:number}>;generate:(messages:any[],maxTokens?:number,format?:GenerationFormat)=>Promise<GenerationResult>};
export type TextRuntime=Omit<TextEngine,'pin'>&{pin?:()=>TextRuntime;manifest:TextEngine['manifest']&{models:{id:string;revision:string}[];runtime:{revision:string}};readonly loaded:string;readonly assets:Record<string,{filesPresent?:boolean}>;load:(model:string)=>Promise<void>;stop:()=>void};
const MAX_COUNT_MEMO_ENTRIES=8,MAX_COUNT_MEMO_CHARS=262144;
const metricNames=['countMs','visibleTextTtftMs','generationMs','outputTokens','generationTokensPerSecond','runtimeTtftMs','runtimePrefillMs','runtimeDecodeMs','runtimeDecodeTokensPerSecond','decodePipelineDepth'] as const;
function safeMetricMap(value:unknown):Record<string,number>|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
 const result:Record<string,number>={};
 for(const [key,number] of Object.entries(value).slice(0,16))if(/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(key)&&typeof number==='number'&&Number.isFinite(number)&&number>=0&&number<=Number.MAX_SAFE_INTEGER)result[key]=number;
 return Object.keys(result).length?result:undefined;
}
export function safeRuntimeMetrics(value:unknown):RuntimeGenerationMetrics|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
 const source=value as Record<string,unknown>,result:RuntimeGenerationMetrics={};
 for(const key of metricNames){const number=source[key];if(typeof number==='number'&&Number.isFinite(number)&&number>=0&&number<=Number.MAX_SAFE_INTEGER)(result as Record<string,unknown>)[key]=number;}
 for(const key of ['runtimePromptTokens','runtimeCachedTokens','requestedThreads','runtimeThreads'] as const){const number=source[key],thread=key==='requestedThreads'||key==='runtimeThreads';if(typeof number==='number'&&Number.isSafeInteger(number)&&number>=(thread?1:0)&&number<=(thread?64:Number.MAX_SAFE_INTEGER))result[key]=number;}
 const memoryBefore=safeMetricMap(source.memoryBefore),memoryAfter=safeMetricMap(source.memoryAfter);
 if(memoryBefore)result.memoryBefore=memoryBefore;if(memoryAfter)result.memoryAfter=memoryAfter;
 return Object.keys(result).length?result:undefined;
}
export function createTextInference(read:()=>TextRuntime):TextRuntime{
 let epoch=0;let countMemo:{identity:string;epoch:number;key:string;tokens:number}[]=[];
 // Full execution identity invalidates in-flight work and the exact-count memo.
 function identity(p:TextRuntime){return JSON.stringify([p.loaded,p.manifest.models.find(model=>model.id===p.loaded),p.manifest.runtime,p.manifest.contextTokens]);}
 function snapshot(){const p=read();if(!p.loaded)throw Error('Model not loaded');return {p,identity:identity(p),epoch};}
 function check(s:ReturnType<typeof snapshot>){if(s.epoch!==epoch)throw Error('Stopped');if(identity(read())!==s.identity)throw Error('Model changed · retry');}
 // A small bounded LRU, never persisted. Exact count and generation inputs survive
 // intervening compaction/context counts without retaining an unbounded prompt cache.
 async function countSnapshot(s:ReturnType<typeof snapshot>,messages:any[],format?:GenerationFormat){
  check(s);const key=JSON.stringify([messages,format??null]);
  const memoIndex=countMemo.findIndex(item=>item.identity===s.identity&&item.epoch===s.epoch&&item.key===key);
  if(memoIndex>=0){const [memo]=countMemo.splice(memoIndex,1);countMemo.push(memo);return {prompt_tokens:memo.tokens};}
  const result=await s.p.count(messages,format);check(s);
  if(!result||!Number.isSafeInteger(result.prompt_tokens)||result.prompt_tokens<0)throw Error('Invalid token count');
  if(key.length<=MAX_COUNT_MEMO_CHARS){countMemo.push({identity:s.identity,epoch:s.epoch,key,tokens:result.prompt_tokens});while(countMemo.length>MAX_COUNT_MEMO_ENTRIES||countMemo.reduce((size,item)=>size+item.key.length,0)>MAX_COUNT_MEMO_CHARS)countMemo.shift();}
  return {prompt_tokens:result.prompt_tokens};
 }
 function pin():TextRuntime{
  const s=snapshot(),manifest=structuredClone(s.p.manifest);
  const bound:TextRuntime={
   manifest,loaded:s.p.loaded,get assets(){return read().assets;},pin:()=>bound,
   async load(){throw Error('Pinned inference cannot load a model');},stop:()=>api.stop(),
   async count(messages,format){check(s);const result=await api.count(messages,format);check(s);return result;},
   async generate(messages,maxTokens,format){check(s);const result=await api.generate(messages,maxTokens,format);check(s);return result;},
  };return bound;
 }
 const api:TextRuntime={
  pin,
  get manifest(){return read().manifest;},get loaded(){return read().loaded;},get assets(){return read().assets;},
  async load(model){const p=read();if(!p.assets[model]?.filesPresent)throw Error('Model not prepared · Settings');epoch++;countMemo=[];await p.load(model);},
  stop(){epoch++;countMemo=[];read().stop();},
  async count(messages,format){return countSnapshot(snapshot(),structuredClone(messages),format);},
  async generate(messages,maxTokens=256,format){
   if(!Number.isSafeInteger(maxTokens)||maxTokens<1)throw Error('Invalid output budget');
   const s=snapshot(),input=structuredClone(messages),context=s.p.manifest.contextTokens;
   if(!Number.isSafeInteger(context)||context<1)throw Error('Invalid context limit');
   const count=await countSnapshot(s,input,format);check(s);
   if(count.prompt_tokens+maxTokens>context)throw Error('Input exceeds context limit');
   const result=await s.p.generate(input,maxTokens,format);check(s);
   if(result?.stopped)throw Error('Stopped');if(!result||typeof result.text!=='string')throw Error('Invalid generation result');
   const finishReason=result.finishReason;
   const outputTokens=result.outputTokens;
   if(finishReason!==undefined&&typeof finishReason!=='string')throw Error('Invalid generation result');
   if(outputTokens!==undefined&&(!Number.isSafeInteger(outputTokens)||outputTokens<0))throw Error('Invalid generation result');
   const metrics=safeRuntimeMetrics(result.metrics);
   return {text:result.text,...(finishReason?{finishReason}:{}),...(outputTokens!==undefined?{outputTokens}:{}),...(metrics?{metrics}:{})};
  },
 };return api;
}
