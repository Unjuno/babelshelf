import {useEffect,useRef,useState} from 'react';
import {SpeechClient} from './speech-control';
export function useSpeech(){
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
 const client=useRef<SpeechClient|null>(null);client.current??=new SpeechClient(()=>new Worker(new URL('./speech-worker.ts',import.meta.url),{type:'module'}),(active,text)=>{setBusy(active);if(text)setProgress(text);});
 useEffect(()=>{let alive=true;client.current!.call('status').then(value=>{if(alive)setReady(value);}).catch(()=>{if(alive)setReady(false);});return()=>{alive=false;client.current!.stop();};},[]);
 return {ready,busy,progress,stop:()=>client.current!.stop(),prepare:async(allowNetwork:boolean)=>{setReady(false);await client.current!.call('prepare',{allowNetwork});setReady(true);setProgress('Verified');},transcribe:async(samples:Float32Array,language:string)=>client.current!.call('transcribe',{samples,language})};
}
