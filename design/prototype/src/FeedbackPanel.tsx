import {useEffect,useState} from 'react';
import {KeyboardTextarea} from './mobile';

type FeedbackCategory='bug'|'idea'|'usability'|'other';

const endpoint=String(import.meta.env.VITE_FEEDBACK_API_URL??'https://babelshelf-feedback-api.unjuno-org.workers.dev/v1/feedback').trim();

export function FeedbackPanel({onlineMode}:{onlineMode:boolean}){
 const [category,setCategory]=useState<FeedbackCategory>('usability');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState('');
 const [networkOnline,setNetworkOnline]=useState(()=>navigator.onLine);
 useEffect(()=>{const update=()=>setNetworkOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
 const canSend=!!endpoint&&onlineMode&&networkOnline&&message.trim().length>0&&!busy;

 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!canSend)return;
  setBusy(true);setStatus('Sending…');
  try{
   const response=await fetch(endpoint,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({category,message:message.trim(),build:String(import.meta.env.VITE_APP_BUILD??'').slice(0,64)})});
   if(!response.ok)throw new Error('Feedback service unavailable');
   setMessage('');setStatus('Sent · saved for product development');
  }catch{setStatus('Could not send · try again when online');}
  finally{setBusy(false);}
 }

 return <section className="creation-form" aria-label="Feedback">
  <p className="source-revision">Tell us what worked or what should improve.</p>
  {!endpoint&&<p className="source-revision" role="status">Feedback service is not connected yet.</p>}
  {endpoint&&(!onlineMode||!networkOnline)&&<p className="source-revision" role="status">Connect and turn Online on to send.</p>}
  <form className="schedule-form" onSubmit={submit}>
   <label>Type
    <select aria-label="Feedback type" value={category} disabled={busy} onChange={event=>setCategory(event.target.value as FeedbackCategory)}>
     <option value="usability">Usability</option><option value="bug">Problem</option><option value="idea">Idea</option><option value="other">Other</option>
    </select>
   </label>
   <label>Message
    <KeyboardTextarea aria-label="Feedback message" rows={5} maxLength={2000} value={message} disabled={busy||!endpoint} onChange={event=>setMessage(event.target.value)} placeholder="What happened or what would help?"/>
   </label>
   <p className="source-revision">Your message and app build are sent to BabelShelf and stored for development. Do not include private notes or personal information. Nothing is sent until you tap Send feedback.</p>
   {status&&<p role="status">{status}</p>}
   <button className="solid-button" type="submit" disabled={!canSend}>{busy?'Sending…':'Send feedback'}</button>
  </form>
 </section>;
}
