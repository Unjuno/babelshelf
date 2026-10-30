const prefix='babelshelf.model-cleanup.v1:';
const namePattern=/^download-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.gguf$/;
type MarkerStorage=Pick<Storage,'length'|'key'|'getItem'|'setItem'|'removeItem'>;
const leasePrefix='babelshelf.model-staging.v1:';
const lockName=(name:string)=>leasePrefix+name;

/** Hold the exact file lease until its review/import and cleanup have finished. */
export async function acquireStagingLease(name:string,markers:MarkerStorage,locks:LockManager):Promise<()=>Promise<void>>{
 if(!namePattern.test(name))throw Error('Invalid staging file');
 let release!:()=>void,ready!:()=>void,fail!:(error:unknown)=>void;
 const held=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>((resolve,reject)=>{ready=resolve;fail=reject;});
 const request=locks.request(lockName(name),async()=>{
  try{markers.setItem(leasePrefix+name,'1');if(markers.getItem(leasePrefix+name)!=='1')throw Error('Staging record unavailable');ready();await held;}
  catch(error){fail(error);throw error;}
 });
 request.catch(fail);
 try{await started;}catch(error){await request.catch(()=>{});throw error;}
 return async()=>{release();await request;};
}

export function forgetStagingLease(name:string,markers:MarkerStorage){if(namePattern.test(name))markers.removeItem(leasePrefix+name);}
export function leasedStagingNames(markers:MarkerStorage):string[]{
 const names:string[]=[];for(let i=0;i<markers.length;i++){const key=markers.key(i);if(key?.startsWith(leasePrefix)){const name=key.slice(leasePrefix.length);if(namePattern.test(name)&&markers.getItem(key)==='1')names.push(name);}}return names;
}

/** Recovery is explicit and skips any lease held by another live tab. */
export async function retryLeasedStaging(markers:MarkerStorage,storage:StorageManager,locks:LockManager):Promise<{removed:number;pending:number}>{
 let removed=0,pending=0;
 for(const name of leasedStagingNames(markers))await locks.request(lockName(name),{ifAvailable:true},async lock=>{
  if(!lock){pending++;return;}
  try{const root=await storage.getDirectory();try{const dir=await root.getDirectoryHandle('model-download-staging');try{await dir.removeEntry(name);}catch(error){if((error as Error)?.name!=='NotFoundError')throw error;}}catch(error){if((error as Error)?.name!=='NotFoundError')throw error;}forgetFailedStaging(name,markers);forgetStagingLease(name,markers);removed++;}catch{pending++;}
 });
 return {removed,pending};
}

/** Only record a named, completed download after its own cleanup failed. */
export function rememberFailedStaging(name:string,markers:MarkerStorage):boolean{
 if(!namePattern.test(name))return false;
 try{markers.setItem(prefix+name,'1');return markers.getItem(prefix+name)==='1';}catch{return false;}
}
export function forgetFailedStaging(name:string,markers:MarkerStorage):void{
 if(!namePattern.test(name))return;
 try{markers.removeItem(prefix+name);}catch{/* Keep a stale marker if storage is unavailable. */}
}
export function failedStagingNames(markers:MarkerStorage):string[]{
 try{const names:string[]=[];for(let i=0;i<markers.length;i++){const key=markers.key(i);if(key?.startsWith(prefix)){const name=key.slice(prefix.length);if(namePattern.test(name)&&markers.getItem(key)==='1')names.push(name);}}return names;}catch{throw Error('Cleanup records unavailable');}
}
/** Explicit retry touches only previously marked generated names in our staging folder. */
export async function retryFailedStaging(markers:MarkerStorage,storage:StorageManager):Promise<{removed:number;failed:number}>{
 const names=failedStagingNames(markers).filter(name=>markers.getItem(leasePrefix+name)!=='1');if(!names.length)return {removed:0,failed:0};
 const root=await storage.getDirectory();let directory:FileSystemDirectoryHandle;
 try{directory=await root.getDirectoryHandle('model-download-staging');}catch(error){if((error as Error)?.name!=='NotFoundError')throw error;for(const name of names)forgetFailedStaging(name,markers);return {removed:names.length,failed:0};}
 let removed=0,failed=0;
 for(const name of names)try{await directory.removeEntry(name);forgetFailedStaging(name,markers);removed++;}catch(error){if((error as Error)?.name==='NotFoundError'){forgetFailedStaging(name,markers);removed++;}else failed++;}
 return {removed,failed};
}

/** Retry persisted names first so a duplicate session callback sees an absent file. */
export async function retrySessionStaging(callbacks:readonly (()=>Promise<void>)[],markers:MarkerStorage,storage:StorageManager):Promise<{pending:(()=>Promise<void>)[];failed:boolean}>{
 const locks=globalThis.navigator?.locks;
 if(locks)try{await retryLeasedStaging(markers,storage,locks);}catch{/* Retain markers for an explicit retry. */}
 try{await retryFailedStaging(markers,storage);}catch{/* Check again after attempting session callbacks. */}
 const pending:(()=>Promise<void>)[]=[];
 for(const callback of callbacks)try{await callback();}catch{pending.push(callback);}
 let failed=pending.length>0;
 try{failed=failed||failedStagingNames(markers).length>0||leasedStagingNames(markers).length>0;}catch{failed=true;}
 return {pending,failed};
}
