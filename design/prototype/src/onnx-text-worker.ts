import {createStructuredTokenFilter} from './structured-decoding';
import {validateOnnxTextBudget} from './text-model-manifest';
/// <reference lib="webworker" />
import {AutoModelForCausalLM,AutoTokenizer,env,LogitsProcessor,LogitsProcessorList} from '@huggingface/transformers';
import wasmURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import mjsURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs?url';
import manifest from './onnx-text-manifest.json';
import {createPinnedAssetStore} from './pinned-text-assets';
const networkFetch=globalThis.fetch.bind(globalThis);
const runtimeURLs=new Set([wasmURL,mjsURL].map(url=>new URL(url,location.href).href));
globalThis.fetch=(input,options)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href).href;
 return runtimeURLs.has(url)?networkFetch(input,options):Promise.reject(Error('Network disabled for text inference'));
};
const store=createPinnedAssetStore(manifest,{directory:async()=>await(await navigator.storage.getDirectory()).getDirectoryHandle('babelshelf-text-onnx-v1',{create:true}),fetch:networkFetch});
const prefix='/text-model/'+manifest.id+'/';
let controller:AbortController|undefined,busy=false,model:any=null,tokenizer:any=null;
const check=()=>controller!.signal.throwIfAborted();
env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath='/text-model/';
env.useBrowserCache=false;env.useFSCache=false;env.useCustomCache=true;
env.customCache={
 async match(path:any){
  const requested=String(path);if(!requested.startsWith(prefix))return new Response('Unknown asset',{status:404});
  try{return new Response(await store.read(requested.slice(prefix.length),controller!.signal));}
  catch{check();return new Response('Asset unavailable',{status:404});}
 },
 async put(){throw Error('Use explicit text model preparation');}
};
env.backends.onnx.wasm!.wasmPaths={wasm:wasmURL,mjs:mjsURL};
env.backends.onnx.wasm!.numThreads=1;env.backends.onnx.wasm!.proxy=false;
function encode(messages:any[]){
 if(!tokenizer||!model)throw Error('Model not loaded');
 if(!Array.isArray(messages)||messages.length>256||messages.some(m=>!m||!['system','user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>1000000))throw Error('Invalid text messages');
 const input=tokenizer.apply_chat_template(messages,{add_generation_prompt:true,return_dict:true});
 return {input,tokens:Number(input.input_ids.dims.at(-1))};
}
async function unload(){const old=model;model=null;tokenizer=null;if(old)await old.dispose();}
self.onmessage=async({data})=>{
 if(data.cmd==='abort'){controller?.abort();return;}
 if(busy){self.postMessage({id:data.id,type:'error',value:'Model busy'});return;}
 busy=true;controller=new AbortController();const progress=(value:string)=>self.postMessage({id:data.id,type:'progress',value});
 let diagnostic:{raw:string;reason:string;truncated:boolean}|undefined;
 try{let value:any;const args=data.args??{};
  if(['init','status'].includes(data.cmd))value={[manifest.id]:{...await store.status(controller.signal),presenceOnly:true}};
  else if(data.cmd==='prepare'){
   if(args.model!==manifest.id)throw Error('Unknown model');
   await store.prepare(args.allowNetwork===true,controller.signal,(done,total)=>progress('Verifying '+Math.round(done/total*100)+'%'),args.localFiles??[]);value=true;
  }else if(data.cmd==='load'){
   if(args.model!==manifest.id)throw Error('Unknown model');
   if(!model){
    progress('Verifying text model');
    const config=JSON.parse(await(await store.read('config.json',controller.signal)).text());
    if(config.model_type!=='llama'||!config.architectures?.includes('LlamaForCausalLM'))throw Error('Text model config incompatible');
    progress('Loading · WASM');
    tokenizer=await AutoTokenizer.from_pretrained(manifest.id,{local_files_only:true,revision:manifest.revision});check();
    try{model=await AutoModelForCausalLM.from_pretrained(manifest.id,{local_files_only:true,revision:manifest.revision,device:'wasm',dtype:'q8'});check();}
    catch(error){await unload();throw error;}
   }value=true;
  }else if(data.cmd==='unload'){await unload();value=true;}
  else if(data.cmd==='count'){value={prompt_tokens:encode(args.messages).tokens};}
  else if(data.cmd==='generate'){
   const {input,tokens}=encode(args.messages),maxTokens=args.maxTokens??256;
   validateOnnxTextBudget(tokens,maxTokens);
   const filter=args.format?createStructuredTokenFilter(args.format,tokenizer,model.generation_config?.eos_token_id??tokenizer.eos_token_id):null;
   const processors=new LogitsProcessorList();
   if(filter){class FormatProcessor extends LogitsProcessor{_call(ids:bigint[][],logits:any){if(ids.length!==1)throw Error('Structured batch unsupported');try{filter!.mask(ids[0].slice(tokens),logits.data);}catch(error){const raw=ids[0].length>tokens?tokenizer.decode(ids[0].slice(tokens).map(Number),{skip_special_tokens:true}):'';diagnostic={raw:raw.slice(0,8192),reason:ids[0].length-tokens>=maxTokens-1?'structured:budget':'structured:continuation',truncated:raw.length>8192};throw Error('Invalid model JSON · structured generation stopped');}return logits;}}processors.push(new FormatProcessor());}
   progress('Generating');const output=await model.generate({...input,max_new_tokens:maxTokens,do_sample:false,...(filter?{logits_processor:processors}:{})});check();
   const generated=output.tolist()[0].slice(tokens);
   if(filter&&!filter.complete(generated)){const raw=tokenizer.decode(generated,{skip_special_tokens:true});diagnostic={raw:raw.slice(0,8192),reason:'structured:incomplete',truncated:raw.length>8192};throw Error('Invalid model JSON · incomplete structured output');}
   value={text:tokenizer.decode(generated,{skip_special_tokens:true})};
  }else throw Error('Unknown text operation');
  check();self.postMessage({id:data.id,type:'done',value});
 }catch(error){self.postMessage({id:data.id,type:'error',value:controller.signal.aborted?'Stopped':(error as Error).message,...(!controller.signal.aborted&&diagnostic?{diagnostic}:{})});}
 finally{controller=undefined;busy=false;}
};
