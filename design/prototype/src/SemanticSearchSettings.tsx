import {useRef,useState} from 'react';
import {CaretRight} from '@phosphor-icons/react';
import {semanticEmbeddingAssetBytes,semanticEmbeddingManifest} from './semantic-embedding-manifest.ts';
import {getSemanticSearchRuntime} from './semantic-search-session.ts';

const modelId=semanticEmbeddingManifest.id;

export function SemanticSearchSettings({selected,downloads,disabled,onSelect}:{selected:boolean;downloads:boolean;disabled?:boolean;onSelect:(enabled:boolean)=>void}){
 const [status,setStatus]=useState('Not checked'),[progress,setProgress]=useState(''),[busy,setBusy]=useState(false),[indexed,setIndexed]=useState<{sources:number;chunks:number}|null>(null),[error,setError]=useState('');
 const operation=useRef<AbortController|null>(null);
 const blocked=!!disabled||busy;
 const canLoad=status==='Files prepared'||status==='Files verified';
 const run=async(label:string,work:(runtime:Awaited<ReturnType<typeof getSemanticSearchRuntime>>,signal:AbortSignal)=>Promise<unknown>)=>{
  if(operation.current)return;const controller=new AbortController();operation.current=controller;setBusy(true);setError('');setProgress(label);
  try{const runtime=await getSemanticSearchRuntime(),result=await work(runtime,controller.signal);controller.signal.throwIfAborted();if(label==='Checking local Search files')setStatus(result&&typeof result==='object'&&'filesPresent'in result&&(result as {filesPresent:boolean}).filesPresent?'Files verified':'Files not prepared');else if(label==='Preparing Search runtime')setStatus('Runtime prepared');else if(label==='Preparing Search model')setStatus('Files prepared');else if(label==='Loading Search model')setStatus('Model loaded');else if(label==='Building Search index'&&result&&typeof result==='object')setIndexed({sources:Number((result as {sources:number}).sources)||0,chunks:Number((result as {chunks:number}).chunks)||0});else if(label==='Unloading Search model')setStatus('Model unloaded');setProgress('');}
  catch(cause){const message=cause instanceof Error?cause.message:'Search operation failed';setError(controller.signal.aborted?'Stopped':message);setProgress('');}
  finally{if(operation.current===controller)operation.current=null;setBusy(false);}
 };
 const events=(type:string,value:unknown)=>{if(type==='progress'&&typeof value==='string')setProgress(value);if(type==='index-progress'&&value&&typeof value==='object'){const item=value as {completed?:number;total?:number};setProgress(`Indexing notes · ${(item.completed??0).toLocaleString('en')} / ${(item.total??0).toLocaleString('en')} passages`);}};
 const cancel=()=>operation.current?.abort();
 return <section className="model-settings" data-model-role="search" tabIndex={-1}>
  <div className="speech-heading"><h2>Search model</h2><CaretRight size={18} aria-hidden="true"/></div>
  <div className="model-picker" aria-label="Search model"><span>{semanticEmbeddingManifest.name}</span></div>
  <div className="source-revision">Multilingual local embeddings · {(semanticEmbeddingAssetBytes/1_000_000).toFixed(0)} MB · Apache-2.0</div>
  <div className="model-preparation"><span>{status}</span><button className="quiet-button" disabled={blocked} onClick={()=>onSelect(!selected)}>{selected?'Turn off':'Use for Search'}</button></div>
  {selected&&<>
   <div className="source-revision">When loaded and indexed, the agent can use semantic matches. Local word search remains available as fallback. No download or indexing starts automatically.</div>
   <div className="action-row">
    <button className="quiet-button" disabled={blocked} onClick={()=>void run('Checking local Search files',async(runtime,signal)=>{await runtime.verifyRuntime(signal,events);const files=await runtime.status(signal);if(files.filesPresent)await runtime.verifyModel(signal,events);return files;})}>Check files</button>
    <button className="quiet-button" disabled={blocked} onClick={()=>void run(downloads?'Preparing Search runtime':'Checking local Search runtime',downloads?(runtime,signal)=>runtime.prepareRuntime(true,signal,events):(runtime,signal)=>runtime.verifyRuntime(signal,events))}>{downloads?'Prepare runtime':'Check runtime'}</button>
    <button className="quiet-button" disabled={blocked||!downloads} title={!downloads?'Turn downloads on in Connection settings':''} onClick={()=>void run('Preparing Search model',(runtime,signal)=>runtime.prepareModel(true,[],signal,events))}>Prepare model</button>
   </div>
   <div className="action-row">
    <button className="quiet-button" disabled={blocked||!canLoad} onClick={()=>void run('Loading Search model',(runtime,signal)=>runtime.load(signal,events))}>Load</button>
    <button className="quiet-button" disabled={blocked||status!=='Model loaded'} onClick={()=>void run('Building Search index',(runtime,signal)=>runtime.index(signal,events))}>Build index</button>
    <button className="quiet-button" disabled={blocked} onClick={()=>void run('Unloading Search model',(runtime,signal)=>runtime.unload(signal))}>Unload</button>
   </div>
   {indexed&&<div className="source-revision">Indexed {indexed.sources.toLocaleString('en')} notes · {indexed.chunks.toLocaleString('en')} passages</div>}
  </>}
  {busy&&<><div className="speech-runtime-status" role="status">{progress||'Working…'}</div><button className="quiet-button" onClick={cancel}>Stop</button></>}
  {error&&<div className="speech-runtime-status" role="alert">{error}</div>}
 </section>;
}
