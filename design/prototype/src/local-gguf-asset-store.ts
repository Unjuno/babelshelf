// @ts-expect-error Shared streaming verifier is JavaScript.
import {hashLocalModel} from '../../../dist/local-models.js';
type Model={id:string;engine:string;file:{bytes:number;sha256:string}};
type Progress=(bytes:number,total:number)=>void;
class LocalGgufVerificationError extends Error {constructor(){super('Local GGUF verification failed');}}
// Custom weights have no acquisition URL: only the explicitly selected local file can fill this store.
export function createLocalGgufAssetStore(model:Model,io:{directory:()=>Promise<FileSystemDirectoryHandle>}){
 const pin=structuredClone(model);
 if(!['wllama-lfm2','wllama-lfm3','wllama-qwen3'].includes(pin.engine)||pin.id!=='local-'+pin.file.sha256||!Number.isSafeInteger(pin.file.bytes)||pin.file.bytes<24||!/^[a-f0-9]{64}$/.test(pin.file.sha256))throw Error('Invalid local GGUF pin');
 const check=(signal:AbortSignal)=>signal.throwIfAborted();
 async function read(signal:AbortSignal,progress:Progress=()=>{}){
  check(signal);const dir=await io.directory();check(signal);const file=await(await dir.getFileHandle(pin.file.sha256)).getFile();check(signal);
  if(file.size!==pin.file.bytes||await hashLocalModel(file,{signal,progress})!==pin.file.sha256)throw new LocalGgufVerificationError();
  check(signal);return file;
 }
 return {
  async status(signal:AbortSignal){check(signal);const dir=await io.directory();check(signal);let handle:FileSystemFileHandle;try{handle=await dir.getFileHandle(pin.file.sha256);}catch(error){check(signal);if(error instanceof Error&&error.name==='NotFoundError')return {filesPresent:false};throw error;}check(signal);const file=await handle.getFile();check(signal);return {filesPresent:file.size===pin.file.bytes};},
  async verify(signal:AbortSignal,progress:Progress=()=>{}){await read(signal,progress);},
  read,
  async prepare(_allowNetwork:boolean,signal:AbortSignal,progress:Progress=()=>{},files:File[]=[]){
   if((await this.status(signal)).filesPresent){try{await read(signal,progress);return;}catch(error){check(signal);if(!(error instanceof LocalGgufVerificationError))throw error;}}
   const local=files.filter(file=>file.name.toLowerCase().endsWith('.gguf'));if(local.length!==1)throw Error('Choose one local GGUF file');
   if(local[0].size!==pin.file.bytes||await hashLocalModel(local[0],{signal,progress})!==pin.file.sha256)throw Error('Local GGUF verification failed');check(signal);
   const dir=await io.directory();check(signal);const handle=await dir.getFileHandle(pin.file.sha256,{create:true});check(signal);const writer=await handle.createWritable();let source:ReadableStreamDefaultReader<Uint8Array>;try{check(signal);source=local[0].stream().getReader();}catch(error){await writer.abort().catch(()=>{});throw error;}let closed=false;
   const streamed={size:local[0].size,stream:()=>({getReader:()=>({
    async read(){check(signal);const chunk=await source.read();check(signal);if(!chunk.done){await writer.write(chunk.value.slice().buffer);check(signal);}return chunk;},
    cancel:()=>source.cancel(),releaseLock:()=>source.releaseLock()
   })})};
   try{const hash=await hashLocalModel(streamed,{signal,progress});if(hash!==pin.file.sha256)throw Error('Local GGUF verification failed');check(signal);await writer.close();closed=true;check(signal);await read(signal,progress);}
   finally{if(!closed)await writer.abort().catch(()=>{});if(!source.closed)await source.cancel().catch(()=>{});try{source.releaseLock();}catch{/* the hash helper may already have released it */}}
  }
 };
}
