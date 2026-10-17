import textManifest from '../../../dist/model-manifest.json' with {type:'json'};
import {speechManifest} from './speech-assets.ts';
export type AssetTool='model.prepare'|'model.load'|'model.unload'|'speech.prepare';
type FileDescriptor={name:string;size:number;type:string};
const filePin=(f:{name?:string;path?:string;bytes:number;sha256:string})=>({name:f.name??f.path!,bytes:f.bytes,sha256:f.sha256});
export function textAssetInput(id:string,allowNetwork=false,files?:FileDescriptor[]){
 const m=textManifest.models.find(m=>m.id===id);if(!m)throw Error('Model not configured');
 return {source:{name:m.name},role:'text',model:{id:m.id,revision:m.revision,format:m.format,file:filePin(m.file)},runtime:{name:textManifest.runtime.name,revision:textManifest.runtime.revision,file:filePin(textManifest.runtime.file)},allowNetwork,method:files?'local-files':allowNetwork?'explicit-preparation':'local-only',...(files?{files:files.map(f=>({name:f.name,bytes:f.size,mime:f.type}))}:{})};
}
export function speechAssetInput(allowNetwork:boolean){return {source:{name:'Whisper tiny'},role:'speech',model:{id:speechManifest.id,revision:speechManifest.revision,dtype:speechManifest.dtype},runtime:speechManifest.runtime,device:speechManifest.device,files:speechManifest.files.map(filePin),allowNetwork,method:'explicit-preparation'};}
// Acquired synchronously before the first audit write: clicks cannot race the worker's busy state.
export class AssetOperationGate{
 private held=false;
 get busy(){return this.held;}
 async run<T>(work:()=>Promise<T>):Promise<T>{if(this.held)throw Error('Model busy');this.held=true;try{return await work();}finally{this.held=false;}}
}
