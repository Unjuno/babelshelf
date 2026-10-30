import type {EngineGenerationFormat} from './text-inference.ts';
import {nativeOutputRequest} from './native-output-format.ts';
import {PlannerOutputError} from './planner-error.ts';
import {combinedTextManifest,onnxTextModels} from './text-model-manifest.ts';
export type TextBackend={manifest:any;loaded?:string|null;failed?:boolean;init:()=>Promise<any>;call:(cmd:string,args?:any,events?:any)=>Promise<any>;load:(id:string,events?:any)=>Promise<any>;unload:()=>Promise<any>;abort:()=>void|Promise<void>;worker:{terminate:()=>void}};
export type TextBackendRegistration={id:string;modelIds:readonly string[];plannerProtocol?:'json'|'native-tool-calls';describe:(id:string)=>{contextTokens:number;maxOutputTokens?:number;runtime:{revision:string};models:any[]};create:()=>TextBackend};
type Registered=TextBackendRegistration&{instance:TextBackend|null};
function validOutputLimit(value:unknown,contextTokens:number){return value===undefined||Number.isSafeInteger(value)&&Number(value)>0&&Number(value)<=contextTokens;}
// Trusted factories come from application code. Stored models/config cannot supply code.
export class TextEngineRouter{
 private registrations:Registered[]=[];private active:TextBackend|null=null;private base:any;private epoch=0;private webml:TextBackend;private residentIdentity='';private nativeStructuredOutput=false;private createBase:(()=>TextBackend)|undefined;private cleanupFailure:Error|null=null;
 constructor(webml:TextBackend,createOnnx:()=>TextBackend,additional:TextBackendRegistration[]=[],createBase?:()=>TextBackend,nativeStructuredOutput=false){
  this.nativeStructuredOutput=nativeStructuredOutput===true;
  this.webml=webml;this.base=webml.manifest;this.createBase=createBase;
  const defaults:TextBackendRegistration={id:'onnx-text',modelIds:onnxTextModels.map(m=>m.id),describe:id=>combinedTextManifest({...this.base,models:[]},id),create:createOnnx};
  const engines=new Set<string>(),models=new Set<string>((this.base.models??[]).map((m:any)=>m.id));
  for(const r of [defaults,...additional]){
   if(!r||typeof r.id!=='string'||!/^[a-z][a-z0-9-]*$/.test(r.id)||engines.has(r.id)||typeof r.create!=='function'||typeof r.describe!=='function'||!Array.isArray(r.modelIds)||r.modelIds.some(id=>typeof id!=='string'||!id||models.has(id))||new Set(r.modelIds).size!==r.modelIds.length)throw Error('Invalid text engine registration');
   for(const id of r.modelIds.length?r.modelIds:['']){const d=r.describe(id);if(!d||!Number.isSafeInteger(d.contextTokens)||d.contextTokens<1||!validOutputLimit(d.maxOutputTokens,d.contextTokens)||(typeof d.runtime?.revision!=='string'||!d.runtime.revision)||!Array.isArray(d.models)||d.models.length!==r.modelIds.length||d.models.some(m=>!r.modelIds.includes(m.id)||typeof m.revision!=='string'||!m.revision)||new Set(d.models.map(m=>m.id)).size!==r.modelIds.length)throw Error('Invalid text engine manifest');if(id)models.add(id);}
   engines.add(r.id);this.registrations.push({...r,modelIds:Object.freeze([...r.modelIds]),instance:null});
  }
 }
 get plannerProtocol(){return this.registrations.find(registration=>registration.instance===this.active)?.plannerProtocol??'json';}
 protocolForModel(id:string){return this.registration(id)?.plannerProtocol??'json';}
 replaceRegistration(id:string,replacement:TextBackendRegistration){
  const index=this.registrations.findIndex(r=>r.id===id),current=this.registrations[index];
  if(!current||replacement.id!==id||!Array.isArray(replacement.modelIds)||new Set(replacement.modelIds).size!==replacement.modelIds.length||typeof replacement.describe!=='function'||typeof replacement.create!=='function')throw Error('Invalid text engine registration');
  if(current.instance&&this.active===current.instance)throw Error('Unload model first');
  const occupied=new Set<string>((this.base.models??[]).map((m:any)=>m.id));for(let i=0;i<this.registrations.length;i++)if(i!==index)for(const model of this.registrations[i].modelIds)occupied.add(model);
  for(const modelId of replacement.modelIds.length?replacement.modelIds:['']){if(replacement.modelIds.length&&(typeof modelId!=='string'||!modelId||occupied.has(modelId)))throw Error('Invalid text engine registration');const described=replacement.describe(modelId);if(!described||!Number.isSafeInteger(described.contextTokens)||described.contextTokens<1||!validOutputLimit(described.maxOutputTokens,described.contextTokens)||!described.runtime?.revision||!Array.isArray(described.models)||described.models.length!==replacement.modelIds.length||described.models.some((m:any)=>!replacement.modelIds.includes(m.id)||typeof m.revision!=='string'||!m.revision)||new Set(described.models.map((m:any)=>m.id)).size!==replacement.modelIds.length)throw Error('Invalid text engine registration');if(modelId)occupied.add(modelId);}
  if(current.instance){current.instance.abort();current.instance.worker.terminate();}
  this.registrations[index]={...replacement,modelIds:Object.freeze([...replacement.modelIds]),instance:null};
 }
 /** Registry edits should evict only a backend whose own live configuration changes. */
 mustUnloadForRegistryUpdate(baseManifestChanged:boolean,changedRegistrationIds:readonly string[]){
  if(!this.loaded||!this.active)return false;
  if(this.active===this.webml)return baseManifestChanged;
  const activeRegistration=this.registrations.find(registration=>registration.instance===this.active);
  return !!activeRegistration&&changedRegistrationIds.includes(activeRegistration.id);
 }
 private registration(id:string){return this.registrations.find(r=>r.modelIds.includes(id));}
 get manifest(){const id=this.loaded??'',selected=this.registration(id)?.describe(id),baseModel=this.base.models?.find((model:any)=>model.id===id),runtimeOutputLimit=this.active?.manifest?.maxOutputTokens;return {...this.base,...(selected?{contextTokens:selected.contextTokens,runtime:selected.runtime,maxOutputTokens:selected.maxOutputTokens??runtimeOutputLimit??this.base.maxOutputTokens}:baseModel?{contextTokens:baseModel.contextTokens??this.base.contextTokens,maxOutputTokens:baseModel.maxReplyTokens??runtimeOutputLimit??this.base.maxOutputTokens}:{}),models:[...this.base.models.map((model:any)=>({...model,runtime:this.base.runtime})),...this.registrations.filter(r=>r.modelIds.length).flatMap(r=>{const described=r.describe(r.modelIds.includes(id)?id:r.modelIds[0]);return described.models.map(model=>({...model,runtime:described.runtime}));})]};}
 set manifest(value:any){if(value.models?.some((m:any)=>this.registration(m.id)))throw Error('Text model belongs to a registered engine');this.base=value;this.webml.manifest=value;}
 get loaded(){return this.active?.loaded??null;}
 private instance(r:Registered){if(r.instance?.failed&&this.active!==r.instance)r.instance=null;return r.instance??=r.create();}
 private backend(id:string){const r=this.registration(id);if(r)return this.instance(r);if(!this.base.models?.some((m:any)=>m.id===id))throw Error('Unknown text model');return this.webml;}
 private check(epoch:number){if(epoch!==this.epoch)throw Error('Stopped');}
 private async closeActive(old:TextBackend){try{if(!old.failed){await old.unload();return;}try{await old.abort();}catch{throw Object.assign(Error('Model cleanup not confirmed · reopen app'),{cleanupUnconfirmed:true});}}catch(error){if((error as {cleanupUnconfirmed?:boolean})?.cleanupUnconfirmed===true)this.cleanupFailure=error as Error;throw error;}}
 private async optionalStatus(r:Registered,epoch:number){
  try{const assets=await this.instance(r).call('status');this.check(epoch);return assets;}
  catch{this.check(epoch);return Object.fromEntries(r.modelIds.map(id=>[id,{filesPresent:false,presenceOnly:true,statusError:true}]));}
 }
 private selectedRegistrations(model?:string,incomingModels:any[]=[]){if(model===undefined)return this.registrations.filter(r=>r.modelIds.length);if(!model)return [];if(!this.base.models?.some((m:any)=>m.id===model)&&!incomingModels.some(m=>m.id===model)&&!this.registration(model))throw Error('Unknown text model');return this.registrations.filter(r=>r.modelIds.includes(model));}
 private async status(model?:string){const selected=this.selectedRegistrations(model),epoch=this.epoch,base=await this.webml.call('status');this.check(epoch);const assets:Record<string,any>={};for(const r of selected){Object.assign(assets,await this.optionalStatus(r,epoch));this.check(epoch);}return {...base,...assets};}
 async init(){return this.webml.init();}
 get needsRecovery(){return !!this.webml.failed;}
 async recover(){
  if(!this.webml.failed)return false;
  if(!this.createBase)throw Error('Reload app to restart model worker');
  const epoch=this.epoch,old=this.webml;this.residentIdentity='';if(this.active===old)this.active=null;old.abort();old.worker.terminate();
  const replacement=this.createBase();this.webml=replacement;
  try{await replacement.init();this.check(epoch);return true;}
  catch(error){replacement.abort();replacement.worker.terminate();if(this.webml===replacement)this.webml=old;throw error;}
 }
 async call(cmd:string,args:any={},events?:any):Promise<any>{
  if(cmd==='status')return this.status(args.model);
  if(cmd==='configure'){const selected=this.selectedRegistrations(args.statusModel,args.models),epoch=this.epoch,assets=await this.webml.call(cmd,args,events);this.check(epoch);const extra:Record<string,any>={};for(const r of selected){Object.assign(extra,await this.optionalStatus(r,epoch));this.check(epoch);}return {...assets,...extra};}
  if(cmd==='count'){if(!this.active?.loaded)throw Error('Model not loaded');return this.active.call(cmd,this.active===this.webml&&this.nativeStructuredOutput?this.nativeArgs(args):args,events);}
  if(cmd==='prepare'||cmd==='verify'){if(this.cleanupFailure)throw this.cleanupFailure;try{return await this.backend(args.model).call(cmd,args,events);}catch(error){if((error as {cleanupUnconfirmed?:boolean})?.cleanupUnconfirmed===true)this.cleanupFailure=error as Error;throw error;}}
  throw Error('Unknown text operation');
 }
 async load(id:string,events?:any){if(this.cleanupFailure)throw this.cleanupFailure;const epoch=this.epoch,registration=this.registration(id);if(!registration&&!this.base.models?.some((m:any)=>m.id===id))throw Error('Unknown text model');const manifest=registration?.describe(id)??this.base,identity=JSON.stringify([id,manifest.models.find((m:any)=>m.id===id),manifest.runtime,manifest.contextTokens]);
  if(this.active&&(registration?registration.instance===this.active:this.active===this.webml)&&this.active.loaded===id&&!this.active.failed&&this.residentIdentity===identity)return {model:id,reused:true};
  this.residentIdentity='';if(this.active){const old=this.active;this.active=null;await this.closeActive(old);}this.check(epoch);const backend=this.backend(id);this.active=backend;
  try{const result=await backend.load(id,events);this.check(epoch);this.residentIdentity=identity;return result;}catch(error){if((error as {cleanupUnconfirmed?:boolean})?.cleanupUnconfirmed===true)this.cleanupFailure=error as Error;if(this.active===backend)this.active=null;throw error;}
 }
 async unload(){if(this.cleanupFailure)throw this.cleanupFailure;const epoch=this.epoch,old=this.active;this.active=null;if(old)await this.closeActive(old);this.check(epoch);}
 releaseInactive(selectedModel:string){for(const r of this.registrations)if(!r.modelIds.includes(selectedModel)&&r.instance&&r.instance!==this.active){const old=r.instance;r.instance=null;old.abort();old.worker.terminate();}}
 private nativeArgs(args:any){const {responseTool:_ignored,...rest}=args;return {...rest,...nativeOutputRequest(args.messages,args.format)};}
 generate(messages:any[],events?:any,maxTokens=256,format?:EngineGenerationFormat){
  if(!this.active?.loaded)return Promise.reject(Error('Model not loaded'));
  const args={messages,maxTokens,...(format?{format}:{})},native=this.active===this.webml&&this.nativeStructuredOutput;
  return this.active.call('generate',native?this.nativeArgs(args):args,events).catch(error=>{
   if(native&&error?.diagnostic){const d=error.diagnostic,e=new PlannerOutputError(error.message,d.raw,d.reason);e.diagnostic.truncated=d.truncated===true||e.diagnostic.truncated;throw e;}throw error;
  });
 }
 abort(){this.epoch++;const pending:Promise<void>[]=[Promise.resolve(this.webml.abort())];for(const r of this.registrations)if(r.instance){const old=r.instance;r.instance=null;if(this.active===old)this.active=null;pending.push(Promise.resolve(old.abort()));old.worker.terminate();}return Promise.all(pending).then(()=>{});}
 worker={terminate:()=>{this.webml.worker.terminate();for(const r of this.registrations){r.instance?.worker.terminate();r.instance=null;}this.active=null;}};
}
