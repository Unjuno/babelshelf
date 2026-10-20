import manifest from './speech-manifest.json' with {type:'json'};
import {speechModels,getSpeechManifest} from './speech-models.ts';
// @ts-expect-error Shared verified hash implementation is JavaScript.
import {SHA256} from '../../../dist/sha256.js';
import type {CustomSpeechModel} from './preference-records.ts';
import {readCustomSpeechFile} from './custom-speech-assets.ts';
export const speechManifest=manifest;
type Asset=typeof manifest.files[number];
const cacheName=(model:typeof manifest)=>'babelshelf-speech-'+model.revision;
function speechLocation(path:string){
 for(const model of speechModels){const file=model.files.find(f=>path==='/asr-model/'+model.id+'/'+f.path);if(file)return {model,file};}
}
export function speechFile(path:string):Asset|undefined {
 return speechLocation(path)?.file;
}
export function verifySpeechBytes(file:Asset,bytes:Uint8Array){if(bytes.length!==file.bytes||new SHA256().update(bytes).hex()!==file.sha256)throw Error('Speech asset verification failed');return bytes;}
const key=(model:typeof manifest,f:Asset)=>new URL('/asr-model/'+model.id+'/'+f.path,globalThis.location.origin).href;
export async function speechAssetResponse(path:string,customModels:readonly CustomSpeechModel[]=[]){
 const location=speechLocation(path);if(!location)return new Response('Unknown local asset',{status:404});
 const {model,file}=location;
 const response=await (await caches.open(cacheName(model))).match(key(model,file));
 if(!response)throw Error('Speech model not prepared');
 verifySpeechBytes(file,new Uint8Array(await response.clone().arrayBuffer()));return response;
}
export async function speechReady(model:string|CustomSpeechModel='whisper-tiny'){
 if(typeof model==='object'){try{for(const file of model.files)await readCustomSpeechFile(model,file.path,new AbortController().signal);return true;}catch{return false;}}
 const selected=getSpeechManifest(model);if(!selected)return false;
 try{for(const file of selected.files)await speechAssetResponse('/asr-model/'+selected.id+'/'+file.path);return true;}catch{return false;}
}
export async function prepareSpeech(allowNetwork:boolean,progress:(text:string)=>void,model:string|CustomSpeechModel='whisper-tiny',signal=new AbortController().signal){
 if(typeof model==='object'){if(allowNetwork)throw Error('Custom speech weights are local files only');for(const [i,file] of model.files.entries()){if(signal.aborted)throw Error('Stopped');progress('Verifying local model · '+(i+1)+' / '+model.files.length);await readCustomSpeechFile(model,file.path,signal,progress);}return {prepared:true,bytes:model.files.reduce((n,f)=>n+f.bytes,0)};}
 const selected=getSpeechManifest(model);if(!selected)throw Error('Speech runtime not connected');
 const cache=await caches.open(cacheName(selected));
 for(let i=0;i<selected.files.length;i++){
  if(signal.aborted)throw Error('Stopped');const f=selected.files[i];progress('Preparing '+(i+1)+'/'+selected.files.length);
  try{await speechAssetResponse('/asr-model/'+selected.id+'/'+f.path);continue;}catch{/* Only explicit preparation can repair missing/corrupt assets. */}
  if(signal.aborted)throw Error('Stopped');
  if(!allowNetwork)throw Error('Speech model not prepared');
  const response=await fetch(f.url,{credentials:'omit',referrerPolicy:'no-referrer',signal});if(!response.ok)throw Error('Speech download failed');
  const bytes=verifySpeechBytes(f,new Uint8Array(await response.arrayBuffer()));if(signal.aborted)throw Error('Stopped');await cache.put(key(selected,f),new Response(bytes.slice().buffer));
 }
 if(!await speechReady(model))throw Error('Speech preparation failed');
}

// Transformers catches cache exceptions and otherwise tries local HTTP. A terminal
// 404 response is essential: runtime reads must never trigger fetch fallback.
export async function speechRuntimeResponse(path:string,read:(path:string)=>Promise<Response>=speechAssetResponse){try{return await read(path);}catch{return new Response('Speech asset unavailable',{status:404});}}
