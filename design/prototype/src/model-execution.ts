import type {TextRuntime} from './text-inference.ts';
import {releaseIdleInference} from './inference-ownership.ts';
import {runtimeRoleForModelEngine,type ProductRuntimeRole} from './product-runtime-assets.ts';
import {ModelPreparationRequired} from './execution-result.ts';
export {ModelPreparationRequired} from './execution-result.ts';

type Resident={readonly loaded:string|boolean;readonly busy:boolean;unload:()=>Promise<unknown>};
type Text=TextRuntime&Resident;
type Decision=Resident&{readonly enabled:boolean;readonly ready:boolean;load:()=>Promise<unknown>};
/** Shared acquisition policy. Existing engine clients retain leases and Worker ownership.
 * Automatic execution can only verify local assets. Explicit Load may prepare runtime
 * assets when its caller supplies the user's existing download permission.
 */
export function createModelExecutionManager<D extends Decision>(ports:{text:Text;decision:D;ensureRuntime:(role:ProductRuntimeRole,allowNetwork:boolean)=>Promise<void>}){
 const requireText=(model:string|undefined)=>{
  if(!model)throw new ModelPreparationRequired('model-selection','Model not configured · Settings');
  if(!ports.text.assets[model]?.filesPresent)throw new ModelPreparationRequired('model-files','Model not prepared · Settings');
  return model;
 };
 const loadText=async(model:string|undefined,check:()=>void,options:{allowNetwork?:boolean}={})=>{
  check();const selected=requireText(model);
  const role=runtimeRoleForModelEngine((ports.text.manifest.models.find(item=>item.id===selected) as {engine?:string}|undefined)?.engine);
  if(role)await ports.ensureRuntime(role,options.allowNetwork===true);
  check();await ports.text.load(selected);check();if(ports.text.loaded!==selected)throw Error('Text model did not load');return {loaded:selected};
 };
 return {
  async loadText(model:string|undefined,check:()=>void,options:{allowNetwork?:boolean}={}){
   check();requireText(model);await releaseIdleInference([ports.decision],check);return loadText(model,check,options);
  },
  async text(model:string|undefined,check:()=>void,load:(work:()=>Promise<{loaded:string}>)=>Promise<unknown>=work=>work()):Promise<TextRuntime>{
   check();if(!model||ports.text.loaded!==model)requireText(model);
   await releaseIdleInference([ports.decision],check);check();
   if(ports.text.loaded!==model)await load(()=>loadText(model,check));
   check();return ports.text.pin?.()??ports.text;
  },
  async decision(check:()=>void,load:(work:()=>Promise<unknown>)=>Promise<unknown>=work=>work()):Promise<D>{
   check();if(!ports.decision.enabled||!ports.decision.ready)throw new ModelPreparationRequired('decision-files','Decision model not prepared · Settings');
   await releaseIdleInference([ports.text],check);check();
   if(!ports.decision.loaded)await load(async()=>{await ports.ensureRuntime('decision',false);check();const result=await ports.decision.load();check();if(!result||typeof result!=='object'||(result as {loaded?:unknown}).loaded!==true)throw Error('Decision model did not load');return result;});
   check();return ports.decision;
  },
  releaseForReader:(check:()=>void)=>releaseIdleInference([ports.text,ports.decision],check),
 };
}
