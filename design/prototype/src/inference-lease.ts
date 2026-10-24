const LOCK_NAME='babelshelf-local-inference';
type LockApi={request:(name:string,options:{mode:'exclusive';ifAvailable:true},callback:(lock:Lock|null)=>Promise<void>|void)=>Promise<unknown>};
export type InferenceLease={readonly protected:boolean;release:()=>Promise<void>};
export type InferenceRole='Text'|'Decision'|'Vision'|'Speech'|'OCR';

function reserveAcrossTabs(locks:LockApi):Promise<InferenceLease>{
 let releaseHold!:()=>void,rejectReady!:(error:Error)=>void,settled=false;
 const hold=new Promise<void>(resolve=>{releaseHold=resolve;});
 const acquired=new Promise<InferenceLease>((resolve,reject)=>{
  rejectReady=error=>{if(settled)return;settled=true;reject(error);};
  let pending:Promise<unknown>;
  pending=locks.request(LOCK_NAME,{mode:'exclusive',ifAvailable:true},async lock=>{
   if(!lock){rejectReady(Error('A local model is already active in another BabelShelf tab. Unload it there, then retry.'));return;}
   if(settled)return;
   settled=true;let released=false;
   resolve({protected:true,release:async()=>{if(released)return;released=true;releaseHold();await pending;}});
   await hold;
  });
  void pending.catch(error=>rejectReady(error instanceof Error?error:Error('Local inference lock failed')));
 });
 return acquired;
}

// One role at a time may own this tab's inference resources. Text/Decision
// leases can be resident; Vision/Speech/OCR leases cover a bounded operation.
// The origin-wide browser lock remains held until the final same-role lease
// releases, preventing other tabs from loading a competing model meanwhile.
export function createInferenceLeaseManager(locks:LockApi|null|undefined=globalThis.navigator?.locks){
 let root:Promise<InferenceLease>|null=null,owners=0,activeRole:InferenceRole|null=null,ending:Promise<void>|null=null;
 async function acquire(role:InferenceRole='Text'):Promise<InferenceLease>{
  if(ending)await ending;
  const reservation=root??(root=locks?reserveAcrossTabs(locks):Promise.resolve({protected:false,release:async()=>{}}));
  let lease:InferenceLease;
  try{lease=await reservation;}catch(error){if(root===reservation)root=null;throw error;}
  if(ending){await ending;return acquire(role);}
  if(owners>0&&activeRole!==role)throw Error(`Another local inference role is active (${activeRole}). Finish or unload it before using ${role}.`);
  activeRole=role;
  owners++;let released=false;
  return {protected:lease.protected,release:async()=>{
   if(released)return;released=true;owners--;
   if(owners===0&&root===reservation){
    activeRole=null;
    ending=reservation.then(value=>value.release()).then(()=>{},()=>{}).finally(()=>{if(root===reservation)root=null;ending=null;});
    await ending;
   }
  }};
 }
 return {acquire};
}

export const inferenceLeaseManager=createInferenceLeaseManager();
