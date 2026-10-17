import languages from './speech-languages.json';
/// <reference lib="webworker" />
import {pipeline,env} from '@huggingface/transformers';
import wasmURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import mjsURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs?url';
import {speechRuntimeResponse,speechManifest,prepareSpeech,speechReady} from './speech-assets';
env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath='/asr-model/';
env.useBrowserCache=false;env.useFSCache=false;env.useCustomCache=true;
env.customCache={match:async(path:any)=>speechRuntimeResponse(String(path)),put:async()=>{throw Error('Use explicit speech preparation');}};
env.backends.onnx.wasm!.wasmPaths={wasm:wasmURL,mjs:mjsURL};
env.backends.onnx.wasm!.numThreads=1;env.backends.onnx.wasm!.proxy=false;
let transcriber:any=null,busy=false;
self.onmessage=async({data})=>{
 if(busy){self.postMessage({id:data.id,error:'Speech model busy'});return;}busy=true;
 const progress=(text:string)=>self.postMessage({id:data.id,progress:text});
 try{let value:any;
  if(data.type==='status')value=await speechReady();
  else if(data.type==='prepare'){await prepareSpeech(data.allowNetwork===true,progress);value=true;}
  else if(data.type==='transcribe'){
   if(!languages.includes(data.language))throw Error('Audio language required');
   if(!(data.samples instanceof Float32Array)||!data.samples.length||data.samples.length>16000*120)throw Error('Audio length invalid · maximum 2 minutes');
   if(!await speechReady())throw Error('Speech model not prepared');
   progress('Loading speech model');
   transcriber??=await pipeline('automatic-speech-recognition','whisper-tiny',{device:'wasm',dtype:'q8',local_files_only:true,revision:speechManifest.revision});
   progress('Transcribing');value=await transcriber(data.samples,{return_timestamps:true,chunk_length_s:30,stride_length_s:5,task:'transcribe',language:data.language,max_new_tokens:256});
  }else throw Error('Speech action unavailable');
  self.postMessage({id:data.id,value});
 }catch(e){self.postMessage({id:data.id,error:(e as Error).message});}finally{busy=false;}
};
