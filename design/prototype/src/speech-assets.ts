import manifest from './speech-manifest.json' with {type:'json'};
// @ts-expect-error Shared verified hash implementation is JavaScript.
import {SHA256} from '../../../dist/sha256.js';
export const speechManifest=manifest;
type Asset=typeof manifest.files[number];
const CACHE='babelshelf-speech-'+manifest.revision;
export function speechFile(path:string):Asset|undefined {
 return manifest.files.find(f=>path==='/asr-model/whisper-tiny/'+f.path);
}
export function verifySpeechBytes(file:Asset,bytes:Uint8Array){if(bytes.length!==file.bytes||new SHA256().update(bytes).hex()!==file.sha256)throw Error('Speech asset verification failed');return bytes;}
const key=(f:Asset)=>new URL('/asr-model/whisper-tiny/'+f.path,globalThis.location.origin).href;
export async function speechAssetResponse(path:string){
 const file=speechFile(path);if(!file)return new Response('Unknown local asset',{status:404});
 const response=await (await caches.open(CACHE)).match(key(file));
 if(!response)throw Error('Speech model not prepared');
 verifySpeechBytes(file,new Uint8Array(await response.clone().arrayBuffer()));return response;
}
export async function speechReady(){try{for(const file of manifest.files)await speechAssetResponse('/asr-model/whisper-tiny/'+file.path);return true;}catch{return false;}}
export async function prepareSpeech(allowNetwork:boolean,progress:(text:string)=>void){
 const cache=await caches.open(CACHE);
 for(let i=0;i<manifest.files.length;i++){
  const f=manifest.files[i];progress('Preparing '+(i+1)+'/'+manifest.files.length);
  try{await speechAssetResponse('/asr-model/whisper-tiny/'+f.path);continue;}catch{/* Only explicit preparation can repair missing/corrupt assets. */}
  if(!allowNetwork)throw Error('Speech model not prepared');
  const response=await fetch(f.url,{credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('Speech download failed');
  const bytes=verifySpeechBytes(f,new Uint8Array(await response.arrayBuffer()));await cache.put(key(f),new Response(bytes.slice().buffer));
 }
 if(!await speechReady())throw Error('Speech preparation failed');
}

// Transformers catches cache exceptions and otherwise tries local HTTP. A terminal
// 404 response is essential: runtime reads must never trigger fetch fallback.
export async function speechRuntimeResponse(path:string,read:(path:string)=>Promise<Response>=speechAssetResponse){try{return await read(path);}catch{return new Response('Speech asset unavailable',{status:404});}}
