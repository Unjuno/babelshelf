import {useEffect,useRef,useState} from 'react';
import {KeyboardTextarea} from './mobile';
import type {CustomToolPackage} from './custom-tool-types';
import type {ToolHost} from './tools/tool-host';
import {testCustomTool,type ToolTestSource} from './custom-tool-test';

export function ToolTestPanel({pkg,sources,loadSources,ensureRuntime,host,close}:{pkg:CustomToolPackage;sources:ToolTestSource[];loadSources:()=>Promise<ToolTestSource[]>;ensureRuntime:()=>Promise<void>;host:Omit<ToolHost,'signal'|'check'>;close:()=>void}){
 const [input,setInput]=useState('{}'),[result,setResult]=useState<string|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const run=useRef<AbortController|null>(null);
 useEffect(()=>()=>{run.current?.abort();run.current=null;},[]);
 async function test(){
  if(run.current)return;const controller=new AbortController();run.current=controller;setBusy(true);setError('');setResult(null);
  const check=()=>{if(controller.signal.aborted)throw Error('Stopped');};
  try{const output=await testCustomTool({sources,input,loadSources,ensureRuntime,host:{...host,signal:controller.signal,check}});if(run.current===controller)setResult(JSON.stringify(output.value,null,2));}
  catch(reason){if(run.current===controller)setError(controller.signal.aborted?'Stopped':reason instanceof Error?reason.message:'Test failed');}
  finally{if(run.current===controller){run.current=null;setBusy(false);}}
 }
 return <div className="schedule-form creation-form"><div className="task-fields">
  <h3>{pkg.title}</h3><p className="source-revision">Read-only test · not saved or enabled</p>
  <p>{pkg.capabilities.length?`Local access: ${pkg.capabilities.join(', ')}`:'No declared access'}</p>
  <details><summary>Tool files & input format</summary>{sources.map(source=><details key={source.path}><summary>{source.path} · v{source.version}</summary><pre className="file-body">{source.body}</pre></details>)}<pre className="file-body">{JSON.stringify(pkg.inputSchema,null,2)}</pre></details>
  <label>Input · JSON<KeyboardTextarea aria-label="Test input" rows={4} maxLength={8000} disabled={busy} value={input} onChange={event=>{setInput(event.target.value);setResult(null);setError('');}}/></label>
  {error&&<div role="alert">{error}</div>}{result!==null&&<section aria-label="Test result"><h3>Result</h3><pre className="file-body">{result}</pre><p className="source-revision">This input only · review before use</p></section>}
 </div><div className="action-row"><button className="quiet-button" onClick={()=>{run.current?.abort();close();}}>Close</button>{busy?<button className="quiet-button" onClick={()=>run.current?.abort()}>Stop</button>:<button className="solid-button" onClick={()=>void test()}>Run test</button>}</div></div>;
}
