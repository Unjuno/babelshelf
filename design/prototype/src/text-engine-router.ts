import type {GenerationFormat} from './text-inference.ts';
import {combinedTextManifest,onnxTextModels} from './text-model-manifest.ts';
export type TextBackend={manifest:any;loaded?:string|null;failed?:boolean;init:()=>Promise<any>;call:(cmd:string,args?:any,events?:any)=>Promise<any>;load:(id:string,events?:any)=>Promise<any>;unload:()=>Promise<any>;abort:()=>void;worker:{terminate:()=>void}};
export type TextBackendRegistration={id:string;modelIds:readonly string[];describe:(id:string)=>{contextTokens:number;runtime:{revision:string};models:any[]};create:()=>TextBackend};
type Registered=TextBackendRegistration&{instance:TextBackend|null};
// Trusted factories come from application code. Stored models/config cannot supply code.
export class TextEngineRouter{
 private registrations:Registered[]=[];private active:TextBackend|null=null;private base:any;private epoch=0;private webml:TextBackend;private residentIdentity='';
 constructor(webml:TextBackend,createOnnx:()=>TextBackend,additional:TextBackendRegistration[]=[]){
  this.webml=webml;this.base=webml.manifest;
  const defaults:TextBackendRegistration={id:'onnx-text',modelIds:onnxTextModels.map(m=>m.id),describe:id=>combinedTextManifest({...this.base,models:[]},id),create:createOnnx};
  const engines=new Set<string>(),models=new Set<string>((this.base.models??[]).map((m:any)=>m.id));
  for(const r of [defaults,...additional]){
   if(!r||typeof r.id!=='string'||!/^[a-z][a-z0-9-]*$/.test(r.id)||engines.has(r.id)||typeof r.create!=='function'||typeof r.describe!=='function'||!Array.isArray(r.modelIds)||!r.modelIds.length||r.modelIds.some(id=>typeof id!=='string'||!id||models.has(id))||new Set(r.modelIds).size!==r.modelIds.length)throw Error('Invalid text engine registration');
   for(const id of r.modelIds){const d=r.describe(id);if(!d||!Number.isSafeInteger(d.contextTokens)||d.contextTokens<1||(typeof d.runtime?.revision!=='string'||!d.runtime.revision)||!Array.isArray(d.models)||d.models.length!==r.modelIds.length||d.models.some(m=>!r.modelIds.includes(m.id)||typeof m.revision!=='string'||!m.revision)||new Set(d.models.map(m=>m.id)).size!==r.modelIds.length)throw Error('Invalid text engine manifest');models.add(id);}
   engines.add(r.id);this.registrations.push({...r,modelIds:Object.freeze([...r.modelIds]),instance:null});
  }
 }
 replaceRegistration(id:string,replacement:TextBackendRegistration){
  const index=this.registrations.findIndex(r=>r.id===id),current=this.registrations[index];
  if(!current||replacement.id!==id||!Array.isArray(replacement.modelIds)||!replacement.modelIds.length||new Set(replacement.modelIds).size!==replacement.modelIds.length||typeof replacement.describe!=='function'||typeof replacement.create!=='function')throw Error('Invalid text engine registration');
  if(current.instance&&this.active===current.instance)throw Error('Unload model first');
  const occupied=new Set<string>((this.base.models??[]).map((m:any)=>m.id));for(let i=0;i<this.registrations.length;i++)if(i!==index)for(const model of this.registrations[i].modelIds)occupied.add(model);
  for(const modelId of replacement.modelIds){if(typeof modelId!=='string'||!modelId||occupied.has(modelId))throw Error('Invalid text engine registration');const described=replacement.describe(modelId);if(!described||!Number.isSafeInteger(described.contextTokens)||described.contextTokens<1||!described.runtime?.revision||!Array.isArray(described.models)||described.models.length!==replacement.modelIds.length||described.models.some((m:any)=>!replacement.modelIds.includes(m.id)||typeof m.revision!=='string'||!m.revision)||new Set(described.models.map((m:any)=>m.id)).size!==replacement.modelIds.length)throw Error('Invalid text engine registration');occupied.add(modelId);}
  if(current.instance){current.instance.abort();current.instance.worker.terminate();}
  this.registrations[index]={...replacement,modelIds:Object.freeze([...replacement.modelIds]),instance:null};
 }
 private registration(id:string){return this.registrations.find(r=>r.modelIds.includes(id));}
 get manifest(){const id=this.loaded??'',selected=this.registration(id)?.describe(id);return {...this.base,...(selected?{contextTokens:selected.contextTokens,runtime:selected.runtime}:{}),models:[...this.base.models,...this.registrations.flatMap(r=>r.describe(r.modelIds.includes(id)?id:r.modelIds[0]).models)]};}
 set manifest(value:any){if(value.models?.some((m:any)=>this.registration(m.id)))throw Error('Text model belongs to a registered engine');this.base=value;this.webml.manifest=value;}
 get loaded(){return this.active?.loaded??null;}
 private instance(r:Registered){if(r.instance?.failed){if(this.active===r.instance)this.active=null;r.instance=null;}return r.instance??=r.create();}
 private backend(id:string){const r=this.registration(id);if(r)return this.instance(r);if(!this.base.models?.some((m:any)=>m.id===id))throw Error('Unknown text model');return this.webml;}
 private check(epoch:number){if(epoch!==this.epoch)throw Error('Stopped');}
 private async optionalStatus(r:Registered,epoch:number){
  try{const assets=await this.instance(r).call('status');this.check(epoch);return assets;}
  catch{this.check(epoch);return Object.fromEntries(r.modelIds.map(id=>[id,{filesPresent:false,presenceOnly:true,statusError:true}]));}
 }
 private selectedRegistrations(model?:string,incomingModels:any[]=[]){if(model===undefined)return this.registrations;if(!model)return [];if(!this.base.models?.some((m:any)=>m.id===model)&&!incomingModels.some(m=>m.id===model)&&!this.registration(model))throw Error('Unknown text model');return this.registrations.filter(r=>r.modelIds.includes(model));}
 private async status(model?:string){const selected=this.selectedRegistrations(model),epoch=this.epoch,base=await this.webml.call('status');this.check(epoch);const assets:Record<string,any>={};for(const r of selected){Object.assign(assets,await this.optionalStatus(r,epoch));this.check(epoch);}return {...base,...assets};}
 async init(){return this.webml.init();}
 async call(cmd:string,args:any={},events?:any):Promise<any>{
  if(cmd==='status')return this.status(args.model);
  if(cmd==='configure'){const selected=this.selectedRegistrations(args.statusModel,args.models),epoch=this.epoch,assets=await this.webml.call(cmd,args,events);this.check(epoch);const extra:Record<string,any>={};for(const r of selected){Object.assign(extra,await this.optionalStatus(r,epoch));this.check(epoch);}return {...assets,...extra};}
  if(cmd==='count'){if(!this.active?.loaded)throw Error('Model not loaded');return this.active.call(cmd,args,events);}
  if(cmd==='prepare'||cmd==='verify')return this.backend(args.model).call(cmd,args,events);
  throw Error('Unknown text operation');
 }
 async load(id:string,events?:any){const epoch=this.epoch,backend=this.backend(id),manifest=this.registration(id)?.describe(id)??this.base,identity=JSON.stringify([id,manifest.models.find((m:any)=>m.id===id),manifest.runtime,manifest.contextTokens]);
  if(this.active===backend&&backend.loaded===id&&!backend.failed&&this.residentIdentity===identity)return {model:id,reused:true};
  this.residentIdentity='';if(this.active){const old=this.active;this.active=null;if(!old.failed)await old.unload();}this.check(epoch);this.active=backend;
  try{const result=await backend.load(id,events);this.check(epoch);this.residentIdentity=identity;return result;}catch(error){if(this.active===backend)this.active=null;throw error;}
 }
 async unload(){const epoch=this.epoch,old=this.active;this.active=null;if(old&&!old.failed)await old.unload();this.check(epoch);}
 releaseInactive(selectedModel:string){for(const r of this.registrations)if(!r.modelIds.includes(selectedModel)&&r.instance&&r.instance!==this.active){const old=r.instance;r.instance=null;old.abort();old.worker.terminate();}}
 generate(messages:any[],events?:any,maxTokens=256,format?:GenerationFormat){if(!this.active?.loaded)return Promise.reject(Error('Model not loaded'));return this.active.call('generate',{messages,maxTokens,...(format?{format}:{})},events);}
 abort(){this.epoch++;this.webml.abort();for(const r of this.registrations)if(r.instance){const old=r.instance;r.instance=null;if(this.active===old)this.active=null;old.abort();old.worker.terminate();}}
 worker={terminate:()=>{this.webml.worker.terminate();for(const r of this.registrations){r.instance?.worker.terminate();r.instance=null;}this.active=null;}};
}
