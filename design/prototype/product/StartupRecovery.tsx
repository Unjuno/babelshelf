import {useRef,useState} from 'react';
import {refreshAppVersion} from '../src/offline-shell';
import {recoverStartup} from './startup-recovery';

export function StartupRecovery({message='App unavailable'}:{message?:string}){
 const [status,setStatus]=useState(''),busy=useRef(false);
 async function update(){
  if(busy.current)return;busy.current=true;setStatus('Checking…');
  try{if(!('serviceWorker' in navigator))throw Error('App update unavailable');const container=navigator.serviceWorker;
   await recoverStartup({getRegistration:()=>container.getRegistration(),update:registration=>refreshAppVersion(registration,container),reload:()=>location.reload()});
  }catch{setStatus('Update failed · check connection and try again');}finally{busy.current=false;}
 }
 return <main style={{padding:'24px',fontFamily:'system-ui',color:'#172521'}}><h1>{message}</h1><button type="button" onClick={()=>void update()} style={{fontSize:'18px',minHeight:'48px',padding:'0 20px'}}>Update</button><p role="status">{status}</p></main>;
}
