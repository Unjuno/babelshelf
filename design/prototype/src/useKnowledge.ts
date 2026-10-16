import {useEffect,useRef,useState} from 'react';
import {KnowledgeStore,type NoteView} from './knowledge-store';
export const knowledge=new KnowledgeStore();
export function useKnowledge(defaults:NoteView[]){
 const [notes,render]=useState(defaults),[ready,setReady]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
 const current=useRef(notes),queue=useRef(Promise.resolve()),count=useRef(0),lastError=useRef<Error|null>(null);
 useEffect(()=>{let active=true;knowledge.initialize(defaults).then(value=>{if(active){current.current=value;render(value);setReady(true);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 // Serialize functional updates against the last committed state. No optimistic Saved claim.
 function setNotes(change:NoteView[]|((notes:NoteView[])=>NoteView[])){
  count.current++;setPending(true);setError('');lastError.current=null;
  queue.current=queue.current.then(async()=>{
   lastError.current=null;try{const before=current.current,next=typeof change==='function'?change(before):change;
    const value=await knowledge.commit(before,next);current.current=value;render(value);
   }catch(e){lastError.current=e as Error;setError((e as Error).message);try{const actual=await knowledge.views();current.current=actual;render(actual);}catch{}}
   finally{count.current--;setPending(count.current>0);}
  });
 }
 async function flush(){await queue.current;if(lastError.current)throw lastError.current;}
 async function refresh(){await queue.current;const value=await knowledge.views();current.current=value;render(value);lastError.current=null;setError('');}
 return {notes,setNotes,ready,pending,error,flush,refresh};
}
