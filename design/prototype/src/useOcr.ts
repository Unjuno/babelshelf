import {useEffect,useRef,useState} from 'react';
import {ocrReady,prepareOcr,type OcrLanguage} from './ocr-assets';
export function useOcr(language:OcrLanguage,enabled:boolean){
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[checking,setChecking]=useState(false),[progress,setProgress]=useState('');
 const lock=useRef(false),epoch=useRef(0),controller=useRef<AbortController|null>(null);
 const selection=useRef({language,enabled}),verified=useRef<typeof selection.current|null>(null);
 if(selection.current.language!==language||selection.current.enabled!==enabled)selection.current={language,enabled};
 const selected=selection.current;
 useEffect(()=>{
  let alive=true;const ticket=++epoch.current;setReady(false);verified.current=null;
  if(!enabled){setChecking(false);return;}
  setChecking(true);
  ocrReady(language).then(value=>{if(alive&&ticket===epoch.current&&selection.current===selected){verified.current=value?selected:null;setReady(value);setChecking(false);}});
  return()=>{alive=false;controller.current?.abort(new DOMException('Image reader selection changed','AbortError'));};
 },[language,enabled]);
 useEffect(()=>()=>controller.current?.abort(new DOMException('Stopped','AbortError')),[]);
 return {ready:ready&&enabled&&verified.current===selected,busy,checking,progress,stop:()=>controller.current?.abort(new DOMException('Stopped','AbortError')),prepare:async(allowNetwork:boolean,requested:OcrLanguage)=>{
  if(selection.current!==selected||requested!==selected.language)throw Error('Image reader selection changed');
  if(lock.current)throw Error('Image reader busy');
  lock.current=true;++epoch.current;setChecking(false);setBusy(true);setReady(false);verified.current=null;
  const active=new AbortController();controller.current=active;
  try{
   await prepareOcr(requested,allowNetwork,active.signal,text=>{if(selection.current===selected)setProgress(text);});
   if(selection.current!==selected)throw Error('Image reader selection changed');
   active.signal.throwIfAborted();verified.current=selected;setReady(true);setProgress('Verified');
  }catch(e){if(selection.current===selected)setProgress((e as Error).message);throw e;}
  finally{if(controller.current===active)controller.current=null;lock.current=false;setBusy(false);}
 }};
}
