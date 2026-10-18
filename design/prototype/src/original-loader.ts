import type {OriginalRef} from './original-assets.ts';
// Share only pending reads of the exact immutable identity. Preview selection,
// verification and ownership/revocation of completed URLs stay with the caller.
export function createOriginalLoader<T>(read:(pin:OriginalRef)=>Promise<T>){
 const pending=new Map<string,Promise<T>>();
 return {load(ref:OriginalRef):Promise<T>{
  const pin=Object.freeze({id:ref.id,revision:ref.revision,sha256:ref.sha256}),key=JSON.stringify([pin.id,pin.revision,pin.sha256]),prior=pending.get(key);
  if(prior)return prior;
  const job=Promise.resolve().then(()=>read(pin));pending.set(key,job);
  const finish=()=>{if(pending.get(key)===job)pending.delete(key);};
  void job.then(finish,finish);return job;
 }};
}
