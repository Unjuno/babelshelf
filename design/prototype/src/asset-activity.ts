import {getQwen3TextManifest} from './qwen3-text-manifest.ts';
import {getLfm3TextManifest} from './lfm3-text-manifest.ts';
import {getLfmTextManifest} from './lfm-text-manifest.ts';
import {isOnnxText,getOnnxTextManifest} from './text-model-manifest.ts';
// @ts-expect-error Shared strict manifest builder is JavaScript.
import {withLocalModels} from '../../../dist/local-model-manifest.js';
import type {CustomLocalModel} from './preference-records.ts';
import type {CustomDecisionModel} from './preference-records.ts';
import type {CustomSpeechModel} from './preference-records.ts';
import {decisionManifest} from './decision-assets.ts';
import {ocrManifest,ocrModelPins,type OcrLanguage} from './ocr-assets.ts';
import textManifest from '../../../dist/model-manifest.json' with {type:'json'};
import {speechManifest} from './speech-assets.ts';
import {getSpeechManifest,speechModelLabel} from './speech-models.ts';
import {visionManifest} from './vision-assets.ts';
import type {CustomVisionModel} from './preference-records.ts';
import {validateCustomVisionModel} from './custom-vision-assets.ts';
export type AssetTool='decision.prepare'|'decision.load'|'decision.unload'|'ocr.prepare'|'vision.prepare'|'model.prepare'|'model.load'|'model.unload'|'speech.prepare'|'runtime.prepare';
type FileDescriptor={name:string;size:number;type:string};
const filePin=(f:{name?:string;path?:string;bytes:number;sha256:string})=>({name:f.name??f.path!,bytes:f.bytes,sha256:f.sha256});
export function textAssetInput(id:string,allowNetwork=false,files?:FileDescriptor[],customModels:CustomLocalModel[]=[]){
 const lfm=getLfmTextManifest(id,customModels)??getLfm3TextManifest(id,customModels)??getQwen3TextManifest(id,customModels);if(lfm){const network=allowNetwork&&!('localModel'in lfm);return {source:{name:lfm.name},role:'text',model:{id:lfm.id,revision:lfm.revision,format:'GGUF',file:filePin(lfm.file)},runtime:lfm.runtime,allowNetwork:network,method:files||'localModel'in lfm?'local-files':network?'explicit-preparation':'local-only',...(files?{files:files.map(f=>({name:f.name,bytes:f.size,mime:f.type}))}:{})};}
 if(isOnnxText(id)){const m=getOnnxTextManifest(id)!;return {source:{name:m.name},role:'text',model:{id:m.id,revision:m.revision,format:'ONNX',files:m.files.map(filePin)},runtime:m.runtime,allowNetwork,method:files?'local-files':allowNetwork?'explicit-preparation':'local-only',...(files?{files:files.map(f=>({name:f.name,bytes:f.size,mime:f.type}))}:{})};}
 const m=withLocalModels(textManifest,customModels).models.find((m:{id:string})=>m.id===id);if(!m)throw Error('Model not configured');
 const network=allowNetwork&&!m.localModel;
 return {source:{name:m.name},role:'text',model:{id:m.id,revision:m.revision,format:m.format,file:filePin(m.file)},runtime:{name:textManifest.runtime.name,revision:textManifest.runtime.revision,file:filePin(textManifest.runtime.file)},allowNetwork:network,method:files||m.localModel?'local-files':network?'explicit-preparation':'local-only',...(files?{files:files.map(f=>({name:f.name,bytes:f.size,mime:f.type}))}:{})};
}
export function speechAssetInput(allowNetwork:boolean,custom?:CustomSpeechModel,id='whisper-tiny'){
 if(custom)return {source:{name:custom.label},role:'speech',model:{id:custom.id,revision:custom.revision,format:'Whisper-ONNX',files:custom.files.map(filePin)},runtime:{name:speechManifest.runtime,revision:'app-owned-transformersjs'},device:'wasm',allowNetwork:false,method:'local-files'};
 const model=getSpeechManifest(id);if(!model)throw Error('Speech runtime not connected');
 return {source:{name:speechModelLabel(id)},role:'speech',model:{id:model.id,revision:model.revision,dtype:model.dtype},runtime:model.runtime,device:model.device,files:model.files.map(filePin),allowNetwork,method:'explicit-preparation'};
}
// Acquired synchronously before the first audit write: clicks cannot race the worker's busy state.
export class AssetOperationGate{
 private held=false;
 get busy(){return this.held;}
 async run<T>(work:()=>Promise<T>):Promise<T>{if(this.held)throw Error('Model busy');this.held=true;try{return await work();}finally{this.held=false;}}
}

export function ocrAssetInput(language:OcrLanguage,allowNetwork:boolean){return {source:{name:'Tesseract 7'},role:'ocr',language,model:{id:ocrManifest.id,processor:ocrManifest.processor,files:ocrModelPins(language)},runtime:ocrManifest.runtime,allowNetwork,method:'explicit-preparation'};}
export function visionAssetInput(allowNetwork:boolean,files?:FileDescriptor[],custom?:CustomVisionModel){
 if(custom){const model=validateCustomVisionModel(custom);return {source:{name:model.label},role:'vision',model:{id:model.id,revision:model.revision,format:'LFM2-VL-ONNX',engine:model.engine,files:model.files.map(filePin)},runtime:{name:'@huggingface/transformers',revision:'4.3.0'},device:model.inspection.device,allowNetwork:false,method:'local-files',...(files?{files:files.map(f=>({name:f.name,bytes:f.size,mime:f.type}))}:{})};}
 return {source:{name:'LFM2.5-VL 450M'},role:'vision',model:{id:visionManifest.id,repository:visionManifest.repository,revision:visionManifest.revision,dtype:visionManifest.dtype,license:visionManifest.license,files:visionManifest.files.map(filePin)},runtime:{name:'@huggingface/transformers',revision:visionManifest.runtime},device:visionManifest.device,allowNetwork:files?false:allowNetwork,method:files?'local-files':allowNetwork?'explicit-preparation':'local-only',...(files?{files:files.map(f=>({name:f.name,bytes:f.size,mime:f.type}))}:{})};
}
export function visionDescriptionInput(modelId:string,asset:{id:string;revision:number;sha256:string;name:string},prompt:string,custom?:CustomVisionModel){
 let model:{id:string;revision:string};
 if(modelId===visionManifest.id&&!custom)model={id:visionManifest.id,revision:visionManifest.revision};
 else if(custom){const valid=validateCustomVisionModel(custom);if(valid.id!==modelId)throw Error('Vision request metadata invalid');model={id:valid.id,revision:valid.revision};}
 else throw Error('Vision request metadata invalid');
 if(!asset||asset.revision!==1||!/^[a-f0-9]{64}$/.test(asset.sha256)||!Number.isInteger(prompt?.length)||prompt.length<1||prompt.length>2000)throw Error('Vision request metadata invalid');
 return {source:{id:asset.id,revision:asset.revision,sha256:asset.sha256,name:asset.name},model,runtime:custom?'@huggingface/transformers@4.3.0':visionManifest.runtime,scope:'single-image',promptCharacters:prompt.length,allowNetwork:false,method:'local-only'};
}

export function decisionAssetInput(allowNetwork:boolean,custom?:CustomDecisionModel,files?:FileDescriptor[]){return custom?{source:{name:custom.label},role:'decision',scope:'text-only',model:{id:custom.id,revision:custom.revision,format:'D1-ONNX',files:custom.files.map(filePin)},runtime:{name:'onnxruntime-web-d1',revision:decisionManifest.runtime.revision},allowNetwork:false,method:'local-files'}:{source:{name:"Open d1 · 600M · text decisions"},role:"decision",scope:"text-only",model:{id:decisionManifest.id,source:decisionManifest.source,conversion:decisionManifest.conversion,files:decisionManifest.files.filter(f=>f.path!=='LICENSE').map(filePin)},runtime:decisionManifest.runtime,tokenizer:decisionManifest.tokenizer,allowNetwork:files?false:allowNetwork,method:files?'local-files':allowNetwork?"explicit-preparation":"local-only",...(files?{files:files.map(f=>({name:f.name,bytes:f.size,mime:f.type}))}:{})};}
