import {useEffect,useRef,useState} from 'react';
import {SpeechClient} from './speech-control';
import type {CustomSpeechModel} from './preference-records.ts';
export function useSpeech(model:string='whisper-tiny',customModels:readonly CustomSpeechModel[]=[],beforeTranscribe?:(check:()=>void)=>Promise<void>){
 const before=useRef(beforeTranscribe);before.current=beforeTranscribe;
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
 const client=useRef<SpeechClient|null>(null);client.current??=new SpeechClient(()=>new Worker(new URL('./speech-worker.ts',import.meta.url),{type:'module'}),(active,text)=>{setBusy(active);if(text)setProgress(text);},async check=>{check();await before.current?.(check);check();});
 const custom=customModels.find(item=>item.id===model);
 useEffect(()=>{let alive=true;if(!model){setReady(false);return()=>{alive=false;};}setReady(false);client.current!.call('status',{model,custom}).then(value=>{if(alive)setReady(value);}).catch(()=>{if(alive)setReady(false);});return()=>{alive=false;client.current!.stop();};},[model,custom?.revision]);
 return {ready,busy,progress,stop:()=>client.current!.stop(),prepare:async(allowNetwork:boolean)=>{if(!model)throw Error('Speech model not configured');setReady(false);await client.current!.call('prepare',{allowNetwork,model,custom});setReady(true);setProgress('Verified');},transcribe:async(samples:Float32Array,language:string)=>client.current!.call('transcribe',{samples,language,model,custom})};
}
