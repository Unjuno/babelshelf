const LOCK_NAME='babelshelf-local-inference';
type LockApi={request:(name:string,options:{mode:'exclusive';ifAvailable:true},callback:(lock:Lock|null)=>Promise<void>|void)=>Promise<unknown>};
export type InferenceLease={readonly protected:boolean;release:()=>Promise<void>};

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

// Several model roles may share one tab; hold a single origin-wide browser
// lock until that tab's last resident inference model releases its lease.
export function createInferenceLeaseManager(locks:LockApi|null|undefined=globalThis.navigator?.locks){
 let root:Promise<InferenceLease>|null=null,owners=0,ending:Promise<void>|null=null;
 async function acquire(_role='model'):Promise<InferenceLease>{
  if(ending)await ending;
  const reservation=root??(root=locks?reserveAcrossTabs(locks):Promise.resolve({protected:false,release:async()=>{}}));
  let lease:InferenceLease;
  try{lease=await reservation;}catch(error){if(root===reservation)root=null;throw error;}
  if(ending){await ending;return acquire(_role);}
  owners++;let released=false;
  return {protected:lease.protected,release:async()=>{
   if(released)return;released=true;owners--;
   if(owners===0&&root===reservation){
    ending=reservation.then(value=>value.release()).then(()=>{},()=>{}).finally(()=>{if(root===reservation)root=null;ending=null;});
    await ending;
   }
  }};
 }
 return {acquire};
}

export const inferenceLeaseManager=createInferenceLeaseManager();
