/// <reference lib="webworker" />
import {AutoProcessor,AutoModelForImageTextToText,RawImage,env} from '@huggingface/transformers';
import wasmURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm?url';
import mjsURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs?url';
import {configureLocalTransformerRuntime} from './transformers-runtime';
import {visionManifest,visionReady,prepareVision,visionRuntimeResponse} from './vision-assets';

env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath='/vision-model/';
env.useBrowserCache=false;env.useFSCache=false;env.useCustomCache=true;
env.customCache={match:async(path:any)=>visionRuntimeResponse(String(path)),put:async()=>{throw Error('Use explicit vision preparation');}};
configureLocalTransformerRuntime(env,wasmURL,mjsURL);

let processor:any=null,model:any=null,busy=false;
const modelId='lfm25-vl-450m';
const visionDtype={embed_tokens:'q4f16',decoder_model_merged:'q4f16',vision_encoder:'q4f16'} as const;
const progressText=(value:any)=>typeof value==='string'?value:value?.status==='progress'?`${value.file??'Vision model'} · ${Math.round(value.progress??0)}%`:value?.status??'Loading vision model';
async function requireWebGpu(){
 if(!('gpu' in self.navigator))throw Error('WebGPU unavailable in this browser');
 const adapter=await (self.navigator as any).gpu.requestAdapter({powerPreference:'low-power'});
 if(!adapter)throw Error('WebGPU adapter unavailable');
 return adapter;
}
async function load(progress:(value:string)=>void){
 if(model&&processor)return;
 if(!await visionReady())throw Error('Vision model not prepared');
 await requireWebGpu();progress('Loading local vision model');
 const options={revision:visionManifest.revision,local_files_only:true,progress_callback:(value:any)=>progress(progressText(value))};
 processor=await AutoProcessor.from_pretrained(modelId,options);
 model=await AutoModelForImageTextToText.from_pretrained(modelId,{...options,device:'webgpu',dtype:visionDtype});
}

self.onmessage=async({data}:MessageEvent<any>)=>{
 if(busy){self.postMessage({id:data.id,error:'Vision model busy'});return;}busy=true;
 const progress=(text:string)=>self.postMessage({id:data.id,progress:text});
 try{
  let value:any;
  if(data.type==='status')value={ready:await visionReady(),model:visionManifest.id,revision:visionManifest.revision,runtime:visionManifest.runtime};
  else if(data.type==='prepare'){await prepareVision(data.allowNetwork===true,data.signal??new AbortController().signal,progress,data.localFiles);value={ready:true,model:visionManifest.id,revision:visionManifest.revision};}
  else if(data.type==='describe'){
   if(!(data.image instanceof Blob)||!data.image.type.startsWith('image/')||data.image.size<1||data.image.size>32*1024*1024)throw Error('Image file unsupported · maximum 32 MB');
   const prompt=typeof data.prompt==='string'?data.prompt.trim():'';if(!prompt||prompt.length>2000)throw Error('Image question required · maximum 2,000 characters');
   await load(progress);progress('Reading image');
   const image=await RawImage.read(data.image);if(!image.width||!image.height||image.width*image.height>64000000)throw Error('Image dimensions unsupported · maximum 64 megapixels');
   const messages=[{role:'user',content:[{type:'image'},{type:'text',text:'Answer only from visible image content. State uncertainty when details are unclear. Do not infer hidden context.\n\n'+prompt}]}];
   const chat=processor.apply_chat_template(messages,{add_generation_prompt:true});
   const inputs=await processor(image,chat,{add_special_tokens:false,max_image_tokens:256});
   progress('Analyzing image locally');
   const outputs=await model.generate({...inputs,max_new_tokens:256,temperature:0.1,min_p:0.15,repetition_penalty:1.05});
   const result=processor.batch_decode(outputs.slice(null,[inputs.input_ids.dims.at(-1),null]),{skip_special_tokens:true})[0]?.trim();
   if(!result)throw Error('Vision model returned no description');
   value={text:result,model:visionManifest.id,revision:visionManifest.revision,runtime:visionManifest.runtime,width:image.width,height:image.height,scope:'single-image'};
  }else throw Error('Vision action unavailable');
  self.postMessage({id:data.id,value});
 }catch(error){self.postMessage({id:data.id,error:(error as Error).message});}finally{busy=false;}
};
