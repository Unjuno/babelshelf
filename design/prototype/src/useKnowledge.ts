import {useEffect,useRef,useState} from 'react';
import {KnowledgeStore,type NoteView} from './knowledge-store';
export const knowledge=new KnowledgeStore();
export function useKnowledge(defaults:NoteView[]){
 const [notes,render]=useState(defaults),[ready,setReady]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
 const current=useRef(notes),queue=useRef(Promise.resolve()),count=useRef(0),lastWrite=useRef(Promise.resolve());
 useEffect(()=>{let active=true;knowledge.initialize(defaults).then(value=>{if(active){current.current=value;render(value);setReady(true);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 // Serialize functional updates against the last committed state. No optimistic Saved claim.
 function setNotes(change:NoteView[]|((notes:NoteView[])=>NoteView[])){
  count.current++;setPending(true);setError('');
  const written=queue.current.then(async()=>{
   try{const before=current.current,next=typeof change==='function'?change(before):change;
    const value=await knowledge.commit(before,next);current.current=value;render(value);
   }catch(e){setError((e as Error).message);try{const actual=await knowledge.views();current.current=actual;render(actual);}catch{}throw e;}
   finally{count.current--;setPending(count.current>0);}
  });
  lastWrite.current=written;queue.current=written.catch(()=>{});
 }
 async function flush(){const written=lastWrite.current;await queue.current;await written;}
 async function refreshSnapshot(){
  const previous=lastWrite.current,result=queue.current.then(async()=>{const value=await knowledge.views();current.current=value;render(value);if(lastWrite.current===previous)lastWrite.current=Promise.resolve();setError('');return value;});
  queue.current=result.then(()=>{},()=>{});return result;
 }
 async function refresh(){await refreshSnapshot();}
 return {notes,setNotes,ready,pending,error,flush,refresh,refreshSnapshot};
}
