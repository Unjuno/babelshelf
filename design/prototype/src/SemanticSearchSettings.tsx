import {useEffect,useRef,useState} from 'react';
import {CaretRight} from '@phosphor-icons/react';
import {semanticEmbeddingAssetBytesFor,semanticEmbeddingManifests,semanticEmbeddingManifest,semanticEmbeddingManifestFor} from './semantic-embedding-manifest.ts';
import {closeSemanticSearchRuntime,getSemanticSearchRuntime} from './semantic-search-session.ts';
import {semanticSearchOperationMessage} from './semantic-search-errors.ts';

type FilesState='Not checked'|'Files present · not verified'|'Files verified'|'Files prepared'|'Files not prepared';
export function SemanticSearchSettings({modelId,downloads,disabled,onSelect}:{modelId:string;downloads:boolean;disabled?:boolean;onSelect:(modelId:string)=>void}){
 const selected=!!modelId,manifest=semanticEmbeddingManifestFor(selected?modelId:semanticEmbeddingManifest.id),assetBytes=semanticEmbeddingAssetBytesFor(manifest);
 const [filesState,setFilesState]=useState<FilesState>(selected?'Not checked':'Files not prepared'),[runtimeReady,setRuntimeReady]=useState(false),[loaded,setLoaded]=useState(false),[progress,setProgress]=useState(''),[busy,setBusy]=useState(false),[indexed,setIndexed]=useState<{sources:number;chunks:number;needsUpdate?:boolean}|null>(null),[testResult,setTestResult]=useState(''),[error,setError]=useState('');
 const operation=useRef<AbortController|null>(null);
 const blocked=!!disabled||busy,canLoad=selected&&runtimeReady&&(filesState==='Files verified'||filesState==='Files prepared');
 const select=(next:string)=>{void closeSemanticSearchRuntime();setTestResult('');setIndexed(null);setProgress('');setLoaded(false);setRuntimeReady(false);setFilesState(next?'Not checked':'Files not prepared');setError('');onSelect(next);};
 useEffect(()=>{
  if(!selected){setFilesState('Files not prepared');setRuntimeReady(false);setLoaded(false);return;}
  let active=true;const controller=new AbortController();
  void getSemanticSearchRuntime(modelId).then(async runtime=>{
   const index=await runtime.indexStatus(controller.signal);
   if(active)setIndexed(index);
   if(runtime.loaded){if(active){setLoaded(true);setFilesState('Files verified');setRuntimeReady(true);setError('');}return;}
   const state=await runtime.status(controller.signal);
   if(active){setFilesState(state.filesPresent?'Files present · not verified':'Files not prepared');setError('');}
  }).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Search status unavailable');});
  return()=>{active=false;controller.abort();};
 },[selected,modelId]);
 const run=async(kind:'check-files'|'prepare-runtime'|'check-runtime'|'prepare-model'|'load'|'test'|'index'|'unload',label:string,work:(runtime:Awaited<ReturnType<typeof getSemanticSearchRuntime>>,signal:AbortSignal)=>Promise<unknown>)=>{
  if(operation.current)return;const controller=new AbortController();operation.current=controller;setBusy(true);setError('');setProgress(label);
  try{const runtime=await getSemanticSearchRuntime(modelId),result=await work(runtime,controller.signal);controller.signal.throwIfAborted();
   if(kind==='check-files'){const files=result as {filesPresent?:boolean};setFilesState(files.filesPresent?'Files verified':'Files not prepared');}
   if(kind==='prepare-runtime'||kind==='check-runtime')setRuntimeReady(true);
   if(kind==='prepare-model')setFilesState('Files prepared');
   if(kind==='load'){setLoaded(true);setRuntimeReady(true);setFilesState('Files verified');}
   if(kind==='unload')setLoaded(false);
   if(kind==='index'&&result&&typeof result==='object')setIndexed({sources:Number((result as {sources:number}).sources)||0,chunks:Number((result as {chunks:number}).chunks)||0});
   if(kind==='test'&&result&&typeof result==='object'){const receipt=result as {passed:boolean;matchRank:number};setTestResult(receipt.passed?`Local embedding check passed · matching passage ranked ${receipt.matchRank}${receipt.matchRank===1?'st':'nd'}`:'Local embedding check failed · matching passage ranked below the distractor');}
   setProgress('');
  }
  catch(cause){setError(controller.signal.aborted?'Stopped':semanticSearchOperationMessage(cause,downloads));setProgress('');if(kind==='check-runtime'||kind==='prepare-runtime')setRuntimeReady(false);if(kind==='check-files'||kind==='prepare-model')setFilesState('Files not prepared');if(kind==='load'||kind==='unload')setLoaded(false);}
  finally{if(operation.current===controller)operation.current=null;setBusy(false);}
 };
 const events=(type:string,value:unknown)=>{if(type==='progress'&&typeof value==='string')setProgress(value);if(type==='index-progress'&&value&&typeof value==='object'){const item=value as {completed?:number;total?:number};setProgress(`Indexing notes · ${(item.completed??0).toLocaleString('en')} / ${(item.total??0).toLocaleString('en')} passages`);}};
 const cancel=()=>operation.current?.abort();
 return <section className="model-settings" data-model-role="search" tabIndex={-1}>
  <div className="speech-heading"><h2>Search model</h2><CaretRight size={18} aria-hidden="true"/></div>
  <select className="model-picker" aria-label="Search model" value={selected?modelId:''} disabled={blocked} onChange={event=>select(event.currentTarget.value)}>
   <option value="">Off · keyword search</option>
   {semanticEmbeddingManifests.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
  </select>
  <div className="source-revision">Local multilingual embeddings · {(assetBytes/1_000_000).toFixed(0)} MB · Apache-2.0{manifest.id.includes('311m')?' · higher quality, slower on some devices':''}</div>
  <div className="model-preparation"><span>{selected?`${filesState} · Runtime ${runtimeReady?'ready':'not checked'} · Model ${loaded?'loaded':'not loaded'}`:'Off · keyword search'}</span>{selected&&<button className="quiet-button" disabled={blocked} onClick={()=>select('')}>Turn off</button>}</div>
  {!selected&&<div className="source-revision" role="status">Choose a Search model above to enable semantic search. Keyword search remains available while Search is off.</div>}
  {selected&&<>
   <div className="source-revision">Prepare and load to use semantic matches. Word search remains available. Model change keeps the previous derived index; each model has a separate index.</div>
   {!downloads&&<div className="source-revision" role="status">Search model preparation needs downloads enabled. Turn Online on in Connection settings; no files download while Offline.</div>}
   <div className="action-row">
    <button className="quiet-button" disabled={blocked} onClick={()=>void run('check-files','Checking local Search files',async(runtime,signal)=>{const files=await runtime.status(signal);if(files.filesPresent)await runtime.verifyModel(signal,events);return files;})}>Check files</button>
    <button className="quiet-button" disabled={blocked||!downloads} title={!downloads?'Turn downloads on in Connection settings':''} onClick={()=>void run('prepare-runtime','Preparing Search runtime',(runtime,signal)=>runtime.prepareRuntime(true,signal,events))}>Prepare runtime</button>
    <button className="quiet-button" disabled={blocked} onClick={()=>void run('check-runtime','Checking local Search runtime',(runtime,signal)=>runtime.verifyRuntime(signal,events))}>Check runtime</button>
    <button className="quiet-button" disabled={blocked||!downloads} title={!downloads?'Turn downloads on in Connection settings':''} onClick={()=>void run('prepare-model','Preparing Search model',(runtime,signal)=>runtime.prepareModel(true,[],signal,events))}>Prepare model</button>
   </div>
   <div className="action-row">
    <button className="quiet-button" disabled={blocked||!canLoad} onClick={()=>void run('load','Loading Search model',(runtime,signal)=>runtime.load(signal,events))}>Load</button>
    <button className="quiet-button" disabled={blocked||!loaded} onClick={()=>{setTestResult('');void run('test','Testing Search model',(runtime,signal)=>runtime.smokeTest(signal,events));}}>Test Search</button>
    <button className="quiet-button" disabled={blocked||!loaded} onClick={()=>void run('index','Building Search index',(runtime,signal)=>runtime.index(signal,events))}>Build index</button>
    <button className="quiet-button" disabled={blocked||!loaded} onClick={()=>void run('unload','Unloading Search model',(runtime,signal)=>runtime.unload(signal))}>Unload</button>
   </div>
   <div className="source-revision" role="status" aria-label="Semantic index status">{indexed?.needsUpdate?'Semantic index needs update · rebuild to include current note revisions':indexed?.sources?`Semantic index ready · ${indexed.sources.toLocaleString('en')} current notes · ${indexed.chunks.toLocaleString('en')} passages`:'Semantic index not built · Memory search currently uses word matches'}</div>
   {testResult&&<div className="speech-runtime-status" role={testResult.includes('passed')?'status':'alert'}>{testResult}</div>}
  </>}
  {busy&&<><div className="speech-runtime-status" role="status">{progress||'Working…'}</div><button className="quiet-button" onClick={cancel}>Stop</button></>}
  {error&&<div className="speech-runtime-status" role="alert">{error}</div>}
 </section>;
}
