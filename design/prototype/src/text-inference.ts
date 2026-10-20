import type {StructuredFormat} from './structured-grammar.ts';
// Local inference only. This port has no preparation, network, knowledge or write API.
export type GenerationFormat=StructuredFormat|'prose';
export type GenerationResult={text:string;stopped?:boolean;finishReason?:string;outputTokens?:number};
export type TextEngine={pin?:()=>TextEngine;manifest:{contextTokens:number};count:(messages:any[],format?:GenerationFormat)=>Promise<{prompt_tokens:number}>;generate:(messages:any[],maxTokens?:number,format?:GenerationFormat)=>Promise<GenerationResult>};
export type TextRuntime=Omit<TextEngine,'pin'>&{pin?:()=>TextRuntime;manifest:TextEngine['manifest']&{models:{id:string;revision:string}[];runtime:{revision:string}};readonly loaded:string;readonly assets:Record<string,{filesPresent?:boolean}>;load:(model:string)=>Promise<void>;stop:()=>void};
export function createTextInference(read:()=>TextRuntime):TextRuntime{
 let epoch=0;let countMemo:{identity:string;epoch:number;key:string;tokens:number}|null=null;
 function identity(p:TextRuntime){return JSON.stringify([p.loaded,p.manifest.models.find(model=>model.id===p.loaded)?.revision,p.manifest.runtime.revision,p.manifest.contextTokens]);}
 function snapshot(){const p=read();if(!p.loaded)throw Error('Model not loaded');return {p,identity:identity(p),epoch};}
 function check(s:ReturnType<typeof snapshot>){if(s.epoch!==epoch)throw Error('Stopped');if(identity(read())!==s.identity)throw Error('Model changed · retry');}
 // One bounded memo, never persisted. Count and generation share exact cloned messages.
 async function countSnapshot(s:ReturnType<typeof snapshot>,messages:any[],format?:GenerationFormat){
  check(s);const key=JSON.stringify([messages,format??null]);
  if(countMemo?.identity===s.identity&&countMemo.epoch===s.epoch&&countMemo.key===key)return {prompt_tokens:countMemo.tokens};
  const result=await s.p.count(messages,format);check(s);
  if(!result||!Number.isSafeInteger(result.prompt_tokens)||result.prompt_tokens<0)throw Error('Invalid token count');
  if(key.length<=262144)countMemo={identity:s.identity,epoch:s.epoch,key,tokens:result.prompt_tokens};else countMemo=null;
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
  async load(model){const p=read();if(!p.assets[model]?.filesPresent)throw Error('Model not prepared · Settings');epoch++;countMemo=null;await p.load(model);},
  stop(){epoch++;countMemo=null;read().stop();},
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
   return {text:result.text,...(finishReason?{finishReason}:{}),...(outputTokens!==undefined?{outputTokens}:{})};
  },
 };return api;
}
