// App-owned manifests only. This store grants neither model execution nor tool authority.
// @ts-expect-error Shared cancellable streaming verifier is JavaScript.
import {hashLocalModel} from '../../../dist/local-models.js';
import {createVerifiedOpfsSnapshotCache} from './verified-opfs-snapshot.ts';

type Pin={path:string;url:string;bytes:number;sha256:string};
type Manifest={id:string;revision:string;runtime:{revision:string};files:Pin[]};
type IO={directory:()=>Promise<FileSystemDirectoryHandle>;fetch:typeof fetch;writeRange?:(handle:FileSystemFileHandle,start:number,expected:number,reader:ReadableStreamDefaultReader<Uint8Array>,signal:AbortSignal,onBytes:(count:number)=>void)=>Promise<void>;withLock?:<T>(key:string,signal:AbortSignal,work:()=>Promise<T>)=>Promise<T>};
export type PinnedAssetProgress=(bytes:number,total:number,phase?:'downloading'|'verifying')=>void;
type Progress=PinnedAssetProgress;
class PinnedAssetVerificationError extends Error {constructor(){super('Asset verification failed');}}
function isQuotaExceeded(error:unknown){return !!error&&typeof error==='object'&&((error as {name?:unknown}).name==='QuotaExceededError'||/would cause the application to exceed its storage quota/i.test(String((error as {message?:unknown}).message??'')));}
// Large pinned files are fetched in bounded, durable ranges. Closing each range
// commits it to OPFS, so a later attempt can continue after the last full range.
const resumableRangeBytes=16*1024*1024;
const localAssetLocks=new Map<string,Promise<void>>();
async function withLocalAssetLock<T>(key:string,work:()=>Promise<T>):Promise<T>{
 const previous=localAssetLocks.get(key)??Promise.resolve();let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve),tail=previous.then(()=>gate);localAssetLocks.set(key,tail);await previous;
 try{return await work();}finally{release();if(localAssetLocks.get(key)===tail)localAssetLocks.delete(key);}
}
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
 const snapshotCache=createVerifiedOpfsSnapshotCache(io.directory);
 const cachesModelSnapshot=(pin:Pin)=>pins.id.startsWith('lfm3-')&&pin.path.toLowerCase().endsWith('.gguf');
 const identity=(pin:Pin)=>({modelId:pins.id,modelRevision:pins.revision,sha256:pin.sha256,bytes:pin.bytes});
 const withAssetLock=<T>(pin:Pin,signal:AbortSignal,work:()=>Promise<T>)=>{
  const key=`babelshelf:pinned-asset:${pins.id}:${pins.revision}:${pin.sha256}`;stopped(signal);
  if(io.withLock)return io.withLock(key,signal,work);
  const manager=(globalThis as typeof globalThis&{navigator?:Navigator&{locks?:LockManager}}).navigator?.locks;
  if(manager?.request)return manager.request(key,{mode:'exclusive',signal},work);
  // A secure browser without the cross-tab lock API cannot safely mutate a
  // resumable shared file. Refuse the operation instead of falling back to
  // FileSystemWritableFileStream's shared writer semantics.
  if(typeof isSecureContext==='boolean'&&isSecureContext)throw Error('Safe local model storage locking is unavailable in this browser');
  return withLocalAssetLock(key,work);
 };
 const truncate=async(handle:FileSystemFileHandle,size:number,expectedSize?:number)=>{
  if(io.writeRange){const access=await handle.createSyncAccessHandle();try{if(expectedSize!==undefined&&access.getSize()!==expectedSize)throw Error('Model file changed during preparation · retry');access.truncate(size);access.flush();}finally{access.close();}return;}
  const writer=await handle.createWritable({keepExistingData:true});try{if(expectedSize!==undefined&&(await handle.getFile()).size!==expectedSize)throw Error('Model file changed during preparation · retry');await writer.truncate(size);await writer.close();}catch(error){await writer.abort().catch(()=>{});throw error;}
 };
 const forgetSnapshot=async(pin:Pin)=>{if(cachesModelSnapshot(pin))await snapshotCache.forget(identity(pin));};
 const rememberSnapshot=async(pin:Pin,file:File)=>{if(cachesModelSnapshot(pin))try{await snapshotCache.remember(file,identity(pin));}catch{/* Verification remains valid if OPFS cannot persist the optimization marker. */}};
 const verify=async(pin:Pin,file:File,signal:AbortSignal,progress:Progress)=>{
  stopped(signal);
  if(file.size!==pin.bytes||await hashLocalModel(file,{signal,progress:(done:number,total:number)=>progress(done,total,'verifying')})!==pin.sha256)throw new PinnedAssetVerificationError();
  stopped(signal);await rememberSnapshot(pin,file);return file;
 };
 const readPin=async(pin:Pin,signal:AbortSignal,progress:Progress)=>{
  stopped(signal);const directory=await io.directory();stopped(signal);
  const handle=await directory.getFileHandle(pin.sha256);stopped(signal);
  return verify(pin,await handle.getFile(),signal,progress);
 };
 return {
  async read(path:string,signal:AbortSignal,progress:Progress=()=>{}){
   const pin=pins.files.find(p=>p.path===path);if(!pin)throw Error('Unknown pinned asset');
   return withAssetLock(pin,signal,()=>readPin(pin,signal,progress));
  },
  // Presence is intentionally weaker than verified readiness. Every runtime read rehashes.
  async status(signal:AbortSignal){
   stopped(signal);const directory=await io.directory();stopped(signal);
   for(const pin of pins.files){
    try{const state=await withAssetLock(pin,signal,async()=>{const file=await(await directory.getFileHandle(pin.sha256)).getFile();stopped(signal);return file.size===pin.bytes;});if(!state)return {filesPresent:false};}
    catch(error){stopped(signal);if(error instanceof Error&&error.name==='NotFoundError')return {filesPresent:false};throw error;}
   }
   return {filesPresent:true};
  },
  async prepare(allowNetwork:boolean,signal:AbortSignal,progress:Progress=()=>{},localFiles:File[]=[]){
   let downloadedBytes=0,downloadedAssets=0;
   try{
   for(const pin of pins.files){
    await withAssetLock(pin,signal,async()=>{
     try{await readPin(pin,signal,progress);return;}catch(error){stopped(signal);if(!(error instanceof PinnedAssetVerificationError)&&!(error instanceof Error&&error.name==='NotFoundError'))throw error;}
    const matches=localFiles.filter(f=>f.name===pin.path||f.name===pin.path.split('/').at(-1));
    if(matches.length>1)throw Error('Ambiguous local asset');
    // A single-file GGUF remains identifiable by its pinned size and digest
    // even if the user renamed it. Multi-file packages still require names.
    if(!matches.length&&pins.files.length===1&&localFiles.length===1&&pin.path.toLowerCase().endsWith('.gguf')&&localFiles[0].name.toLowerCase().endsWith('.gguf'))matches.push(localFiles[0]);
    if(!matches.length&&pin.bytes>resumableRangeBytes){
      if(!allowNetwork)throw Error('Downloads are off');
      stopped(signal);const directory=await io.directory();stopped(signal);const handle=await directory.getFileHandle(pin.sha256,{create:true});stopped(signal);
      let existing=await handle.getFile(),offset=existing.size;
       if(offset===pin.bytes){try{await verify(pin,existing,signal,progress);return;}catch(error){stopped(signal);if(!(error instanceof PinnedAssetVerificationError))throw error;await forgetSnapshot(pin);await truncate(handle,0,existing.size);existing=await handle.getFile();offset=existing.size;}}
      // Only complete, aligned ranges from this protocol are resumable. A
      // legacy or malformed partial is truncated before requesting the model.
      if(offset>pin.bytes){await forgetSnapshot(pin);await truncate(handle,0,existing.size);existing=await handle.getFile();offset=existing.size;}
      // Direct worker writes can be interrupted mid-range. Keep every prior
      // complete range and truncate only the incomplete tail on retry.
      if(io.writeRange&&offset%resumableRangeBytes!==0){const aligned=Math.floor(offset/resumableRangeBytes)*resumableRangeBytes;const access=await handle.createSyncAccessHandle();try{if(access.getSize()!==offset)throw Error('Model file changed during preparation · retry');access.truncate(aligned);access.flush();}finally{access.close();}existing=await handle.getFile();offset=existing.size;}
      else if(offset%resumableRangeBytes!==0){await forgetSnapshot(pin);await truncate(handle,0,offset);existing=await handle.getFile();offset=existing.size;}
      progress(offset,pin.bytes,'downloading');
      downloadedAssets++;
      while(offset<pin.bytes){
       const start=offset,end=Math.min(pin.bytes-1,start+resumableRangeBytes-1),expected=end-start+1,range=`bytes ${start}-${end}/${pin.bytes}`;
       stopped(signal);const response=await io.fetch(pin.url,{signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',headers:{Range:`bytes=${start}-${end}`}});stopped(signal);
       if(!response.ok){await response.body?.cancel().catch(()=>{});throw Error(`Model download failed · HTTP ${response.status}`);}
       const reader=response.body?.getReader();
       if(response.status!==206||!reader){await response.body?.cancel().catch(()=>{});throw Error('Resumable model download requires range requests');}
       if(response.headers.get('content-range')!==range){await reader.cancel().catch(()=>{});reader.releaseLock();throw Error('Model download range changed');}
       const length=response.headers.get('content-length');if(length&&Number(length)!==expected){await reader.cancel().catch(()=>{});reader.releaseLock();throw Error('Model download range size changed');}
       let writer:FileSystemWritableFileStream|undefined,received=0,closed=false;
       try{
        await forgetSnapshot(pin);
        if(io.writeRange){await io.writeRange(handle,start,expected,reader,signal,count=>{received+=count;downloadedBytes+=count;progress(start+received,pin.bytes,'downloading');});closed=true;offset=end+1;}
        else{writer=await handle.createWritable({keepExistingData:true});if((await handle.getFile()).size!==start)throw Error('Model file changed during preparation · retry');await writer.seek(start);await writer.truncate(start);stopped(signal);
          while(true){stopped(signal);const part=await reader.read();stopped(signal);if(part.done)break;if(part.value.byteLength>expected-received)throw Error('Model range exceeds requested size');received+=part.value.byteLength;downloadedBytes+=part.value.byteLength;progress(start+received,pin.bytes,'downloading');await writer.write(part.value.slice().buffer);}
         if(received!==expected)throw Error('Model range incomplete');stopped(signal);await writer.close();writer=undefined;closed=true;offset=end+1;}
       }finally{
        if(writer)await writer.abort().catch(()=>{});
        await reader.cancel().catch(()=>{});reader.releaseLock();
       }
       if(!closed)throw Error('Model range was not committed');
      }
      stopped(signal);const complete=await handle.getFile();
       try{await verify(pin,complete,signal,progress);return;}catch(error){stopped(signal);if(!(error instanceof PinnedAssetVerificationError))throw error;await forgetSnapshot(pin);await truncate(handle,0,complete.size);throw error;}
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
     await forgetSnapshot(pin);writer=await handle.createWritable();stopped(signal);
     reader=source.getReader();const activeReader=reader,activeWriter=writer;
     const streamed={size:pin.bytes,stream:()=>({getReader:()=>({
      async read(){const chunk=await activeReader.read();stopped(signal);if(!chunk.done){if(networkSource)downloadedBytes+=chunk.value.byteLength;await activeWriter.write(chunk.value.slice().buffer);stopped(signal);}return chunk;},
      cancel:()=>activeReader.cancel(),releaseLock:()=>activeReader.releaseLock()
     })})};
     if(await hashLocalModel(streamed,{signal,progress:(done:number,total:number)=>progress(done,total,networkSource?'downloading':'verifying')})!==pin.sha256)throw Error('Asset verification failed');
     reader=undefined;stopped(signal);await writer.close();writer=undefined;stopped(signal);await rememberSnapshot(pin,await handle.getFile());
    }finally{
     if(writer)await writer.abort().catch(()=>{});
     if(reader){try{await reader.cancel();reader.releaseLock();}catch{/* verifier may already have released it */}}
     if(source&&!source.locked)await source.cancel().catch(()=>{});
    }
    });
   }
   stopped(signal);
   return {downloadedBytes,downloadedAssets,assetCount:pins.files.length};
   }catch(error){const failure=isQuotaExceeded(error)?Object.assign(Error('The browser stopped accepting model data. Its effective storage limit can be lower than the estimate. Completed download ranges remain on this device.'),{code:'storage-quota-exceeded',cause:error}):error;if(failure&&typeof failure==='object')try{Object.assign(failure,{downloadedBytes,downloadedAssets});}catch{}throw failure;}
  }
 };
}
