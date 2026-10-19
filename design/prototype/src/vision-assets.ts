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
export async function visionAssetResponse(path:string){
 const file=visionAsset(path);if(!file)throw Error('Unknown local vision asset');
 const response=await (await caches.open(CACHE)).match(key(file));
 if(!response)throw Error('Vision model not prepared');
 verifyVisionBytes(file,new Uint8Array(await response.clone().arrayBuffer()));return response;
}
export async function visionReady(){
 try{for(const file of manifest.files)await visionAssetResponse(base+file.path);return true;}catch{return false;}
}
export async function prepareVision(allowNetwork:boolean,signal:AbortSignal,progress:(text:string)=>void){
 const cache=await caches.open(CACHE);
 for(let i=0;i<manifest.files.length;i++){
  const file=visionAsset(base+manifest.files[i].path)!;signal.throwIfAborted();progress('Verifying vision model · '+(i+1)+' / '+manifest.files.length);
  try{await visionAssetResponse(base+file.path);continue;}catch{signal.throwIfAborted();}
  if(!allowNetwork)throw Error('Vision model not prepared');
  const response=await fetch(file.url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('Vision model download failed');
  const bytes=verifyVisionBytes(file,new Uint8Array(await response.arrayBuffer()));signal.throwIfAborted();
  await cache.put(key(file),new Response(bytes.slice().buffer));
 }
 signal.throwIfAborted();if(!await visionReady())throw Error('Vision model preparation failed');
}
// Transformers must receive a terminal 404 on cache misses; otherwise a local
// model request can fall through to its Hub fetch path.
export async function visionRuntimeResponse(path:string,read:(path:string)=>Promise<Response>=visionAssetResponse){
 try{return await read(path);}catch{return new Response('Vision asset unavailable',{status:404});}
}
