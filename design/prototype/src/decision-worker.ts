/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web-d1/webgpu';
import wasmURL from '../node_modules/onnxruntime-web-d1/dist/ort-wasm-simd-threaded.asyncify.wasm?url';
import mjsURL from '../node_modules/onnxruntime-web-d1/dist/ort-wasm-simd-threaded.asyncify.mjs?url';
import {PreTrainedTokenizer,env} from '@huggingface/transformers';
import {decisionManifest,decisionStatus,prepareDecision,readDecisionFile} from './decision-assets';
import {encodeDecision,decisionAnswer,validateDecisionQuestion,type DecisionQuestion} from './decision';
const networkFetch=globalThis.fetch.bind(globalThis);
const localRuntime=new Set([wasmURL,mjsURL].map(url=>new URL(url,location.href).href));
globalThis.fetch=(input,options)=>{const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;return localRuntime.has(new URL(url,location.href).href)?networkFetch(input,options):Promise.reject(Error('Network disabled for decisions'));};
env.allowRemoteModels=false;env.allowLocalModels=false;
ort.env.wasm.wasmPaths={wasm:wasmURL,mjs:mjsURL};ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.logLevel='error';
let controller:AbortController|undefined,busy=false,session:ort.InferenceSession|null=null,tok:PreTrainedTokenizer|null=null,config:any,device:'webgpu'|'wasm'='wasm';
const check=()=>{if(controller?.signal.aborted)throw Error('Stopped');};
const i64=(values:number[],dims:number[])=>new ort.Tensor('int64',BigInt64Array.from(values,BigInt),dims);
async function unload(){const old=session;session=null;tok=null;config=undefined;if(old)await old.release();}
async function load(progress:(s:string)=>void){
 if(session&&tok)return {prepared:true,loaded:true,device};
 const files=new Map<string,File>();for(const pin of decisionManifest.files){check();files.set(pin.path,await readDecisionFile(pin.path,controller!.signal,progress));}check();
 const parsed=JSON.parse(await files.get('config.json')!.text());if(parsed.model_type!=='d1_omni'||parsed.max_length!==decisionManifest.contextTokens)throw Error('Decision model config incompatible');
 const tokenizer=new PreTrainedTokenizer(JSON.parse(await files.get('tokenizer.json')!.text()),JSON.parse(await files.get('tokenizer_config.json')!.text()));check();
 encodeDecision(tokenizer,'Compatibility check',{type:'noul',instructions:'Is this text?'},128);
 device='wasm';if(navigator.gpu){try{const adapter=await navigator.gpu.requestAdapter();if(adapter)device='webgpu';}catch{}}check();progress('Loading · '+(device==='webgpu'?'WebGPU':'WASM'));
 const graph=new Uint8Array(await files.get('onnx/model_quantized.onnx')!.arrayBuffer()),data=new Uint8Array(await files.get('onnx/model_quantized.onnx_data')!.arrayBuffer());check();
 const loaded=await ort.InferenceSession.create(graph,{executionProviders:[device],graphOptimizationLevel:'all',externalData:[{path:'model_quantized.onnx_data',data}]});
 try{check();const inputs=['input_ids','attention_mask','prefix_len','marker_pos','marker_mask','qtype'];if(loaded.inputNames.length!==inputs.length||inputs.some(name=>!loaded.inputNames.includes(name))||!loaded.outputNames.includes('logits'))throw Error('Decision graph incompatible');session=loaded;tok=tokenizer;config=parsed;return {prepared:true,loaded:true,device};}catch(e){await loaded.release();throw e;}
}
async function classify(state:string,question:DecisionQuestion){
 if(!session||!tok||!config)throw Error('Decision model not loaded');validateDecisionQuestion(question);const encoded=encodeDecision(tok,state,question,decisionManifest.inputLimit),n=encoded.ids.length,k=encoded.markers.length,start=performance.now();check();
 const inputs={input_ids:i64(encoded.ids,[1,n]),attention_mask:i64(Array(n).fill(1),[1,n]),prefix_len:i64([0],[1]),marker_pos:i64(encoded.markers,[1,k]),marker_mask:i64(Array(k).fill(1),[1,k]),qtype:i64([encoded.qtype],[1])};let result:Record<string,ort.Tensor>={};
 try{result=await session.run(inputs);check();const logits=result.logits;if(logits.type!=='float32'||logits.dims.length!==2||logits.dims[0]!==1||logits.dims[1]!==k)throw Error('Decision output incompatible');return {answer:decisionAnswer(question,Array.from(logits.data as Float32Array),config.temperatures??{}),inputTokens:n,elapsedMs:performance.now()-start,device,scope:'text-only',model:decisionManifest.id,revision:decisionManifest.conversion.revision};}finally{Object.values(result).forEach(t=>t.dispose());Object.values(inputs).forEach(t=>t.dispose());}
}
self.onmessage=async({data})=>{
 if(data.type==='abort'){controller?.abort();return;}if(busy){self.postMessage({id:data.id,error:'Decision model busy'});return;}busy=true;controller=new AbortController();
 const progress=(text:string)=>self.postMessage({id:data.id,progress:text});
 try{let value:any;
  if(data.type==='status')value={...await decisionStatus(controller.signal,progress),loaded:!!session,...(session?{device}:{})};
  else if(data.type==='prepare')value=await prepareDecision(data.allowNetwork===true,controller.signal,progress,networkFetch);
  else if(data.type==='load')value=await load(progress);
  else if(data.type==='unload'){await unload();value={loaded:false};}
  else if(data.type==='classify')value=await classify(data.state,data.question);
  else throw Error('Unknown decision operation');check();self.postMessage({id:data.id,value});
 }catch(e){self.postMessage({id:data.id,error:controller.signal.aborted?'Stopped':(e as Error).message});}finally{busy=false;controller=undefined;}
};
