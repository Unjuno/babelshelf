// Asset-independent recovery: this document must work when every app cache is
// gone. Its explicit actions acquire only the pinned, same-origin app shell.
import {createHash} from 'node:crypto';

function recoveryClient(){
 const status=document.getElementById('status'),buttons=[...document.querySelectorAll('button')];
 let busy=false;
 const timeout=120000;
 function request(worker,data){
  return new Promise((resolve,reject)=>{
   const channel=new MessageChannel();
   const finish=(error,value)=>{clearTimeout(timer);channel.port1.close();error?reject(error):resolve(value);};
   const timer=setTimeout(()=>{
    try{worker.postMessage({type:'cancel-app-shell-repair',operationId:data.operationId});}catch{}
    finish(Error('Repair timed out. Check your connection and retry.'));
   },timeout);
   channel.port1.onmessage=event=>finish(null,event.data);
   try{worker.postMessage(data,[channel.port2]);}catch(error){finish(error);}
  });
 }
 async function repair(){
  const worker=navigator.serviceWorker.controller;
  if(!worker)throw Error('App worker unavailable. Reload this page and retry.');
  status.textContent='Repairing app…';
  const result=await request(worker,{type:'recover-app-shell',operationId:crypto.randomUUID(),localOnly:false});
  if(result.status!=='ready')throw Error('Repair failed. Check your connection and available storage, or try Update app online.');
  location.reload();
 }
 async function update(){
  status.textContent='Checking for an app update…';
  const container=navigator.serviceWorker,registration=await container.getRegistration();
  if(!registration)throw Error('App worker unavailable. Reload this page and retry.');
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Update timed out. Check your connection and retry.')),timeout);
   registration.update().then(resolve,reject).finally(()=>clearTimeout(timer));
  });
  if(registration.installing){
   status.textContent='Preparing app update…';
   await new Promise((resolve,reject)=>{
    const worker=registration.installing;
    const finish=error=>{clearTimeout(timer);worker.removeEventListener('statechange',check);error?reject(error):resolve();};
    const check=()=>{if(worker.state==='installed'||worker.state==='activated')finish();else if(worker.state==='redundant')finish(Error('Update failed. Check your connection and retry.'));};
    const timer=setTimeout(()=>finish(Error('Update timed out. Check your connection and retry.')),timeout);
    worker.addEventListener('statechange',check);check();
   });
  }
  const waiting=registration.waiting;
  if(waiting){
   await new Promise((resolve,reject)=>{
    const finish=error=>{clearTimeout(timer);container.removeEventListener('controllerchange',check);error?reject(error):resolve();};
    const check=()=>{if(container.controller===waiting)finish();};
    const timer=setTimeout(()=>finish(Error('Update activation timed out. Reload this page and retry.')),30000);
    container.addEventListener('controllerchange',check);waiting.postMessage({type:'activate-update'});check();
   });
  }
  // An unchanged server build can still have lost its cache. Repair it using
  // the same explicit app-only permission instead of reloading into a loop.
  await repair();
 }
 async function run(action){
  if(busy)return;
  if(!navigator.onLine){status.textContent='Connect to the internet, then retry. Your saved data stays on this device.';return;}
  busy=true;buttons.forEach(button=>{button.disabled=true;});
  try{await action();}catch(error){status.textContent=error instanceof Error?error.message:'Repair failed. Please retry.';}
  finally{busy=false;buttons.forEach(button=>{button.disabled=false;});}
 }
 document.getElementById('repair').addEventListener('click',()=>void run(repair));
 document.getElementById('update').addEventListener('click',()=>void run(update));
 if(!navigator.onLine)status.textContent='Connect to the internet to repair the app.';
}

// HTML parsing normalizes CRLF before CSP hashing, including on Windows builds.
const script=('('+recoveryClient.toString()+')();').replace(/\r\n/g,'\n');
export const recoveryCSP="default-src 'none'; script-src 'sha256-"+createHash('sha256').update(script).digest('base64')+"'; style-src 'unsafe-inline'; worker-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export const recoveryDocument=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f7f4ed"><title>Repair app · BabelShelf</title><style>
*{box-sizing:border-box}html{background:#f7f4ed;color:#242a26;font:17px/1.55 system-ui,sans-serif}body{margin:0}main{max-width:670px;margin:0 auto;padding:max(36px,env(safe-area-inset-top)) 24px max(36px,env(safe-area-inset-bottom));overflow-wrap:anywhere}h1{font-size:28px;font-weight:600;line-height:1.2;margin:30px 0 18px}p{margin:16px 0}small{font-size:14px}nav{display:flex;flex-wrap:wrap;gap:12px;margin:28px 0 20px}button{font:inherit;font-weight:600;min-height:48px;padding:12px 18px;border:1px solid #73796b;border-radius:8px;color:#242a26;background:#fffdf8;cursor:pointer}button:first-child{background:#2d493c;border-color:#2d493c;color:#fff}button:focus-visible{outline:3px solid #ae742b;outline-offset:3px}button:disabled{opacity:.65;cursor:wait}#status{min-height:3em}noscript{display:block;margin:20px 0}
</style></head><body><main><h1>Repair app</h1><p>Some app files are missing or unreadable.</p><p>Get the app online to continue. Saved notes, chats and settings stay on this device.</p><nav aria-label="App recovery"><button id="repair" type="button">Repair app online</button><button id="update" type="button">Update app online</button></nav><p id="status" role="status" aria-live="polite"></p><small>Only app files are downloaded. Your model download setting is unchanged.</small><noscript>Enable JavaScript to use the repair controls.</noscript></main><script>${script}</script></body></html>`;
