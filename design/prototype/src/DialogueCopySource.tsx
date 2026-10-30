import {useId,useMemo,useState} from 'react';
import {KeyboardInput} from './mobile';
import {dialogueTurnStatus,type Dialogue} from './conversation';
import {dialogueCopyPage,type DialogueCopyReview} from './dialogue-copy';

export function DialogueCopySource({dialogue,review,body,busy,onSelect}:{dialogue:Dialogue;review:DialogueCopyReview;body:string;busy:boolean;onSelect:(index:number,speaker:'user'|'assistant')=>boolean}){
 const [expanded,setExpanded]=useState(false),[query,setQuery]=useState(''),[page,setPage]=useState(0),id=useId();
 const result=useMemo(()=>expanded?dialogueCopyPage(dialogue,review,query,page):{items:[],hasMore:false},[expanded,dialogue,review,query,page]);
 const turn=dialogue.turns[review.source.turnIndex],status=review.source.speaker==='assistant'&&turn?.id===review.source.turnId?dialogueTurnStatus(turn):undefined;
 const partial=status==='Partial · incomplete inspection'||status==='Source excerpt · partial answer';
 return <fieldset className="dialogue-copy-source"><legend>Source</legend>
  <div className="copy-source-summary"><span>{review.source.speaker==='assistant'?'Answer':'Your message'}<small className="source-revision" role="status">{body===review.source.quote?'Original copy':'Edited copy'}</small></span><button type="button" className="quiet-button" aria-label="Change source" aria-expanded={expanded} aria-controls={id} disabled={busy} onClick={()=>setExpanded(value=>!value)}>Change</button></div>
  {partial&&<div className="source-revision" role="status">Partial answer</div>}
  {expanded&&<div id={id} className="copy-source-picker">
   <KeyboardInput type="search" aria-label="Find message" placeholder="Find message…" maxLength={200} value={query} disabled={busy} onChange={event=>{setQuery(event.target.value);setPage(0);}} onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing)event.preventDefault();}}/>
   <div className="model-options" role="group" aria-label="Source messages">{result.items.map(item=>{const label=item.speaker==='assistant'?'Answer':'Your message';return <button type="button" className="model-choice" key={item.turnId+':'+item.speaker} aria-label={label+' · '+item.preview} aria-pressed={item.selected} disabled={busy} onClick={()=>{if(onSelect(item.index,item.speaker)){setExpanded(false);setQuery('');setPage(0);}}}><span><strong>{label}</strong><small>{item.preview||'Empty message'}</small></span></button>;})}</div>
   {!result.items.length&&<div className="source-revision" role="status">No matching messages</div>}
   <div className="action-row">{page>0&&<button type="button" className="quiet-button" disabled={busy} onClick={()=>setPage(value=>value-1)}>Newer messages</button>}{result.hasMore&&<button type="button" className="quiet-button" disabled={busy} onClick={()=>setPage(value=>value+1)}>Older messages</button>}</div>
  </div>}
 </fieldset>;
}
