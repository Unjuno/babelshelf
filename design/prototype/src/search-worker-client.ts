import {SearchSnapshotChangedError} from './file-discovery.ts';

type SearchOptions={offset:number;limit:number;snapshot?:string;pathPrefix?:string};
type SearchWorker=Pick<Worker,'onmessage'|'onerror'|'onmessageerror'|'postMessage'|'terminate'>;
type Pending={resolve:(value:any)=>void;reject:(error:Error)=>void;signal?:AbortSignal;abort?:()=>void};

/** A store owns one local search worker. Stop retires the worker so a CPU-bound
 * search cannot continue; other pending callers receive an explicit failure. */
export function createPagedSearchClient(factory:()=>SearchWorker=()=>new Worker(new URL('./search-worker.ts',import.meta.url),{type:'module',name:'BabelShelf search'})){
 let worker:SearchWorker|undefined,sequence=0;const pending=new Map<number,Pending>();
 const detach=(item:Pending)=>{if(item.signal&&item.abort)item.signal.removeEventListener('abort',item.abort);};
 function retire(abortedId?:number){
  const previous=worker;worker=undefined;previous?.terminate();
  for(const [id,item] of pending){detach(item);item.reject(Error(id===abortedId?'Stopped':'Search interrupted'));}pending.clear();
 }
 function getWorker(){
  if(worker)return worker;const current=factory();worker=current;
  current.onmessage=event=>{
   if(worker!==current)return;const message=event.data;
   if(!message||typeof message!=='object'||!Number.isSafeInteger(message.id)||!pending.has(message.id)||message.ok!==true&&message.ok!==false||message.ok===true&&!Object.hasOwn(message,'value')||message.ok===false&&!['snapshot_changed','search_failed'].includes(message.code)){retire();return;}
   const item=pending.get(message.id)!;
   pending.delete(message.id);detach(item);
   if(message.ok===true)item.resolve(message.value);else if(message.code==='snapshot_changed')item.reject(new SearchSnapshotChangedError());else item.reject(Error('Local search failed'));
  };
  current.onerror=()=>{if(worker===current)retire();};current.onmessageerror=()=>{if(worker===current)retire();};return current;
 }
 return {
  search(notes:unknown[],query:string,options:SearchOptions,signal?:AbortSignal):Promise<any>{
   if(signal?.aborted)return Promise.reject(Error('Stopped'));
   let current:SearchWorker;try{current=getWorker();}catch{return Promise.reject(Error('Local search unavailable'));}
   return new Promise((resolve,reject)=>{
    const id=++sequence,item:Pending={resolve,reject,signal};item.abort=()=>retire(id);pending.set(id,item);signal?.addEventListener('abort',item.abort,{once:true});
    if(signal?.aborted){retire(id);return;}
    try{current.postMessage({id,notes,query,options});}catch{pending.delete(id);detach(item);reject(Error('Local search failed'));}
   });
  },
  close(){retire();},
 };
}
