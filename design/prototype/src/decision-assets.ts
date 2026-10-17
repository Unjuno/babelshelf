import manifest from './decision-manifest.json' with {type:'json'};
// @ts-expect-error Shared verified streaming hash implementation is JavaScript.
import {SHA256} from '../../../dist/sha256.js';
export const decisionManifest=manifest;
type Pin=typeof manifest.files[number];
type IO={directory:()=>Promise<FileSystemDirectoryHandle>;fetch:typeof globalThis.fetch};
const localDirectory=async()=>(await navigator.storage.getDirectory()).getDirectoryHandle('babelshelf-decision-v1',{create:true});
const ioDefault:IO={directory:localDirectory,fetch:(...args)=>globalThis.fetch(...args)};
const check=(signal:AbortSignal)=>{if(signal.aborted)throw Error('Stopped');};
export const decisionFile=(path:string)=>manifest.files.find(f=>f.path===path);
async function hashDecisionFile(file:File,pin:Pin,signal:AbortSignal,progress:(s:string)=>void){
 check(signal);if(file.size!==pin.bytes)throw Error('Decision asset verification failed');const reader=file.stream().getReader(),hash=new SHA256();let count=0,last=0;
 try{for(;;){check(signal);const {value,done}=await reader.read();check(signal);if(done)break;hash.update(value);count+=value.length;if(count-last>8000000){progress('Verifying · '+Math.round(count/pin.bytes*100)+'%');last=count;await new Promise<void>(resolve=>setTimeout(resolve,0));check(signal);}}if(count!==pin.bytes||hash.hex()!==pin.sha256)throw Error('Decision asset verification failed');check(signal);return file;}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function readDecisionFile(path:string,signal:AbortSignal,progress:(s:string)=>void=()=>{},io:IO=ioDefault){
 const pin=decisionFile(path);if(!pin)throw Error('Unknown decision asset');check(signal);const directory=await io.directory();check(signal);const file=await(await directory.getFileHandle(pin.sha256)).getFile();return hashDecisionFile(file,pin,signal,progress);
}
export async function decisionStatus(signal:AbortSignal,progress:(s:string)=>void=()=>{}){
 try{for(const pin of manifest.files)await readDecisionFile(pin.path,signal,progress);check(signal);return {prepared:true,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0)};}
 catch{check(signal);return {prepared:false,bytes:0};}
}
export async function prepareDecisionFile(path:string,allowNetwork:boolean,signal:AbortSignal,progress:(s:string)=>void,io:IO=ioDefault){
 const pin=decisionFile(path);if(!pin)throw Error('Unknown decision asset');check(signal);
 try{await readDecisionFile(path,signal,progress,io);check(signal);return;}catch{check(signal);}
 if(!allowNetwork)throw Error('Downloads are off');
 const response=await io.fetch(pin.url,{signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});check(signal);if(!response.ok||!response.body)throw Error('Decision download failed');
 const reader=response.body.getReader(),hash=new SHA256();let writer:FileSystemWritableFileStream|undefined,count=0,last=0;
 // createWritable commits atomically on close. Abort never deletes/replaces an
 // existing cached file; cancellation after verification cannot start a writer.
 try{const directory=await io.directory();check(signal);const handle=await directory.getFileHandle(pin.sha256,{create:true});check(signal);writer=await handle.createWritable();for(;;){check(signal);const {value,done}=await reader.read();check(signal);if(done)break;count+=value.length;if(count>pin.bytes)throw Error('Decision asset verification failed');hash.update(value);await writer.write(value);if(Date.now()-last>250){progress('Downloading · '+(count/1e6).toFixed(1)+' / '+(pin.bytes/1e6).toFixed(1)+' MB');last=Date.now();}}check(signal);if(count!==pin.bytes||hash.hex()!==pin.sha256)throw Error('Decision asset verification failed');await writer.close();check(signal);}
 catch(e){await writer?.abort().catch(()=>{});throw e;}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function prepareDecision(allowNetwork:boolean,signal:AbortSignal,progress:(s:string)=>void,fetcher=globalThis.fetch.bind(globalThis)){
 for(const [i,pin] of manifest.files.entries()){check(signal);progress('Preparing '+(i+1)+' / '+manifest.files.length);await prepareDecisionFile(pin.path,allowNetwork,signal,progress,{directory:localDirectory,fetch:fetcher});}check(signal);return {prepared:true,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0)};
}
