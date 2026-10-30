// @ts-expect-error Shared bounded GGUF parser is JavaScript.
import {inspectGGUF} from '../../../dist/gguf-inspect.js';
// @ts-expect-error App-owned engine eligibility is JavaScript.
import {eligibleTextEngine} from '../../../dist/local-engines.js';
import {fetchHuggingFace} from './huggingface-network.ts';
import {rememberFailedStaging,forgetFailedStaging,acquireStagingLease,forgetStagingLease} from './staging-cleanup.ts';
export type HuggingFaceModelFile={path:string;bytes:number};
export type HuggingFaceModelSource={provider:'huggingface';repo:string;revision:string;file:string;license:string|null};
export type HuggingFaceRepository={repo:string;revision:string;license:string|null;architecture:'qwen35'|'lfm2'|'lfm3'|'qwen3'|'gguf';files:HuggingFaceModelFile[]};
export function expectedTextEngineForArchitecture(architecture:HuggingFaceRepository['architecture']):string|null{
 return architecture==='gguf'?null:architecture==='qwen35'?'webml-qwen35':architecture==='qwen3'?'wllama-qwen3':architecture==='lfm3'?'wllama-lfm3':'wllama-lfm2';
}
export const MAX_HF_CUSTOM_MODEL_BYTES=8*1024*1024*1024;
const repoPattern=/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\/[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;
const safePath=(path:string)=>typeof path==='string'&&path.length<=512&&!path.startsWith('/')&&!path.includes('\\')&&path.split('/').every(part=>!!part&&part!=='.'&&part!=='..'&&/^[A-Za-z0-9_.-]+$/.test(part));
function segment(value:string){return encodeURIComponent(value);}
function selectedModelUrl(repository:HuggingFaceRepository,file:HuggingFaceModelFile){
 if(!repoPattern.test(repository.repo)||!/^[a-f0-9]{40}$/.test(repository.revision)||!repository.files.some(item=>item.path===file.path&&item.bytes===file.bytes)||!safePath(file.path)||!Number.isSafeInteger(file.bytes)||file.bytes<24||file.bytes>MAX_HF_CUSTOM_MODEL_BYTES)throw Error('Invalid model selection');
 return `https://huggingface.co/${repository.repo.split('/').map(segment).join('/')}/resolve/${repository.revision}/${file.path.split('/').map(segment).join('/')}?download=true`;
}
// Reject unsupported packages before creating a staging file or fetching weights.
// The same container parser and adapter rules also check the complete local file.
export async function inspectHuggingFaceModel(repository:HuggingFaceRepository,file:HuggingFaceModelFile,{signal,fetcher=fetchHuggingFace}:{signal?:AbortSignal;fetcher?:typeof fetch}={}){
 const url=selectedModelUrl(repository,file),limit=16*1024*1024;
 signal?.throwIfAborted();
 const inspection=await inspectGGUF({size:file.bytes,slice(start:number,end:number){return {async arrayBuffer(){
  if(start!==0||end>limit||end>file.bytes||end<24)throw Error('Model header exceeds inspection budget');
  const response=await fetcher(url,{signal,headers:{Range:`bytes=0-${end-1}`},credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.body)throw Error('Model header unavailable');
  const reader=response.body.getReader(),abort=()=>{void reader.cancel().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
  try{
   signal?.throwIfAborted();
   if(!response.ok)throw Error(`Model header request failed · ${response.status}`);
   if(response.status!==206&&!(response.status===200&&file.bytes<=limit))throw Error('Header check unavailable · server must support range requests');
   const range=response.headers.get('content-range');if(range&&range!==`bytes 0-${end-1}/${file.bytes}`)throw Error('Model size changed · refresh the repository');
   const length=response.headers.get('content-length');if(length&&Number(length)!==end)throw Error('Model header size changed');
   const bytes=new Uint8Array(end);let received=0;
   while(true){signal?.throwIfAborted();const part=await reader.read();signal?.throwIfAborted();if(part.done)break;if(part.value.byteLength>end-received)throw Error('Model header exceeds inspection budget');bytes.set(part.value,received);received+=part.value.byteLength;}
   if(received!==end)throw Error('Model header incomplete');return bytes.buffer;
  }finally{signal?.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
 }};}},{signal});
 const engine=eligibleTextEngine(inspection);if(!engine)throw Error('No compatible local engine for this GGUF');
 if(repository.architecture!=='gguf'&&engine.id!==(repository.architecture==='qwen35'?'webml-qwen35':repository.architecture==='qwen3'?'wllama-qwen3':repository.architecture==='lfm3'?'wllama-lfm3':'wllama-lfm2'))throw Error('GGUF architecture does not match repository configuration');
 return inspection;
}
export function validateHuggingFaceRepo(value:string){if(!repoPattern.test(value))throw Error('Enter a public Hugging Face model ID');return value;}
// The product service worker grants exact GGUF range requests only up to 16 MiB.
// Keep downloader chunks inside that same bound so each approved request can pass.
export const HUGGINGFACE_MODEL_RANGE_BYTES=16*1024*1024;
function retryDelay(signal:AbortSignal|undefined,ms:number){return new Promise<void>((resolve,reject)=>{const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);},abort=()=>{done();reject(signal?.reason??new DOMException('Aborted','AbortError'));},timer=setTimeout(()=>{done();resolve();},ms);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();});}
export async function findHuggingFaceModels(repoInput:string,{signal,fetcher=fetchHuggingFace}:{signal?:AbortSignal;fetcher?:typeof fetch}={}):Promise<HuggingFaceRepository>{
 const repo=validateHuggingFaceRepo(repoInput),encoded=repo.split('/').map(segment).join('/');signal?.throwIfAborted();
 const response=await fetcher(`https://huggingface.co/api/models/${encoded}?blobs=true`,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
 if(!response.ok)throw Error(response.status===404?'Model repository not found':`Hugging Face request failed · ${response.status}`);
 const info=await response.json() as any;if(!info||info.id?.toLowerCase()!==repo.toLowerCase()||typeof info.sha!=='string'||!/^[a-f0-9]{40}$/.test(info.sha)||!Array.isArray(info.siblings))throw Error('Invalid Hugging Face repository metadata');
 const configEntry=info.siblings.find((entry:any)=>entry?.rfilename==='config.json');let architecture:HuggingFaceRepository['architecture']='gguf';
 if(configEntry){
  if(!Number.isSafeInteger(configEntry.size)||configEntry.size<2||configEntry.size>1024*1024)throw Error('Model architecture metadata unavailable');
  const configUrl=`https://huggingface.co/${encoded}/resolve/${info.sha}/config.json`,configResponse=await fetcher(configUrl,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!configResponse.ok)throw Error('Model architecture could not be checked');const config=await configResponse.json() as any;
  if(config?.model_type==='qwen3_5')architecture='qwen35';else if(config?.model_type==='lfm2')architecture='lfm2';else if(config?.model_type==='lfm3')architecture='lfm3';else if(config?.model_type==='qwen3')architecture='qwen3';
  else throw Error('No connected local engine for this Hugging Face model');
 }
 const files=info.siblings.filter((entry:any)=>typeof entry?.rfilename==='string'&&entry.rfilename.toLowerCase().endsWith('.gguf')&&!/-\d{5}-of-\d{5}\.gguf$/i.test(entry.rfilename)&&safePath(entry.rfilename)&&Number.isSafeInteger(entry.size)&&entry.size>=24&&entry.size<=MAX_HF_CUSTOM_MODEL_BYTES).map((entry:any)=>({path:entry.rfilename,bytes:entry.size})).sort((a:HuggingFaceModelFile,b:HuggingFaceModelFile)=>a.path.localeCompare(b.path));
 if(!files.length)throw Error('No supported-size GGUF files in this repository');
 const rawLicense=info.cardData?.license,license=typeof rawLicense==='string'&&rawLicense.length<=100?rawLicense:null;
 return {repo,revision:info.sha,license,architecture,files};
}
export class StagingCleanupError extends Error {readonly retryCleanup:()=>Promise<void>;constructor(message:string,retryCleanup:()=>Promise<void>){super(message);this.name='StagingCleanupError';this.retryCleanup=retryCleanup;}}
export async function downloadHuggingFaceModel(repository:HuggingFaceRepository,file:HuggingFaceModelFile,{signal,progress=()=>{},fetcher=fetchHuggingFace,storage=navigator.storage}:{signal?:AbortSignal;progress?:(bytes:number,total:number)=>void;fetcher?:typeof fetch;storage?:StorageManager}={}):Promise<{file:File;source:HuggingFaceModelSource;remove:()=>Promise<void>}>{
 const url=selectedModelUrl(repository,file);
 await inspectHuggingFaceModel(repository,file,{signal,fetcher});signal?.throwIfAborted();
 const root=await storage.getDirectory(),staging=await root.getDirectoryHandle('model-download-staging',{create:true}),name='download-'+crypto.randomUUID()+'.gguf';let created=false;
 const markers=()=>{try{return globalThis.localStorage??null;}catch{return null;}};let cleanupRecorded=false,releaseLease:(()=>Promise<void>)|undefined;
 const cleanup=async()=>{try{if(!created){const saved=markers();if(saved)try{forgetStagingLease(name,saved);}catch{}return;}for(let attempt=0;attempt<2;attempt++)try{await staging.removeEntry(name);created=false;const saved=markers();if(saved){forgetFailedStaging(name,saved);try{forgetStagingLease(name,saved);}catch{}}return;}catch(error){if((error as Error)?.name==='NotFoundError'){created=false;const saved=markers();if(saved){forgetFailedStaging(name,saved);try{forgetStagingLease(name,saved);}catch{}}return;}if(attempt===1){const saved=markers();cleanupRecorded=!!saved&&rememberFailedStaging(name,saved);throw error;}}}finally{if(releaseLease){const release=releaseLease;releaseLease=undefined;await release();}}};
 let writer:FileSystemWritableFileStream|undefined;
 try{
  signal?.throwIfAborted();
  const saved=markers(),locks=globalThis.navigator?.locks;if(saved&&locks)releaseLease=await acquireStagingLease(name,saved,locks);
  signal?.throwIfAborted();
  const handle=await staging.getFileHandle(name,{create:true});created=true;writer=await handle.createWritable();
  for(let start=0;start<file.bytes;start+=HUGGINGFACE_MODEL_RANGE_BYTES){
   const end=Math.min(file.bytes-1,start+HUGGINGFACE_MODEL_RANGE_BYTES-1),expected=end-start+1,range=`bytes ${start}-${end}/${file.bytes}`;let complete=false;
   for(let attempt=0;!complete;attempt++){
    signal?.throwIfAborted();let reader:ReadableStreamDefaultReader<Uint8Array>|undefined,retryable=false;
    try{
     const response=await fetcher(url,{signal,credentials:'omit',referrerPolicy:'no-referrer',headers:{Range:`bytes=${start}-${end}`}});
     if(response.status===429||response.status>=500){await response.body?.cancel().catch(()=>{});throw Object.assign(Error(`Model server error · ${response.status}`),{retryable:true});}
     if(response.status!==206||!response.body)throw Error('Model download requires range requests');
     if(response.headers.get('content-range')!==range)throw Error('Model range changed · refresh the repository');
     const contentLength=response.headers.get('content-length');if(contentLength&&Number(contentLength)!==expected)throw Error('Model range size changed');
     reader=response.body.getReader();let received=0;
     while(true){signal?.throwIfAborted();const part=await reader.read();signal?.throwIfAborted();if(part.done)break;if(part.value.byteLength>expected-received)throw Error('Model range exceeds requested size');await writer.write(part.value.slice().buffer);received+=part.value.byteLength;progress(start+received,file.bytes);}
     if(received!==expected)throw Object.assign(Error('Model download incomplete'),{retryable:true});complete=true;
    }catch(error){
     signal?.throwIfAborted();retryable=!!(error as Error&{retryable?:boolean}).retryable||error instanceof TypeError;
     if(!retryable||attempt>=2)throw error;
     await writer.seek(start);await writer.truncate(start);progress(start,file.bytes);await retryDelay(signal,250*(attempt+1));
    }finally{if(reader){await reader.cancel().catch(()=>{});reader.releaseLock();}}
   }
  }
  signal?.throwIfAborted();await writer.close();writer=undefined;
  const staged=await handle.getFile();if(staged.size!==file.bytes)throw Error('Model size verification failed');
  return {file:staged,source:{provider:'huggingface',repo:repository.repo,revision:repository.revision,file:file.path,license:repository.license},remove:cleanup};
 }catch(error){try{await writer?.abort();}catch{}const value=error as Error;const quota=value?.name==='QuotaExceededError'||/would cause the application to exceed its storage quota/i.test(value?.message??'');try{await cleanup();}catch{throw new StagingCleanupError((quota?'Not enough browser storage':'Model download failed')+' · temporary file not removed'+(cleanupRecorded?'':' · retry before closing'),cleanup);}if(quota)throw Error('Not enough browser storage · free space and try again');throw error;}
}
