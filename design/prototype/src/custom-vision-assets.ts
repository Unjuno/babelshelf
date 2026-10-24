// @ts-expect-error Shared cancellable streaming hash is JavaScript.
import {hashLocalModel} from '../../../dist/local-models.js';
// @ts-expect-error Shared streaming SHA-256 implementation is JavaScript.
import {SHA256} from '../../../dist/sha256.js';
import type {CustomVisionModel} from './preference-records.ts';

const paths=['chat_template.jinja','config.json','generation_config.json','preprocessor_config.json','processor_config.json','tokenizer.json','tokenizer_config.json','onnx/decoder_model_merged_q4f16.onnx','onnx/decoder_model_merged_q4f16.onnx_data','onnx/embed_tokens_q4f16.onnx','onnx/embed_tokens_q4f16.onnx_data','onnx/vision_encoder_q4f16.onnx','onnx/vision_encoder_q4f16.onnx_data'] as const;
const maxBytes=2*1024*1024*1024;
type Pin=CustomVisionModel['files'][number];
type IO={directory:()=>Promise<FileSystemDirectoryHandle>};
type Review={model:CustomVisionModel;files:File[];status:'execution-not-tested'};
const defaultIO:IO={directory:async()=>(await navigator.storage.getDirectory()).getDirectoryHandle('babelshelf-vision-custom-v1',{create:true})};
const isRecord=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const check=(signal:AbortSignal)=>{if(signal.aborted)throw Error('Stopped');};
function packageHash(files:Pin[]){return new SHA256().update(new TextEncoder().encode(JSON.stringify(files))).hex();}

export function validateCustomVisionModel(value:unknown):CustomVisionModel{
 if(!isRecord(value)||Object.keys(value).sort().join('|')!=='engine|files|id|inspection|label|revision|role')throw Error('Invalid custom Vision model');
 const model=value as CustomVisionModel;
 if(model.role!=='vision'||model.engine!=='transformers-lfm2-vl-onnx'||typeof model.label!=='string'||!model.label.trim()||model.label.length>100||/[\u0000-\u001f\u007f]/.test(model.label)||!Array.isArray(model.files)||model.files.length!==paths.length)throw Error('Unsupported custom Vision model');
 let total=0;
 for(let i=0;i<paths.length;i++){const pin=model.files[i];if(!isRecord(pin)||Object.keys(pin).sort().join('|')!=='bytes|path|sha256'||pin.path!==paths[i]||!Number.isSafeInteger(pin.bytes)||pin.bytes<1||!Number.isSafeInteger(total+=pin.bytes)||typeof pin.sha256!=='string'||!/^[a-f0-9]{64}$/.test(pin.sha256))throw Error('Unsupported custom Vision files');}
 if(total>maxBytes)throw Error('Custom Vision package exceeds the local import limit');
 const digest=packageHash(model.files);
 if(model.id!=='local-vision-'+digest||model.revision!=='sha256:'+digest)throw Error('Custom Vision identity mismatch');
 const inspection=model.inspection;
 if(!isRecord(inspection)||Object.keys(inspection).sort().join('|')!=='architecture|device|dtype|format|maxImageTokens|scope'||inspection.format!=='LFM2-VL-ONNX'||inspection.architecture!=='lfm2_vl'||inspection.device!=='webgpu'||inspection.dtype!=='q4f16'||inspection.maxImageTokens!==256||inspection.scope!=='image-text')throw Error('Custom Vision inspection mismatch');
 return model;
}
function pathFor(file:File){
 const relative=(file as File&{webkitRelativePath?:string}).webkitRelativePath?.replaceAll('\\','/').split('/').filter(Boolean)??[],parts=relative.length?relative.slice(1):[];
 if(parts.length){const path=parts.join('/');if((paths as readonly string[]).includes(path))return path;}
 if((paths as readonly string[]).includes(file.name))return file.name;
 const basename=paths.find(path=>path.split('/').at(-1)===file.name);return basename;
}
async function boundedJson(file:File,max:number,signal:AbortSignal){check(signal);if(file.size<2||file.size>max)throw Error('Vision model metadata size unsupported');let value:unknown;try{value=JSON.parse(await file.text());}catch{throw Error('Vision model metadata invalid');}check(signal);if(!isRecord(value))throw Error('Vision model metadata invalid');return value;}
export function customVisionModelDescriptor(value:CustomVisionModel){const model=validateCustomVisionModel(value);return {model:model.id,id:model.id,revision:model.revision,runtime:'@huggingface/transformers@4.3.0',custom:true,engine:model.engine,device:'webgpu' as const,dtype:'q4f16' as const,maxImageTokens:256,files:model.files};}

export async function inspectCustomVisionModel(files:File[],options:{signal?:AbortSignal;progress?:(text:string)=>void}={}):Promise<Review>{
 const signal=options.signal??new AbortController().signal,progress=options.progress??(()=>{});check(signal);
 if(!Array.isArray(files)||files.length!==paths.length)throw Error('Choose the thirteen LFM2-VL ONNX model files');
 const mapped=new Map<string,File>();let total=0;
 for(const file of files){const path=pathFor(file);if(!path||mapped.has(path)||!Number.isSafeInteger(file.size)||file.size<1)throw Error('Unsupported or duplicate LFM2-VL model file');mapped.set(path,file);total+=file.size;}
 if(paths.some(path=>!mapped.has(path))||total>maxBytes)throw Error('LFM2-VL model file set unsupported');
 const config=await boundedJson(mapped.get('config.json')!,1024*1024,signal),generation=await boundedJson(mapped.get('generation_config.json')!,1024*1024,signal),preprocessor=await boundedJson(mapped.get('preprocessor_config.json')!,1024*1024,signal),processor=await boundedJson(mapped.get('processor_config.json')!,1024*1024,signal),tokenizer=await boundedJson(mapped.get('tokenizer.json')!,32*1024*1024,signal),tokenizerConfig=await boundedJson(mapped.get('tokenizer_config.json')!,4*1024*1024,signal);
 const imageProcessor=(processor.image_processor??processor),tokenizerModel=tokenizer.model;
 if(config.model_type!=='lfm2_vl'||!Array.isArray(config.architectures)||!config.architectures.includes('Lfm2VlForConditionalGeneration')||config.text_config?.model_type!=='lfm2'||config.vision_config?.model_type!=='siglip2_vision_model'||preprocessor.image_processor_type!=='Lfm2VlImageProcessor'||preprocessor.max_image_tokens!==256||processor.processor_class!=='Lfm2VlProcessor'||imageProcessor.image_processor_type!=='Lfm2VlImageProcessor'||imageProcessor.max_image_tokens!==256||tokenizerConfig.processor_class!=='Lfm2VlProcessor'||!isRecord(tokenizerModel)||typeof tokenizerModel.type!=='string'||!isRecord(tokenizerModel.vocab)||typeof generation.eos_token_id!=='number'||mapped.get('chat_template.jinja')!.size>64*1024)throw Error('No compatible local LFM2-VL ONNX adapter');
 const pins=[] as Pin[];
 for(const [i,path] of paths.entries()){check(signal);const file=mapped.get(path)!;const sha256=await hashLocalModel(file,{signal,progress:(done:number,size:number)=>progress('Checking · '+(i+1)+' / '+paths.length+' · '+Math.round(done/size*100)+'%')});pins.push({path,bytes:file.size,sha256});}
 check(signal);const digest=packageHash(pins),name=[config._name_or_path,config.name].find(value=>typeof value==='string'&&value.trim()),label=(typeof name==='string'?name:'Custom LFM2-VL').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,100)||'Custom LFM2-VL';
 const model=validateCustomVisionModel({id:'local-vision-'+digest,label,role:'vision',engine:'transformers-lfm2-vl-onnx',revision:'sha256:'+digest,files:pins,inspection:{format:'LFM2-VL-ONNX',architecture:'lfm2_vl',device:'webgpu',dtype:'q4f16',maxImageTokens:256,scope:'image-text'}});
 return {model,files:paths.map(path=>mapped.get(path)!),status:'execution-not-tested'};
}

async function readFile(model:CustomVisionModel,path:string,signal:AbortSignal,io:IO){
 const declaration=validateCustomVisionModel(model),pin=declaration.files.find(file=>file.path===path);if(!pin)throw Error('Unknown custom Vision asset');check(signal);const directory=await io.directory();check(signal);const file=await(await directory.getFileHandle(pin.sha256)).getFile();check(signal);if(file.size!==pin.bytes||await hashLocalModel(file,{signal})!==pin.sha256)throw Error('Custom Vision asset verification failed');return file;
}
export async function readCustomVisionFile(model:CustomVisionModel,path:string,signal:AbortSignal,progress:(text:string)=>void=()=>{},io:IO=defaultIO){const file=await readFile(model,path,signal,io);progress('Verified · '+path);return file;}
async function writeFile(file:File,pin:Pin,signal:AbortSignal,progress:(text:string)=>void,io:IO){
 check(signal);if(file.size!==pin.bytes||await hashLocalModel(file,{signal})!==pin.sha256)throw Error('Custom Vision asset verification failed');
 const reader=file.stream().getReader(),hash=new SHA256();let count=0,last=Date.now(),writer:FileSystemWritableFileStream|undefined;
 try{const directory=await io.directory();check(signal);const handle=await directory.getFileHandle(pin.sha256,{create:true});check(signal);writer=await handle.createWritable();for(;;){check(signal);const {value,done}=await reader.read();check(signal);if(done)break;count+=value.length;if(count>pin.bytes)throw Error('Custom Vision asset verification failed');hash.update(value);await writer.write(value);if(Date.now()-last>250){progress('Saving · '+Math.round(count/pin.bytes*100)+'%');last=Date.now();}}check(signal);if(count!==pin.bytes||hash.hex()!==pin.sha256)throw Error('Custom Vision asset verification failed');await writer.close();check(signal);}
 catch(error){await writer?.abort().catch(()=>{});throw error;}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function importCustomVisionModel(review:Review,signal:AbortSignal,progress:(text:string)=>void=()=>{},io:IO=defaultIO){
 const model=validateCustomVisionModel(review.model);if(review.status!=='execution-not-tested'||review.files.length!==model.files.length)throw Error('Invalid Vision model review');
 for(const [index,pin] of model.files.entries()){check(signal);const file=review.files[index];if(file.size!==pin.bytes||await hashLocalModel(file,{signal})!==pin.sha256)throw Error('LFM2-VL model files changed');try{await readFile(model,pin.path,signal,io);continue;}catch(error){check(signal);if((error as Error).name!=='NotFoundError'&&!/missing/i.test((error as Error).message))throw error;}await writeFile(file,pin,signal,progress,io);}
 check(signal);return model;
}

export async function customVisionReady(model:CustomVisionModel,signal=new AbortController().signal,io:IO=defaultIO){
 const declaration=validateCustomVisionModel(model);try{for(const pin of declaration.files){check(signal);await readFile(declaration,pin.path,signal,io);}return true;}catch{return false;}
}

export async function customVisionRuntimeResponse(path:string,models:readonly CustomVisionModel[],read:(path:string,model:CustomVisionModel)=>Promise<File|undefined>){
 const match=path.match(/^\/?vision-model\/(local-vision-[a-f0-9]{64})\/(.+)$/);if(!match)return new Response('Vision asset unavailable',{status:404});const model=models.find(item=>item.id===match[1]);if(!model)return new Response('Vision asset unavailable',{status:404});
 try{const validated=validateCustomVisionModel(model),pin=validated.files.find(file=>file.path===match[2]);if(!pin)return new Response('Vision asset unavailable',{status:404});const file=await read(pin.path,validated);if(!file||file.size!==pin.bytes||await hashLocalModel(file)!==pin.sha256)return new Response('Vision asset unavailable',{status:404});return new Response(file.stream(),{headers:{'content-type':pin.path.endsWith('.json')?'application/json':'application/octet-stream'}});}catch{return new Response('Vision asset unavailable',{status:404});}
}
