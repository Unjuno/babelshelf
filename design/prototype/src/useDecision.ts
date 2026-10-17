import {useEffect,useRef,useState} from 'react';
import {DecisionClient} from './decision-control';
import type {DecisionQuestion} from './decision';
export function useDecision(enabled:boolean){
 const [ready,setReady]=useState(false),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[device,setDevice]=useState('');
 const epoch=useRef(0);const client=useRef<DecisionClient|null>(null);client.current??=new DecisionClient(()=>new Worker(new URL('./decision-worker.ts',import.meta.url),{type:'module'}),(active,text)=>{setBusy(active);if(text)setProgress(text);},()=>setLoaded(false));
 useEffect(()=>{++epoch.current;let alive=true;setReady(false);setLoaded(false);if(enabled)client.current!.call('status').then(value=>{if(alive){setReady(value.prepared);setLoaded(value.loaded);}}).catch(e=>{if(alive)setProgress(e.message);});return()=>{alive=false;++epoch.current;client.current!.dispose();};},[enabled]);
 const load=async()=>{const own=epoch.current;try{const result=await client.current!.call('load');if(own===epoch.current){setReady(result.prepared);setLoaded(result.loaded);setDevice(result.device);setProgress('Loaded');}return result;}catch(e){if(own===epoch.current)setLoaded(false);throw e;}};
 const unload=async()=>{const own=epoch.current;try{const result=client.current!.active?await client.current!.call('unload'):{loaded:false};if(own===epoch.current){setLoaded(false);setProgress('Unloaded');}return result;}catch(e){if(own===epoch.current){client.current!.dispose();setLoaded(false);}throw e;}};
 return {ready,loaded,busy,progress,device,load,unload,stop:()=>client.current!.stop(),prepare:async(allowNetwork:boolean)=>{const own=epoch.current,wasReady=ready;setReady(false);try{const result=await client.current!.call('prepare',{allowNetwork});if(own===epoch.current){setReady(result.prepared);setProgress('Verified');}return result;}catch(e){if(own===epoch.current&&(e as Error).message==='Stopped')setReady(wasReady);throw e;}},classify:(state:string,question:DecisionQuestion)=>client.current!.call('classify',{state,question})};
}
