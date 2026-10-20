import {hashLocalModel} from './local-models.js';

// Code reuse only. Callers still create/dispose their own GPU models/sessions.
// ESM evaluations cannot be evicted without ending the Worker: pin this cache
// to one successful runtime identity rather than retaining an unbounded Map.
export function createRuntimeModuleCache({importModule=url=>import(url),createURL=source=>URL.createObjectURL(new Blob([source],{type:'text/javascript'})),revokeURL=url=>URL.revokeObjectURL(url)}={}){
 let entry=null;
 return async(source,pin,signal)=>{
  signal?.throwIfAborted();
  if(!/^[a-f0-9]{40}$/.test(pin?.revision)||!Number.isSafeInteger(pin?.file?.bytes)||pin.file.bytes<1||!/^[a-f0-9]{64}$/.test(pin?.file?.sha256))throw Error('Invalid runtime pin');
  // Never let an in-memory module turn changed/corrupt local bytes into Ready.
  if(source?.size!==pin.file.bytes||await hashLocalModel(source,{signal})!==pin.file.sha256)throw Error('Runtime verification failed');
  signal?.throwIfAborted();
  const key=JSON.stringify([pin.revision,pin.file.bytes,pin.file.sha256]);
  if(entry&&entry.key!==key)throw Error('Runtime changed · restart model worker');
  const reused=!!entry;
  let current=entry;
  if(!current){
   current={key,promise:null};entry=current;
   current.promise=(async()=>{
    let url;
    try{url=createURL(source);return await importModule(url);}
    catch(error){if(entry===current)entry=null;throw error;}
    finally{if(url)revokeURL(url);}
   })();
  }
  const api=await current.promise;signal?.throwIfAborted();
  return {api,reused};
 };
}
