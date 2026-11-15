import {useState} from 'react';
import type {ConversationSessions} from './conversation-sessions';

export function ConversationSessionsSheet({sessions,busy,canSwitch,onCreate,onSelect,onRename,onDelete,onClose}:{sessions:ConversationSessions;busy:boolean;canSwitch:boolean;onCreate:()=>void;onSelect:(id:string)=>void;onRename:(id:string,name:string)=>void;onDelete:(id:string,replacementId?:string)=>void;onClose:()=>void}){
 const [renameId,setRenameId]=useState<string|null>(null),[renameValue,setRenameValue]=useState(''),[deleteId,setDeleteId]=useState<string|null>(null),[replacementId,setReplacementId]=useState(''),[error,setError]=useState('');
 const startRename=(id:string,name:string)=>{setError('');setDeleteId(null);setRenameId(id);setRenameValue(name);};
 return <section className="conversation-sessions-sheet" aria-label="Conversations">
  <p className="source-revision">Each conversation keeps its own messages and input file. Saved Memory files are shared.</p>
  {!canSwitch&&<p role="status">Clear the current draft and remove unsent attachments before changing conversations.</p>}
  <button className="solid-button" disabled={busy||!canSwitch||sessions.sessions.length>=1000} onClick={onCreate}>New conversation</button>
  <div className="conversation-session-list">{sessions.sessions.map(session=><article className="conversation-session-row" key={session.id}>
   {renameId===session.id?<form className="conversation-session-rename" onSubmit={event=>{event.preventDefault();if(!renameValue.trim()){setError('Enter a conversation name');return;}onRename(session.id,renameValue);setRenameId(null);}}>
    <label>Name<input aria-label="Conversation name" maxLength={80} autoFocus value={renameValue} onChange={event=>setRenameValue(event.target.value)}/></label><div className="action-row"><button type="button" className="quiet-button" onClick={()=>setRenameId(null)}>Cancel</button><button className="solid-button" disabled={busy}>Save name</button></div>
   </form>:<><div className="conversation-session-title"><strong>{session.name}</strong>{session.id===sessions.activeId&&<small>Current</small>}</div><div className="action-row">
    {session.id!==sessions.activeId&&<button className="quiet-button" disabled={busy||!canSwitch} onClick={()=>onSelect(session.id)}>Open</button>}
    <button className="quiet-button" disabled={busy} onClick={()=>startRename(session.id,session.name)}>Rename</button>
    <button className="quiet-button danger-button" disabled={busy} onClick={()=>{setError('');setRenameId(null);setDeleteId(deleteId===session.id?null:session.id);setReplacementId(sessions.sessions.find(item=>item.id!==session.id)?.id??'');}}>Delete</button>
   </div>{deleteId===session.id&&<div className="conversation-session-delete" role="group" aria-label={'Delete '+session.name}>
    <p>This permanently deletes this conversation and its messages. Saved Memory files remain.</p>
    {session.id===sessions.activeId&&<label>Open after deletion<select aria-label="Replacement conversation" value={replacementId} onChange={event=>setReplacementId(event.target.value)}>{sessions.sessions.filter(item=>item.id!==session.id).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    <div className="action-row"><button className="quiet-button" disabled={busy} onClick={()=>setDeleteId(null)}>Cancel</button><button className="quiet-button danger-button" disabled={busy||sessions.sessions.length===1||session.id===sessions.activeId&&!replacementId} onClick={()=>onDelete(session.id,session.id===sessions.activeId?replacementId:undefined)}>Delete conversation</button></div>
   </div>}</>}
  </article>)}</div>
  {error&&<p role="alert">{error}</p>}
  <div className="action-row"><button className="quiet-button" disabled={busy} onClick={onClose}>Close</button></div>
 </section>;
}
