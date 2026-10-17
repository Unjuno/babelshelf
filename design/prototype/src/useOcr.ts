import {useEffect,useRef,useState} from 'react';
import {ocrReady,prepareOcr,type OcrLanguage} from './ocr-assets';
export function useOcr(language:OcrLanguage,enabled:boolean){
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[checking,setChecking]=useState(false),[progress,setProgress]=useState('');const lock=useRef(false),epoch=useRef(0),controller=useRef<AbortController|null>(null),selected=useRef(language);selected.current=language;
 useEffect(()=>{let alive=true;const ticket=++epoch.current;setReady(false);if(!enabled){setChecking(false);return;}setChecking(true);ocrReady(language).then(value=>{if(alive&&ticket===epoch.current){setReady(value);setChecking(false);}});return()=>{alive=false;};},[language,enabled]);
 useEffect(()=>()=>controller.current?.abort(new DOMException('Stopped','AbortError')),[]);
 return {ready,busy,checking,progress,stop:()=>controller.current?.abort(new DOMException('Stopped','AbortError')),prepare:async(allowNetwork:boolean,requested:OcrLanguage)=>{if(lock.current)throw Error('Image reader busy');lock.current=true;++epoch.current;setChecking(false);setBusy(true);setReady(false);const active=new AbortController();controller.current=active;try{await prepareOcr(requested,allowNetwork,active.signal,setProgress);if(selected.current===requested)setReady(true);setProgress('Verified');}catch(e){setProgress((e as Error).message);throw e;}finally{if(controller.current===active)controller.current=null;lock.current=false;setBusy(false);}}};
}
