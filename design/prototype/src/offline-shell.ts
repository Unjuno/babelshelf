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
  publish(registration.active?.state==='activated'?'Installed':worker&&worker.state!=='redundant'?'Installing':'Preparation failed');
 };
 registration.addEventListener('updatefound',refresh);refresh();return()=>{stopped=true;registration.removeEventListener('updatefound',refresh);for(const worker of observed)worker.removeEventListener('statechange',refresh);};
}
export async function initializeOfflineShell(container:ServiceWorkerContainer|undefined){
 if(!container){report('Unavailable');return;}report('Checking');
 try{const registration=await container.getRegistration()??await container.register('./sw.js');observeOfflineRegistration(registration,report);}catch{report('Preparation failed');}
}
