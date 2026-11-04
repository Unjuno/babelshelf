// App-owned manifests only. This store grants neither model execution nor tool authority.
// @ts-expect-error Shared cancellable streaming verifier is JavaScript.
import {hashLocalModel} from '../../../dist/local-models.js';

type Pin={path:string;url:string;bytes:number;sha256:string};
type Manifest={id:string;revision:string;runtime:{revision:string};files:Pin[]};
type IO={directory:()=>Promise<FileSystemDirectoryHandle>;fetch:typeof fetch};
type Progress=(bytes:number,total:number)=>void;
class PinnedAssetVerificationError extends Error {constructor(){super('Asset verification failed');}}
// Large GGUF files are fetched in bounded, durable ranges. Closing each range
// commits it to OPFS, so a later attempt can continue after the last full range.
const resumableGgufRangeBytes=16*1024*1024;
export function createPinnedAssetStore(manifest:Manifest,io:IO){
 const pins=structuredClone(manifest);
 if(!/^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$/.test(pins.id)||!/^[a-f0-9]{40}$/.test(pins.revision)||!pins.runtime.revision||!pins.files.length||pins.files.length>64)throw Error('Invalid pinned manifest');
 const paths=new Set<string>();
 for(const pin of pins.files){
  const url=new URL(pin.url);
  if(!/^[a-zA-Z0-9_./-]+$/.test(pin.path)||pin.path.split('/').some(x=>!x||x==='.'||x==='..')||paths.has(pin.path)||!Number.isSafeInteger(pin.bytes)||pin.bytes<1||pin.bytes>8*1024**3||!/^[a-f0-9]{64}$/.test(pin.sha256)||url.protocol!=='https:'||url.username||url.password||!url.pathname.includes('/'+pins.revision+'/'))throw Error('Invalid pinned asset');
  paths.add(pin.path);
 }
 const stopped=(signal:AbortSignal)=>signal.throwIfAborted();
 const verify=async(pin:Pin,file:File,signal:AbortSignal,progress:Progress)=>{
  stopped(signal);
  if(file.size!==pin.bytes||await hashLocalModel(file,{signal,progress})!==pin.sha256)throw new PinnedAssetVerificationError();
  stopped(signal);return file;
 };
 const readPin=async(pin:Pin,signal:AbortSignal,progress:Progress)=>{
  stopped(signal);const directory=await io.directory();stopped(signal);
  const handle=await directory.getFileHandle(pin.sha256);stopped(signal);
  return verify(pin,await handle.getFile(),signal,progress);
 };
 return {
  async read(path:string,signal:AbortSignal,progress:Progress=()=>{}){
   const pin=pins.files.find(p=>p.path===path);if(!pin)throw Error('Unknown pinned asset');
   return readPin(pin,signal,progress);
  },
  // Presence is intentionally weaker than verified readiness. Every runtime read rehashes.
  async status(signal:AbortSignal){
   stopped(signal);const directory=await io.directory();stopped(signal);
   for(const pin of pins.files){
    try{const file=await(await directory.getFileHandle(pin.sha256)).getFile();stopped(signal);if(file.size!==pin.bytes)return {filesPresent:false};}
    catch(error){stopped(signal);if(error instanceof Error&&error.name==='NotFoundError')return {filesPresent:false};throw error;}
   }
   return {filesPresent:true};
  },
  async prepare(allowNetwork:boolean,signal:AbortSignal,progress:Progress=()=>{},localFiles:File[]=[]){
   let downloadedBytes=0,downloadedAssets=0;
   try{
   for(const pin of pins.files){
    try{await readPin(pin,signal,progress);continue;}catch(error){stopped(signal);if(!(error instanceof PinnedAssetVerificationError)&&!(error instanceof Error&&error.name==='NotFoundError'))throw error;}
    const matches=localFiles.filter(f=>f.name===pin.path||f.name===pin.path.split('/').at(-1));
    if(matches.length>1)throw Error('Ambiguous local asset');
    // A single-file GGUF remains identifiable by its pinned size and digest
    // even if the user renamed it. Multi-file packages still require names.
    if(!matches.length&&pins.files.length===1&&localFiles.length===1&&pin.path.toLowerCase().endsWith('.gguf')&&localFiles[0].name.toLowerCase().endsWith('.gguf'))matches.push(localFiles[0]);
     if(!matches.length&&pin.path.toLowerCase().endsWith('.gguf')&&pin.bytes>resumableGgufRangeBytes){
      if(!allowNetwork)throw Error('Downloads are off');
      stopped(signal);const directory=await io.directory();stopped(signal);const handle=await directory.getFileHandle(pin.sha256,{create:true});stopped(signal);
      let existing=await handle.getFile(),offset=existing.size;
      if(offset===pin.bytes){try{await verify(pin,existing,signal,progress);continue;}catch(error){stopped(signal);if(!(error instanceof PinnedAssetVerificationError))throw error;const reset=await handle.createWritable({keepExistingData:true});try{await reset.truncate(0);await reset.close();}catch(resetError){await reset.abort().catch(()=>{});throw resetError;}existing=await handle.getFile();offset=existing.size;}}
      // Only complete, aligned ranges from this protocol are resumable. A
      // legacy or malformed partial is truncated before requesting the model.
      if(offset>pin.bytes||offset%resumableGgufRangeBytes!==0){const reset=await handle.createWritable({keepExistingData:true});try{await reset.truncate(0);await reset.close();}catch(error){await reset.abort().catch(()=>{});throw error;}existing=await handle.getFile();offset=existing.size;}
      if(offset)progress(offset,pin.bytes);
      downloadedAssets++;
      while(offset<pin.bytes){
       const start=offset,end=Math.min(pin.bytes-1,start+resumableGgufRangeBytes-1),expected=end-start+1,range=`bytes ${start}-${end}/${pin.bytes}`;
       stopped(signal);const response=await io.fetch(pin.url,{signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',headers:{Range:`bytes=${start}-${end}`}});stopped(signal);
       const reader=response.body?.getReader();
       if(response.status!==206||!reader){await response.body?.cancel().catch(()=>{});throw Error('Resumable GGUF download requires range requests');}
       if(response.headers.get('content-range')!==range){await reader.cancel().catch(()=>{});reader.releaseLock();throw Error('GGUF download range changed');}
       const length=response.headers.get('content-length');if(length&&Number(length)!==expected){await reader.cancel().catch(()=>{});reader.releaseLock();throw Error('GGUF download range size changed');}
       let writer:FileSystemWritableFileStream|undefined,received=0,closed=false;
       try{
        writer=await handle.createWritable({keepExistingData:true});await writer.seek(start);await writer.truncate(start);stopped(signal);
        while(true){stopped(signal);const part=await reader.read();stopped(signal);if(part.done)break;if(part.value.byteLength>expected-received)throw Error('GGUF range exceeds requested size');await writer.write(part.value.slice().buffer);received+=part.value.byteLength;downloadedBytes+=part.value.byteLength;progress(start+received,pin.bytes);}
        if(received!==expected)throw Error('GGUF range incomplete');stopped(signal);await writer.close();writer=undefined;closed=true;offset=end+1;
       }finally{
        if(writer)await writer.abort().catch(()=>{});
        await reader.cancel().catch(()=>{});reader.releaseLock();
       }
       if(!closed)throw Error('GGUF range was not committed');
      }
      stopped(signal);const complete=await handle.getFile();
      try{await verify(pin,complete,signal,progress);continue;}catch(error){stopped(signal);if(!(error instanceof PinnedAssetVerificationError))throw error;const reset=await handle.createWritable({keepExistingData:true});try{await reset.truncate(0);await reset.close();}catch(resetError){await reset.abort().catch(()=>{});throw resetError;}throw error;}
     }
     let source:ReadableStream<Uint8Array>|undefined,networkSource=false;
    let writer:FileSystemWritableFileStream|undefined;
    let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
    try{
     if(matches.length){await verify(pin,matches[0],signal,progress);source=matches[0].stream();}
     else{
      if(!allowNetwork)throw Error('Downloads are off');
      stopped(signal);const response=await io.fetch(pin.url,{signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});
      source=response.body??undefined;stopped(signal);
      if(!response.ok||!source)throw Error('Asset download failed');
      networkSource=true;downloadedAssets++;
     }
     stopped(signal);const directory=await io.directory();stopped(signal);
     const handle=await directory.getFileHandle(pin.sha256,{create:true});stopped(signal);
     writer=await handle.createWritable();stopped(signal);
     reader=source.getReader();const activeReader=reader,activeWriter=writer;
     const streamed={size:pin.bytes,stream:()=>({getReader:()=>({
      async read(){const chunk=await activeReader.read();stopped(signal);if(!chunk.done){if(networkSource)downloadedBytes+=chunk.value.byteLength;await activeWriter.write(chunk.value.slice().buffer);stopped(signal);}return chunk;},
      cancel:()=>activeReader.cancel(),releaseLock:()=>activeReader.releaseLock()
     })})};
     if(await hashLocalModel(streamed,{signal,progress})!==pin.sha256)throw Error('Asset verification failed');
     reader=undefined;stopped(signal);await writer.close();writer=undefined;
    }finally{
     if(writer)await writer.abort().catch(()=>{});
     if(reader){try{await reader.cancel();reader.releaseLock();}catch{/* verifier may already have released it */}}
     if(source&&!source.locked)await source.cancel().catch(()=>{});
    }
   }
   stopped(signal);
   return {downloadedBytes,downloadedAssets,assetCount:pins.files.length};
   }catch(error){if(error&&typeof error==='object')try{Object.assign(error,{downloadedBytes,downloadedAssets});}catch{}throw error;}
  }
 };
}
