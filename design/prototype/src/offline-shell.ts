export type OfflineShellStatus='Not prepared'|'Checking'|'Installing'|'Installed'|'Preparation failed'|'Unavailable';
let status:OfflineShellStatus='Not prepared';const listeners=new Set<()=>void>();
export const offlineShellStatus=()=>status;
/** Verify the active worker's cached shell without fetching or changing data. */
export async function checkOfflineAppShell(worker:Pick<ServiceWorker,'postMessage'>|null|undefined,timeoutMs=15000):Promise<'ready'|'missing'|'unknown'>{
 if(!worker||typeof MessageChannel==='undefined')return 'unknown';
 return new Promise(resolve=>{
  const channel=new MessageChannel();let done=false;
  const finish=(value:'ready'|'missing'|'unknown')=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(value);};
  const timer=setTimeout(()=>finish('unknown'),Math.max(0,timeoutMs));
  channel.port1.onmessage=event=>finish(event.data?.status==='ready'?'ready':event.data?.status==='missing'?'missing':'unknown');
  try{worker.postMessage({type:'check-app-shell'},[channel.port2]);}catch{finish('unknown');}
 });
}
type ShellHealth='ready'|'missing'|'unknown';
/** Latest check owns the display; late results cannot overwrite a retry or repair. */
export function createOfflineShellHealthProbe(check:()=>Promise<ShellHealth>,publish:(value:ShellHealth|'checking')=>void){
 let generation=0;
 return {async check(){const current=++generation;publish('checking');let value:ShellHealth;try{value=await check();}catch{value='unknown';}if(current===generation)publish(value);return value;},cancel(){generation++;}};
}
/** Reacquire missing pinned shell assets only after an explicit user action. */
export async function repairOfflineAppShell(worker:Pick<ServiceWorker,'postMessage'>|null|undefined,online:boolean,timeoutMs=120000):Promise<void>{
 if(!worker||typeof MessageChannel==='undefined'||typeof crypto==='undefined'||typeof crypto.randomUUID!=='function')throw Error('App repair unavailable · update app');
 const operationId=crypto.randomUUID();
 await new Promise<void>((resolve,reject)=>{
  const channel=new MessageChannel();let done=false;
  const finish=(error?:Error)=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close();channel.port2.close();error?reject(error):resolve();};
  const timer=setTimeout(()=>{try{worker.postMessage({type:'cancel-app-shell-repair',operationId});}catch{}finish(Error('App repair timed out · retry'));},Math.max(0,timeoutMs));
  channel.port1.onmessage=event=>finish(event.data?.status==='ready'?undefined:Error(event.data?.status==='offline'?'Select Online to repair app':event.data?.status==='disconnected'?'Connect to repair offline app':'App repair failed · update app or retry'));
  try{worker.postMessage({type:'repair-app-shell',operationId,localOnly:!online},[channel.port2]);}catch{finish(Error('App repair unavailable · update app'));}
 });
}
export function subscribeOfflineShell(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function report(next:OfflineShellStatus){status=next;for(const listener of listeners)listener();}
let initialization=0,stopObserving:(()=>void)|null=null;
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
export async function initializeOfflineShell(container:ServiceWorkerContainer|undefined,allowRegister=false){
 const current=++initialization;stopObserving?.();stopObserving=null;
 if(!container){report('Unavailable');return;}report('Checking');
 try{const existing=await container.getRegistration();if(current!==initialization)return;const registration=existing??(allowRegister?await container.register('./sw.js'):undefined);if(current!==initialization)return;if(!registration){report('Not prepared');return;}stopObserving=observeOfflineRegistration(registration,report);}catch{if(current===initialization)report('Preparation failed');}
}
/** Explicitly prepare the app shell while connected, without changing model-download mode. */
export async function prepareOfflineAppShell(container:ServiceWorkerContainer|undefined,online:boolean,timeoutMs=120000):Promise<void>{
 if(!container)throw Error('Offline app unavailable');
 if(!online)throw Error('Connect to prepare offline app');
 await initializeOfflineShell(container,true);
 await waitForOfflineShellInstallation(timeoutMs);
 if(!container.controller)await new Promise<void>((resolve,reject)=>{
  let done=false;const timer=setTimeout(()=>finish(Error('Offline app is not controlling this page · reopen app')),Math.max(0,timeoutMs));
  const finish=(error?:Error)=>{if(done)return;done=true;clearTimeout(timer);container.removeEventListener('controllerchange',changed);error?reject(error):resolve();};
  const changed=()=>{if(container.controller)finish();};
  container.addEventListener('controllerchange',changed);changed();
 });
}
function waitForOfflineShellInstallation(timeoutMs:number):Promise<void>{
 return new Promise((resolve,reject)=>{
  let done=false,stop=()=>{};const timer=setTimeout(()=>finish(Error('App preparation timed out · retry')),Math.max(0,timeoutMs));
  const finish=(error?:Error)=>{if(done)return;done=true;clearTimeout(timer);stop();error?reject(error):resolve();};
  const check=()=>{const current=offlineShellStatus();if(current==='Installed')finish();else if(current==='Preparation failed'||current==='Unavailable')finish(Error('App preparation failed · retry'));};
  stop=subscribeOfflineShell(check);check();
 });
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
