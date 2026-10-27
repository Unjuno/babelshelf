import {initializeOfflineShell,refreshAppVersion} from '../src/offline-shell';
import {recoverStartup} from './startup-recovery';
import {useRef,useState} from 'react';
import ReactDOM from 'react-dom/client';
import {NativeViewport} from './native-mobile';
import '../src/prototype.css';
import './product.css';
const root=ReactDOM.createRoot(document.getElementById('root')!);
function StartupRecovery(){
 const [status,setStatus]=useState(''),busy=useRef(false);
 async function update(){
  if(busy.current)return;busy.current=true;setStatus('Checking…');
  try{if(!('serviceWorker' in navigator))throw Error('App update unavailable');const container=navigator.serviceWorker;
   await recoverStartup({getRegistration:()=>container.getRegistration(),update:registration=>refreshAppVersion(registration,container),reload:()=>location.reload()});
  }catch{setStatus('Update failed · check connection and try again');}finally{busy.current=false;}
 }
 return <main style={{padding:'24px',fontFamily:'system-ui',color:'#172521'}}><h1>App unavailable</h1><button type="button" onClick={()=>void update()} style={{fontSize:'18px',minHeight:'48px',padding:'0 20px'}}>Update</button><p role="status">{status}</p></main>;
}
const check=new URLSearchParams(location.search).get('check');
if(import.meta.env.DEV&&check==='lfm')import('../src/LfmCheck').then(({default:LfmCheck})=>root.render(<LfmCheck/>));
else if(import.meta.env.DEV&&check==='harness')import('../src/HarnessCheck').then(({default:HarnessCheck})=>root.render(<HarnessCheck/>));
else if(import.meta.env.DEV&&check==='speech')import('../src/SpeechCheck').then(({default:SpeechCheck})=>root.render(<SpeechCheck/>));
else if(import.meta.env.DEV&&check==='decision')import('../src/DecisionCheck').then(({default:DecisionCheck})=>root.render(<DecisionCheck/>));
else void import('../src/Prototype').then(({default:Prototype})=>root.render(<div className="device-screen product-screen" id="app-screen" data-testid="device-screen"><div className="mobile-app-viewport"><NativeViewport><Prototype/></NativeViewport></div></div>)).catch(()=>root.render(<StartupRecovery/>));
// Keep the production cache worker out of Vite previews so it cannot mask current modules.
if(import.meta.env.PROD)void initializeOfflineShell('serviceWorker' in navigator?navigator.serviceWorker:undefined);
