import {useEffect,useState} from 'react';
import {DEFAULT_TEXT_GENERATION_IDLE_TIMEOUT_MS} from './isolated-text-client';
import {elapsedDurationLabel,modelStepElapsedSeconds,type LiveTextWorkReceipt} from './live-text-work';
export type TextWork=LiveTextWorkReceipt;

/** Transient work is kept separate from completed, persisted model receipts. */
export function LiveTextWork({work,backend,maxTokens,maxMs,operationStartedAt,operationLabel}:{work:TextWork;backend?:string;maxTokens?:number|null;maxMs?:number|null;operationStartedAt?:number;operationLabel?:string}){
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const elapsed=modelStepElapsedSeconds(now,work.startedAt);
 const operationElapsed=operationStartedAt===undefined?undefined:modelStepElapsedSeconds(now,operationStartedAt);
 return <section className="live-text-work" aria-label="Current model work">
  <div role="status">{work.kind==='generate'?'Text model call in progress':'Counting prompt tokens'} · {work.phase}</div>
  <div className="source-revision">{backend?.replace(/^Loaded · /,'')??'Local model'} · This model step · {elapsedDurationLabel(elapsed)} elapsed{operationElapsed===undefined?'':` · ${operationLabel??'Operation'} total · ${elapsedDurationLabel(operationElapsed)}`}</div>
  {work.kind==='generate'&&<div className="source-revision">{maxTokens==null&&maxMs==null?'No custom generation limit':[maxTokens!=null?`${maxTokens} tokens`:null,maxMs!=null?`${Math.ceil(maxMs/1000)}s generation time`:null].filter(Boolean).join(' · ')} · Stop anytime. Stops after {DEFAULT_TEXT_GENERATION_IDLE_TIMEOUT_MS/60000} minutes without generation progress.</div>}
 </section>;
}
