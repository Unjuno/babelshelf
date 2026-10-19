import manifest from './vision-manifest.json' with {type:'json'};
// @ts-expect-error Shared verified hash implementation is JavaScript.
import {SHA256} from '../../../dist/sha256.js';

export const visionManifest=manifest;
type Asset=typeof manifest.files[number]&{url:string};
const CACHE='babelshelf-vision-'+manifest.revision;
const base='/vision-model/lfm25-vl-450m/';
export function visionAsset(path:string):Asset|undefined{
 if(!path.startsWith(base))return undefined;
 const name=path.slice(base.length);
 if(!name||name.includes('..')||name.includes('\\')||name.startsWith('/'))return undefined;
 const file=manifest.files.find(f=>f.path===name);return file?{...file,url:'https://huggingface.co/'+manifest.repository+'/resolve/'+manifest.revision+'/'+file.path}:undefined;
}
const key=(f:Asset)=>new URL(base+f.path,globalThis.location.origin).href;
export function verifyVisionBytes(file:{bytes:number;sha256:string},bytes:Uint8Array){
 if(bytes.length!==file.bytes||new SHA256().update(bytes).hex()!==file.sha256)throw Error('Vision asset verification failed');
 return bytes;
}
export async function verifyVisionStream(file:{bytes:number;sha256:string},response:Response,signal?:AbortSignal){
 const reader=response.body?.getReader();if(!reader)throw Error('Vision asset response unavailable');
 const hash=new SHA256();let count=0;
 try{while(true){signal?.throwIfAborted();const {value,done}=await reader.read();if(done)break;count+=value.length;if(count>file.bytes)throw Error('Vision asset verification failed');hash.update(value);}}
 catch(error){await reader.cancel().catch(()=>{});throw error;}
 finally{reader.releaseLock();}
 signal?.throwIfAborted();if(count!==file.bytes||hash.hex()!==file.sha256)throw Error('Vision asset verification failed');
}
async function cacheVerified(cache:Cache,file:Asset,response:Response,signal:AbortSignal){
 const results=await Promise.allSettled([verifyVisionStream(file,response.clone(),signal),cache.put(key(file),response)]);
 const failed=results.find(result=>result.status==='rejected');
 if(failed){await cache.delete(key(file));throw failed.reason;}
}
export async function visionAssetResponse(path:string){
 const file=visionAsset(path);if(!file)throw Error('Unknown local vision asset');
 const cache=await caches.open(CACHE),response=await cache.match(key(file));
 if(!response)throw Error('Vision model not prepared');
 await verifyVisionStream(file,response);
 const verified=await cache.match(key(file));if(!verified)throw Error('Vision model not prepared');return verified;
}
export async function visionReady(){
 try{for(const file of manifest.files)await visionAssetResponse(base+file.path);return true;}catch{return false;}
}
export async function prepareVision(allowNetwork:boolean,signal:AbortSignal,progress:(text:string)=>void,localFiles?:File[]){
 const cache=await caches.open(CACHE);
 const supplied=new Map<string,File>();
 if(localFiles){if(!localFiles.length||allowNetwork)throw Error('Local vision files required');
  const names=new Map(manifest.files.map(file=>[file.path.split('/').at(-1)!,file]));
  for(const file of localFiles){const pin=names.get(file.name);if(!pin)throw Error('Unknown vision file · '+file.name);if(supplied.has(file.name))throw Error('Duplicate vision file · '+file.name);if(file.size!==pin.bytes)throw Error('Vision file size mismatch · '+file.name);supplied.set(file.name,file);}
 }
 let missing=0;
 for(let i=0;i<manifest.files.length;i++){
  const file=visionAsset(base+manifest.files[i].path)!;signal.throwIfAborted();progress('Verifying vision model · '+(i+1)+' / '+manifest.files.length);
  try{await visionAssetResponse(base+file.path);continue;}catch{signal.throwIfAborted();}
  if(localFiles){const local=supplied.get(file.path.split('/').at(-1)!);if(!local){missing++;continue;}
   try{await cacheVerified(cache,file,new Response(local),signal);}catch(error){signal.throwIfAborted();throw Error('Vision verification · '+file.path+' · '+(error instanceof Error?error.message:String(error)));}continue;}
  if(!allowNetwork)throw Error('Vision model not prepared');
  let response:Response;
  try{response=await fetch(file.url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});}
  catch(error){signal.throwIfAborted();throw Error('Vision download · '+file.path+' · '+(error instanceof Error?error.message:String(error)));}
  if(!response.ok)throw Error('Vision download · '+file.path+' · HTTP '+response.status);
  try{await cacheVerified(cache,file,response,signal);}
  catch(error){signal.throwIfAborted();throw Error('Vision verification or storage · '+file.path+' · '+(error instanceof Error?error.message:String(error)));}
 }
 if(missing)throw Error('Vision files still missing · '+missing);
 signal.throwIfAborted();if(!await visionReady())throw Error('Vision model preparation failed');
}
// Transformers must receive a terminal 404 on cache misses; otherwise a local
// model request can fall through to its Hub fetch path.
export async function visionRuntimeResponse(path:string,read:(path:string)=>Promise<Response>=visionAssetResponse){
 try{return await read(path);}catch{return new Response('Vision asset unavailable',{status:404});}
}
