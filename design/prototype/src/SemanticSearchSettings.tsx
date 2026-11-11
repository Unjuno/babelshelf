import {useEffect,useRef,useState} from 'react';
import {CaretRight} from '@phosphor-icons/react';
import {semanticEmbeddingAssetBytesFor,semanticEmbeddingManifests,semanticEmbeddingManifest,semanticEmbeddingManifestFor} from './semantic-embedding-manifest.ts';
import {closeSemanticSearchRuntime,getSemanticSearchRuntime} from './semantic-search-session.ts';

export function SemanticSearchSettings({modelId,downloads,disabled,onSelect}:{modelId:string;downloads:boolean;disabled?:boolean;onSelect:(modelId:string)=>void}){
 const selected=!!modelId,manifest=semanticEmbeddingManifestFor(selected?modelId:semanticEmbeddingManifest.id),assetBytes=semanticEmbeddingAssetBytesFor(manifest);
 const [status,setStatus]=useState(selected?'Not checked':'Off'),[progress,setProgress]=useState(''),[busy,setBusy]=useState(false),[indexed,setIndexed]=useState<{sources:number;chunks:number}|null>(null),[testResult,setTestResult]=useState(''),[error,setError]=useState('');
 const operation=useRef<AbortController|null>(null);
 const blocked=!!disabled||busy;
 const canLoad=status==='Files prepared'||status==='Files verified';
 const select=(next:string)=>{void closeSemanticSearchRuntime();setTestResult('');setIndexed(null);setProgress('');setStatus(next?'Checking local Search status':'Off');onSelect(next);};
 useEffect(()=>{
  if(!selected){setStatus('Off');return;}
  setStatus('Checking local Search status');
  let active=true;const controller=new AbortController();
  void getSemanticSearchRuntime(modelId).then(async runtime=>{
   if(runtime.loaded){if(active)setStatus('Model loaded');return;}
   const state=await runtime.status(controller.signal);
   if(active)setStatus(state.filesPresent?'Files verified':'Files not prepared');
  }).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Search status unavailable');});
  return()=>{active=false;controller.abort();};
 },[selected,modelId]);
 const run=async(label:string,work:(runtime:Awaited<ReturnType<typeof getSemanticSearchRuntime>>,signal:AbortSignal)=>Promise<unknown>)=>{
  if(operation.current)return;const controller=new AbortController();operation.current=controller;setBusy(true);setError('');setProgress(label);
  try{const runtime=await getSemanticSearchRuntime(modelId),result=await work(runtime,controller.signal);controller.signal.throwIfAborted();if(label==='Checking local Search files')setStatus(result&&typeof result==='object'&&'filesPresent'in result&&(result as {filesPresent:boolean}).filesPresent?'Files verified':'Files not prepared');else if(label==='Preparing Search runtime')setStatus('Runtime prepared');else if(label==='Preparing Search model')setStatus('Files prepared');else if(label==='Loading Search model')setStatus('Model loaded');else if(label==='Building Search index'&&result&&typeof result==='object')setIndexed({sources:Number((result as {sources:number}).sources)||0,chunks:Number((result as {chunks:number}).chunks)||0});else if(label==='Testing Search model'&&result&&typeof result==='object'){const receipt=result as {passed:boolean;matchRank:number};setTestResult(receipt.passed?`Local embedding check passed · matching passage ranked ${receipt.matchRank}${receipt.matchRank===1?'st':'nd'}`:'Local embedding check failed · matching passage ranked below the distractor');}else if(label==='Unloading Search model')setStatus('Model unloaded');setProgress('');}
  catch(cause){const message=cause instanceof Error?cause.message:'Search operation failed';setError(controller.signal.aborted?'Stopped':message);setProgress('');}
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
  <div className="model-preparation"><span>{status}</span>{selected&&<button className="quiet-button" disabled={blocked} onClick={()=>select('')}>Turn off</button>}</div>
  {selected&&<>
   <div className="source-revision">Prepare and load to use semantic matches. Word search remains available. Model change keeps the previous derived index; each model has a separate index.</div>
   <div className="action-row">
    <button className="quiet-button" disabled={blocked} onClick={()=>void run('Checking local Search files',async(runtime,signal)=>{await runtime.verifyRuntime(signal,events);const files=await runtime.status(signal);if(files.filesPresent)await runtime.verifyModel(signal,events);return files;})}>Check files</button>
    <button className="quiet-button" disabled={blocked} onClick={()=>void run(downloads?'Preparing Search runtime':'Checking local Search runtime',downloads?(runtime,signal)=>runtime.prepareRuntime(true,signal,events):(runtime,signal)=>runtime.verifyRuntime(signal,events))}>{downloads?'Prepare runtime':'Check runtime'}</button>
    <button className="quiet-button" disabled={blocked||!downloads} title={!downloads?'Turn downloads on in Connection settings':''} onClick={()=>void run('Preparing Search model',(runtime,signal)=>runtime.prepareModel(true,[],signal,events))}>Prepare model</button>
   </div>
   <div className="action-row">
    <button className="quiet-button" disabled={blocked||!canLoad} onClick={()=>void run('Loading Search model',(runtime,signal)=>runtime.load(signal,events))}>Load</button>
    <button className="quiet-button" disabled={blocked||status!=='Model loaded'} onClick={()=>{setTestResult('');void run('Testing Search model',(runtime,signal)=>runtime.smokeTest(signal,events));}}>Test Search</button>
    <button className="quiet-button" disabled={blocked||status!=='Model loaded'} onClick={()=>void run('Building Search index',(runtime,signal)=>runtime.index(signal,events))}>Build index</button>
    <button className="quiet-button" disabled={blocked} onClick={()=>void run('Unloading Search model',(runtime,signal)=>runtime.unload(signal))}>Unload</button>
   </div>
   {indexed&&<div className="source-revision">Indexed {indexed.sources.toLocaleString('en')} notes · {indexed.chunks.toLocaleString('en')} passages</div>}
   {testResult&&<div className="speech-runtime-status" role={testResult.includes('passed')?'status':'alert'}>{testResult}</div>}
  </>}
  {busy&&<><div className="speech-runtime-status" role="status">{progress||'Working…'}</div><button className="quiet-button" onClick={cancel}>Stop</button></>}
  {error&&<div className="speech-runtime-status" role="alert">{error}</div>}
 </section>;
}
