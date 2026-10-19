import {useEffect,useRef,useState} from 'react';
import {VisionClient} from './vision-control';

export function useVision(model:string){
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
 const client=useRef<VisionClient|null>(null);client.current??=new VisionClient(()=>new Worker(new URL('./vision-worker.ts',import.meta.url),{type:'module'}),(active,text)=>{setBusy(active);if(text)setProgress(text);});
 useEffect(()=>{let alive=true;if(model!=='lfm25-vl-450m-q4f16'){setReady(false);return()=>{alive=false;};}setReady(false);client.current!.call('status').then(value=>{if(alive)setReady(value.ready===true);}).catch(()=>{if(alive)setReady(false);});return()=>{alive=false;client.current!.stop();};},[model]);
 return {ready,busy,progress,stop:()=>client.current!.stop(),prepare:async(allowNetwork:boolean)=>{if(model!=='lfm25-vl-450m-q4f16')throw Error('Vision model not configured');setReady(false);await client.current!.call('prepare',{allowNetwork});setReady(true);setProgress('Verified');},describe:async(image:Blob,prompt:string)=>{if(!ready)throw Error('Vision model not prepared');return client.current!.call('describe',{image,prompt});}};
}
