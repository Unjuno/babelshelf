/// <reference lib="webworker" />
import {AutoProcessor,AutoModelForImageTextToText,RawImage,env} from '@huggingface/transformers';
import wasmURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm?url';
import mjsURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs?url';
import {configureLocalTransformerRuntime} from './transformers-runtime';
import {visionManifest,visionReady,visionRuntimeResponse} from './vision-assets';
import {customVisionModelDescriptor,customVisionReady,customVisionRuntimeResponse,readCustomVisionFile,validateCustomVisionModel} from './custom-vision-assets.ts';
import type {CustomVisionModel} from './preference-records.ts';
import type {VisionModelIdentity} from './vision-model-identity.ts';
import {validateVisionOutput} from './vision-output.ts';

env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath='/vision-model/';
env.useBrowserCache=false;env.useFSCache=false;env.useCustomCache=true;
configureLocalTransformerRuntime(env,wasmURL,mjsURL);
// Configure ONNX Runtime before the first WebGPU session. This is an adapter
// preference only; the browser may ignore it or choose an integrated GPU.
if(env.backends.onnx.webgpu)env.backends.onnx.webgpu.powerPreference='high-performance';

let processor:any=null,model:any=null,busy=false;
let activeModelId='lfm25-vl-450m',activeIdentity:VisionModelIdentity={model:visionManifest.id,revision:visionManifest.revision,runtime:visionManifest.runtime},activeCustomModel:CustomVisionModel|undefined;
const visionDtype={embed_tokens:'q4f16',decoder_model_merged:'q4f16',vision_encoder:'q4f16'} as const;
const progressText=(value:any)=>typeof value==='string'?value:value?.status==='progress'?`${value.file??'Vision model'} · ${Math.round(value.progress??0)}%`:value?.status??'Loading vision model';
const ready=()=>activeCustomModel?customVisionReady(activeCustomModel):visionReady();
const localRuntimeResponse=(path:string)=>activeCustomModel&&String(path).includes('/vision-model/'+activeCustomModel.id+'/')?customVisionRuntimeResponse(String(path),[activeCustomModel],(asset,custom)=>readCustomVisionFile(custom,asset,new AbortController().signal)):visionRuntimeResponse(String(path));
env.customCache={match:async(path:any)=>localRuntimeResponse(String(path)),put:async()=>{throw Error('Use explicit vision preparation');}};
async function requireWebGpu(){
 if(!('gpu' in self.navigator))throw Error('WebGPU unavailable in this browser');
 const adapter=await (self.navigator as any).gpu.requestAdapter({powerPreference:'high-performance'});
 if(!adapter)throw Error('WebGPU adapter unavailable');
 return adapter;
}
async function load(progress:(value:string)=>void){
 if(model&&processor)return;
 if(!await ready())throw Error('Vision model not prepared');
 await requireWebGpu();progress('Loading local vision model');
 const options={revision:activeIdentity.revision,local_files_only:true,progress_callback:(value:any)=>progress(progressText(value))};
 processor=await AutoProcessor.from_pretrained(activeModelId,options);
 model=await AutoModelForImageTextToText.from_pretrained(activeModelId,{...options,device:'webgpu',dtype:visionDtype});
}

async function describe(imageBlob:Blob,prompt:string,progress:(text:string)=>void){
 progress('Reading image');const image=await RawImage.read(imageBlob);
 if(!image.width||!image.height||image.width*image.height>64000000)throw Error('Image dimensions unsupported · maximum 64 megapixels');
 const messages=[{role:'user',content:[{type:'image'},{type:'text',text:'Answer only from visible image content. State uncertainty when details are unclear. Do not infer hidden context.\n\n'+prompt}]}];
 const chat=processor.apply_chat_template(messages,{add_generation_prompt:true});let inputs:any,outputs:any,sliced:any;
 try{
  inputs=await processor(image,chat,{add_special_tokens:false,max_image_tokens:256});progress('Analyzing image locally');
  outputs=await model.generate({...inputs,max_new_tokens:256,temperature:0.1,min_p:0.15,repetition_penalty:1.05});
  sliced=outputs.slice(null,[inputs.input_ids.dims.at(-1),null]);const result=validateVisionOutput(processor.batch_decode(sliced,{skip_special_tokens:true})[0]??'');
  return {text:result,...activeIdentity,width:image.width,height:image.height,scope:'single-image'};
 }finally{for(const tensor of new Set<any>([sliced,outputs,...Object.values(inputs??{})]))if(typeof tensor?.dispose==='function')await tensor.dispose();}
}

self.onmessage=async({data}:MessageEvent<any>)=>{
 if(busy){self.postMessage({id:data.id,error:'Vision model busy'});return;}busy=true;
 const progress=(text:string)=>self.postMessage({id:data.id,progress:text});
 try{
  const selected=typeof data.model==='string'?data.model:visionManifest.id;
  activeCustomModel=data.customModel?validateCustomVisionModel(data.customModel):undefined;
  if(activeCustomModel&&activeCustomModel.id!==selected||selected!==visionManifest.id&&!activeCustomModel)throw Error('Vision model not registered');
  activeModelId=activeCustomModel?.id??'lfm25-vl-450m';
  activeIdentity=activeCustomModel?customVisionModelDescriptor(activeCustomModel):{model:visionManifest.id,revision:visionManifest.revision,runtime:visionManifest.runtime};
  let value:any;
  if(data.type==='describe'){
   const batch=data.images!==undefined,images=batch?data.images:[data.image];
   if(!Array.isArray(images)||images.length<1||images.length>3||batch&&data.image!==undefined||images.some(image=>!(image instanceof Blob)||!image.type.startsWith('image/')||image.size<1||image.size>(batch?2:32)*1024*1024))throw Error('Image file unsupported · maximum 3 sampled frames');
   const prompt=typeof data.prompt==='string'?data.prompt.trim():'';if(!prompt||prompt.length>2000)throw Error('Image question required · maximum 2,000 characters');
   await load(progress);const frames=[];for(let i=0;i<images.length;i++){progress('Reading image · '+(i+1)+' / '+images.length);frames.push(await describe(images[i],prompt,progress));}
   value=batch?{frames}:frames[0];
  }else throw Error('Vision action unavailable');
  self.postMessage({id:data.id,value});
 }catch(error){self.postMessage({id:data.id,error:(error as Error).message});}finally{busy=false;}
};
