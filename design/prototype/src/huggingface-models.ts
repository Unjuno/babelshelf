export type HuggingFaceModelFile={path:string;bytes:number};
export type HuggingFaceModelSource={provider:'huggingface';repo:string;revision:string;file:string;license:string|null};
export type HuggingFaceRepository={repo:string;revision:string;license:string|null;architecture:'qwen35'|'lfm2'|'gguf';files:HuggingFaceModelFile[]};
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
export async function inspectHuggingFaceModel(repository:HuggingFaceRepository,file:HuggingFaceModelFile,{signal,fetcher=fetch}:{signal?:AbortSignal;fetcher?:typeof fetch}={}){
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
 if(repository.architecture!=='gguf'&&engine.id!==(repository.architecture==='qwen35'?'webml-qwen35':'wllama-lfm2'))throw Error('GGUF architecture does not match repository configuration');
 return inspection;
}
export function validateHuggingFaceRepo(value:string){if(!repoPattern.test(value))throw Error('Enter a public Hugging Face model ID');return value;}
export async function findHuggingFaceModels(repoInput:string,{signal,fetcher=fetch}:{signal?:AbortSignal;fetcher?:typeof fetch}={}):Promise<HuggingFaceRepository>{
 const repo=validateHuggingFaceRepo(repoInput),encoded=repo.split('/').map(segment).join('/');signal?.throwIfAborted();
 const response=await fetcher(`https://huggingface.co/api/models/${encoded}?blobs=true`,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
 if(!response.ok)throw Error(response.status===404?'Model repository not found':`Hugging Face request failed · ${response.status}`);
 const info=await response.json() as any;if(!info||info.id?.toLowerCase()!==repo.toLowerCase()||typeof info.sha!=='string'||!/^[a-f0-9]{40}$/.test(info.sha)||!Array.isArray(info.siblings))throw Error('Invalid Hugging Face repository metadata');
 const configEntry=info.siblings.find((entry:any)=>entry?.rfilename==='config.json');let architecture:HuggingFaceRepository['architecture']='gguf';
 if(configEntry){
  if(!Number.isSafeInteger(configEntry.size)||configEntry.size<2||configEntry.size>1024*1024)throw Error('Model architecture metadata unavailable');
  const configUrl=`https://huggingface.co/${encoded}/resolve/${info.sha}/config.json`,configResponse=await fetcher(configUrl,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!configResponse.ok)throw Error('Model architecture could not be checked');const config=await configResponse.json() as any;
  if(config?.model_type==='qwen3_5')architecture='qwen35';else if(config?.model_type==='lfm2')architecture='lfm2';
  else throw Error(config?.model_type==='qwen3'?'Qwen3 needs a connected local engine · current GGUF imports support Qwen3.5 and LFM2 only':'No connected local engine for this Hugging Face model');
 }
 const files=info.siblings.filter((entry:any)=>typeof entry?.rfilename==='string'&&entry.rfilename.toLowerCase().endsWith('.gguf')&&!/-\d{5}-of-\d{5}\.gguf$/i.test(entry.rfilename)&&safePath(entry.rfilename)&&Number.isSafeInteger(entry.size)&&entry.size>=24&&entry.size<=MAX_HF_CUSTOM_MODEL_BYTES).map((entry:any)=>({path:entry.rfilename,bytes:entry.size})).sort((a:HuggingFaceModelFile,b:HuggingFaceModelFile)=>a.path.localeCompare(b.path));
 if(!files.length)throw Error('No supported-size GGUF files in this repository');
 const rawLicense=info.cardData?.license,license=typeof rawLicense==='string'&&rawLicense.length<=100?rawLicense:null;
 return {repo,revision:info.sha,license,architecture,files};
}
export async function downloadHuggingFaceModel(repository:HuggingFaceRepository,file:HuggingFaceModelFile,{signal,progress=()=>{},fetcher=fetch,storage=navigator.storage}:{signal?:AbortSignal;progress?:(bytes:number,total:number)=>void;fetcher?:typeof fetch;storage?:StorageManager}={}):Promise<{file:File;source:HuggingFaceModelSource;remove:()=>Promise<void>}>{
 const url=selectedModelUrl(repository,file);
 await inspectHuggingFaceModel(repository,file,{signal,fetcher});signal?.throwIfAborted();
 const root=await storage.getDirectory(),staging=await root.getDirectoryHandle('model-download-staging',{create:true}),name='download-'+crypto.randomUUID()+'.gguf';let created=false;
 const cleanup=async()=>{if(!created)return;try{await staging.removeEntry(name);}finally{created=false;}};
 let writer:FileSystemWritableFileStream|undefined;
 try{
  signal?.throwIfAborted();
  const response=await fetcher(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok||!response.body)throw Error(`Model download failed · ${response.status}`);
  const contentLength=response.headers.get('content-length');if(contentLength&&Number(contentLength)!==file.bytes)throw Error('Model size changed · refresh the repository');
  const handle=await staging.getFileHandle(name,{create:true});created=true;writer=await handle.createWritable();const reader=response.body.getReader();let bytes=0;
  try{while(true){signal?.throwIfAborted();const part=await reader.read();signal?.throwIfAborted();if(part.done)break;bytes+=part.value.byteLength;if(bytes>file.bytes)throw Error('Model size changed · download stopped');await writer.write(part.value);progress(bytes,file.bytes);}if(bytes!==file.bytes)throw Error('Model download incomplete');signal?.throwIfAborted();await writer.close();writer=undefined;}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const staged=await handle.getFile();if(staged.size!==file.bytes)throw Error('Model size verification failed');
  return {file:staged,source:{provider:'huggingface',repo:repository.repo,revision:repository.revision,file:file.path,license:repository.license},remove:cleanup};
 }catch(error){try{await writer?.abort();}catch{}await cleanup();throw error;}
}
// @ts-expect-error Shared bounded GGUF parser is JavaScript.
import {inspectGGUF} from '../../../dist/gguf-inspect.js';
// @ts-expect-error App-owned engine eligibility is JavaScript.
import {eligibleTextEngine} from '../../../dist/local-engines.js';
