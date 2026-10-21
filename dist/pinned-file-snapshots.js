// Keep only the small number of immutable OPFS File snapshots needed by one
// model load (model + runtime). A digest is reusable only for the exact File
// object and exact expected SHA-256 that was previously checked.
export function createPinnedFileSnapshots({read,hash,maxEntries=2}){
 if(typeof read!=='function'||typeof hash!=='function'||!Number.isSafeInteger(maxEntries)||maxEntries<1||maxEntries>4)throw Error('Invalid pinned file cache');
 const files=new Map(),verified=new WeakMap();
 function remember(name,file){files.delete(name);files.set(name,file);while(files.size>maxEntries)files.delete(files.keys().next().value);return file;}
 async function get(name){if(typeof name!=='string'||!name)throw Error('Invalid pinned file name');const file=files.get(name);if(file){files.delete(name);files.set(name,file);return file;}const next=await read(name);if(!next||!Number.isSafeInteger(next.size)||typeof next.stream!=='function')throw Error('Pinned file unavailable');return remember(name,next);}
 function invalidate(name){files.delete(name);}
 async function verify(name,pin,options){
  if(!pin||!Number.isSafeInteger(pin.bytes)||pin.bytes<1||!/^[a-f0-9]{64}$/.test(pin.sha256))throw Error('Invalid pinned file digest');
  const file=await get(name);if(file.size!==pin.bytes)throw Error('Local verification failed · pinned file size mismatch');
  if(verified.get(file)===pin.sha256)return file;
  if(await hash(file,options)!==pin.sha256)throw Error('Local verification failed · pinned file integrity mismatch');
  verified.set(file,pin.sha256);return file;
 }
 return {get,verify,invalidate,remember};
}
