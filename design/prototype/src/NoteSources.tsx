import {useEffect,useRef,useState} from 'react';
import {noteProvenance,type NoteProvenance,type SavedSourceRef} from './note-provenance';
import {PreviewSelection} from './preview-selection';

const label=(status:NoteProvenance['status'])=>status==='changed'?'Source changed':status==='removed'?'Source removed':status==='unavailable'?'Source unavailable':'';
/** Optional provenance disclosure; reading it never updates or regenerates a note. */
export function NoteSources({noteId,revision,count,snapshot,read,onInspect}:{noteId:string;revision:number;count:number;snapshot:unknown;read:()=>Promise<any[]>;onInspect:(ref:SavedSourceRef)=>void}){
 const reader=useRef(read);reader.current=read;const selection=useRef(new PreviewSelection());
 const [state,setState]=useState<{report:NoteProvenance|null;error:boolean}>({report:null,error:false});
 async function refresh(){
  setState({report:null,error:false});
  try{const report=await selection.current.load(async()=>noteProvenance(await reader.current(),noteId,revision));if(report)setState({report,error:false});}
  catch{setState({report:null,error:true});}
 }
 useEffect(()=>{void refresh();const focus=()=>{void refresh();};window.addEventListener('focus',focus);return()=>{selection.current.cancel();window.removeEventListener('focus',focus);};},[noteId,revision,snapshot]);
 const status=state.report?label(state.report.status):state.error?'Could not check sources':'Checking…';
 return <details className="note-sources" aria-label="Saved sources" onToggle={event=>{if(event.currentTarget.open)void refresh();}}>
  <summary><span>Sources</span> · {state.report?.items.length??count}{status&&<span className="note-source-state"> · {status}</span>}</summary>
  {state.error?<button className="quiet-button" onClick={()=>void refresh()}>Retry</button>:state.report?.items.length===0?<div className="source-revision">No saved sources</div>:state.report?.items.map((item,index)=><button key={index} className="source-link note-source-link" aria-label={'View saved source '+(index+1)} disabled={!item.historicalAvailable} onClick={()=>onInspect(item.ref)}><span>{item.path} · v{item.ref.revision}</span><small>{label(item.status)}{item.status==='changed'&&item.currentRevision!==item.ref.revision?' · Now v'+item.currentRevision:''}</small></button>)}
 </details>;
}
