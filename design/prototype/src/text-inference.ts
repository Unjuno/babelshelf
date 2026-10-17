import type {StructuredFormat} from './structured-grammar.ts';
// Local inference only. This port has no preparation, network, knowledge or write API.
export type TextEngine={pin?:()=>TextEngine;manifest:{contextTokens:number};count:(messages:any[])=>Promise<{prompt_tokens:number}>;generate:(messages:any[],maxTokens?:number,format?:StructuredFormat)=>Promise<{text:string;stopped?:boolean}>};
export type TextRuntime=Omit<TextEngine,'pin'>&{pin?:()=>TextRuntime;manifest:TextEngine['manifest']&{models:{id:string;revision:string}[];runtime:{revision:string}};readonly loaded:string;readonly assets:Record<string,{filesPresent?:boolean}>;load:(model:string)=>Promise<void>;stop:()=>void};
export function createTextInference(read:()=>TextRuntime):TextRuntime{
 let epoch=0;
 function identity(p:TextRuntime){return JSON.stringify([p.loaded,p.manifest.models.find(model=>model.id===p.loaded)?.revision,p.manifest.runtime.revision,p.manifest.contextTokens]);}
 function snapshot(){const p=read();if(!p.loaded)throw Error('Model not loaded');return {p,identity:identity(p),epoch};}
 function check(s:ReturnType<typeof snapshot>){if(s.epoch!==epoch)throw Error('Stopped');if(identity(read())!==s.identity)throw Error('Model changed · retry');}
 function pin():TextRuntime{
  const s=snapshot(),manifest=structuredClone(s.p.manifest);
  const bound:TextRuntime={
   manifest,loaded:s.p.loaded,get assets(){return read().assets;},pin:()=>bound,
   async load(){throw Error('Pinned inference cannot load a model');},stop:()=>api.stop(),
   async count(messages){check(s);const result=await api.count(messages);check(s);return result;},
   async generate(messages,maxTokens,format){check(s);const result=await api.generate(messages,maxTokens,format);check(s);return result;},
  };return bound;
 }
 const api:TextRuntime={
  pin,
  get manifest(){return read().manifest;},get loaded(){return read().loaded;},get assets(){return read().assets;},
  async load(model){const p=read();if(!p.assets[model]?.filesPresent)throw Error('Model not prepared · Settings');epoch++;await p.load(model);},
  stop(){epoch++;read().stop();},
  async count(messages){const s=snapshot(),result=await s.p.count(messages);check(s);if(!result||!Number.isSafeInteger(result.prompt_tokens)||result.prompt_tokens<0)throw Error('Invalid token count');return {prompt_tokens:result.prompt_tokens};},
  async generate(messages,maxTokens=256,format){if(!Number.isSafeInteger(maxTokens)||maxTokens<1)throw Error('Invalid output budget');const s=snapshot(),result=await s.p.generate(messages,maxTokens,format);check(s);if(result?.stopped)throw Error('Stopped');if(!result||typeof result.text!=='string')throw Error('Invalid generation result');return {text:result.text};},
 };return api;
}
