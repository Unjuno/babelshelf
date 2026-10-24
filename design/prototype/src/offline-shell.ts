export type OfflineShellStatus='Not prepared'|'Checking'|'Installing'|'Installed'|'Preparation failed'|'Unavailable';
let status:OfflineShellStatus='Not prepared';const listeners=new Set<()=>void>();
export const offlineShellStatus=()=>status;
export function subscribeOfflineShell(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function report(next:OfflineShellStatus){status=next;for(const listener of listeners)listener();}
// Installed describes worker lifecycle only, never model readiness or durable
// offline certification. Failed updates do not invalidate an existing worker.
export function observeOfflineRegistration(registration:ServiceWorkerRegistration,publish:(status:OfflineShellStatus)=>void){
 const observed=new Set<ServiceWorker>();let stopped=false;
 const refresh=()=>{if(stopped)return;const worker=registration.installing??registration.waiting;
  if(worker&&!observed.has(worker)){observed.add(worker);worker.addEventListener('statechange',refresh);}
  // During skipWaiting, browsers may clear waiting before assigning active.
  // Keep observing the same new worker instead of treating that handoff as a
  // failed first install.
  const handoff=[...observed].find(candidate=>candidate.state==='activated'||candidate.state==='activating'||candidate.state==='installed');
  publish(registration.active?.state==='activated'||handoff?.state==='activated'?'Installed':worker&&worker.state!=='redundant'||handoff?'Installing':'Preparation failed');
 };
 registration.addEventListener('updatefound',refresh);refresh();return()=>{stopped=true;registration.removeEventListener('updatefound',refresh);for(const worker of observed)worker.removeEventListener('statechange',refresh);};
}
export async function initializeOfflineShell(container:ServiceWorkerContainer|undefined){
 if(!container){report('Unavailable');return;}report('Checking');
 try{const registration=await container.getRegistration()??await container.register('./sw.js');observeOfflineRegistration(registration,report);}catch{report('Preparation failed');}
}
const updateTimeout=()=>Error('Update timed out · try again');
async function boundedUpdateCheck(check:Promise<unknown>,timeoutMs:number){
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{await Promise.race([check,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(updateTimeout()),Math.max(0,timeoutMs));})]);}
 finally{clearTimeout(timer);}
}
export async function appUpdateOutcome(registration:ServiceWorkerRegistration,timeoutMs=120000):Promise<'Update ready'|'Up to date'>{
 const worker=registration.installing;
 if(worker)await new Promise<void>((resolve,reject)=>{
  const finish=(error?:Error)=>{clearTimeout(timer);worker.removeEventListener('statechange',settle);error?reject(error):resolve();};
  const settle=()=>{if(['installed','activated','redundant'].includes(worker.state))finish(worker.state==='redundant'?Error('Update verification failed'):undefined);};
  const timer=setTimeout(()=>finish(updateTimeout()),Math.max(0,timeoutMs));
  worker.addEventListener('statechange',settle);settle();
 });
 if(registration.waiting?.state==='installed')return 'Update ready';
 if(registration.active?.state==='activated')return 'Up to date';
 throw Error('App cache not prepared');
}

export async function activateWaitingUpdate(registration:ServiceWorkerRegistration,container:ServiceWorkerContainer,timeoutMs=30000):Promise<void>{
 const worker=registration.waiting;
 if(!worker||worker.state!=='installed')throw Error('Update no longer ready · check again');
 await new Promise<void>((resolve,reject)=>{
  let timer:ReturnType<typeof setTimeout>;
  const finish=(error?:Error)=>{clearTimeout(timer);worker.removeEventListener('statechange',check);container.removeEventListener('controllerchange',check);error?reject(error):resolve();};
  const check=()=>{
   if(worker.state==='redundant')finish(Error('Update activation failed'));
   else if(worker.state==='activated'&&container.controller===worker)finish();
  };
  worker.addEventListener('statechange',check);container.addEventListener('controllerchange',check);
  timer=setTimeout(()=>finish(Error('Update activation not confirmed · reopen app to check')),timeoutMs);
  try{worker.postMessage({type:'activate-update'});check();}catch(error){finish(error instanceof Error?error:Error('Update activation failed'));}
 });
}

export async function refreshAppVersion(registration:ServiceWorkerRegistration,container:ServiceWorkerContainer,timeoutMs=120000):Promise<'Updated'|'Up to date'>{
 // Timeout releases the UI, not the browser-owned installation. A later
 // explicit refresh may finish applying that same verified worker.
 const deadline=Date.now()+timeoutMs,remaining=()=>Math.max(0,deadline-Date.now());
 await boundedUpdateCheck(registration.update(),remaining());
 const outcome=await appUpdateOutcome(registration,remaining());
 if(outcome==='Update ready')await activateWaitingUpdate(registration,container,remaining());
 return outcome==='Update ready'?'Updated':'Up to date';
}

// This reports the worker controlling the current page, not the newest build
// on the server. Keep it in opt-in diagnostics so a stale client is visible.
export async function activeAppBuild(container:Pick<ServiceWorkerContainer,'controller'>,timeoutMs=2000):Promise<string>{
 const worker=container.controller;if(!worker)return 'Unavailable';
 return new Promise(resolve=>{
  const channel=new MessageChannel();let settled=false;
  const finish=(value:string)=>{if(settled)return;settled=true;clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(value);};
  const timer=setTimeout(()=>finish('Unknown'),timeoutMs);
  channel.port1.onmessage=event=>finish(typeof event.data?.build==='string'&&/^[a-f0-9]{16}$/.test(event.data.build)?event.data.build:'Unknown');
  try{worker.postMessage('build',[channel.port2]);}catch{finish('Unknown');}
 });
}

// Called only after the canonical Offline preference commits. Acknowledgement
// distinguishes enforcement by this controller from an old/uncontrolled page.
export async function enforceOfflineNetwork(worker:Pick<ServiceWorker,'postMessage'>|null|undefined,timeoutMs=5000):Promise<boolean>{
 if(!worker)return false;
 return new Promise(resolve=>{
  const channel=new MessageChannel();let settled=false;
  const finish=(value:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(value);};
  const timer=setTimeout(()=>finish(false),timeoutMs);
  channel.port1.onmessage=event=>finish(event.data?.offline===true);
  try{worker.postMessage({type:'network-offline'},[channel.port2]);}catch{finish(false);}
 });
}
