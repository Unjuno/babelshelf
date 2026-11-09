import type {SemanticVectorRecord} from './semantic-search-core.ts';

const DATABASE='babelshelf-semantic-index-v1';
const STORE='vectors';
type StoredVector=SemanticVectorRecord&{key:string;sourceKey:string};

function validIdentity(value:string,max:number){return typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);}
function validateRecord(record:SemanticVectorRecord,modelRevision:string,noteId:string,revision:number):StoredVector{
 const vector=record?.vector,validVector=Array.isArray(vector)||vector instanceof Float32Array;
 if(!record||record.modelRevision!==modelRevision||record.noteId!==noteId||record.revision!==revision||!Number.isSafeInteger(record.start)||record.start<0||!Number.isSafeInteger(record.end)||record.end<=record.start||record.end-record.start>4096||typeof record.quote!=='string'||!record.quote.trim()||record.quote.length!==record.end-record.start||record.quote.length>4096||!validVector||vector.length<1||vector.length>4096||Array.from(vector).some(value=>typeof value!=='number'||!Number.isFinite(value)))throw Error('Invalid semantic index record');
 const compact=Float32Array.from(vector);if(compact.some(value=>!Number.isFinite(value)))throw Error('Invalid semantic index record');
 return {modelRevision,noteId,revision,start:record.start,end:record.end,quote:record.quote,vector:compact,key:[modelRevision,noteId,revision,record.start,record.end].join('\u0000'),sourceKey:[modelRevision,noteId].join('\u0000')};
}
function requestValue<T>(request:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error??Error('Semantic index request failed'));});}
function transactionDone(transaction:IDBTransaction):Promise<void>{return new Promise((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onabort=()=>reject(transaction.error??Error('Semantic index transaction aborted'));transaction.onerror=()=>reject(transaction.error??Error('Semantic index transaction failed'));});}

/** Rebuildable derived vectors live outside the canonical Memory database. */
export function createSemanticIndexStore({name=DATABASE}:{name?:string}={}){
 if(!validIdentity(name,128))throw Error('Invalid semantic index database name');
 let databasePromise:Promise<IDBDatabase>|undefined,closed=false;
 const database=()=>{
  if(closed)return Promise.reject(Error('Semantic index store closed'));
  if(!databasePromise)databasePromise=new Promise<IDBDatabase>((resolve,reject)=>{
   const open=indexedDB.open(name,1);let blocked=false;
   open.onupgradeneeded=()=>{const db=open.result;if(!db.objectStoreNames.contains(STORE)){const store=db.createObjectStore(STORE,{keyPath:'key'});store.createIndex('by-source','sourceKey',{unique:false});store.createIndex('by-model','modelRevision',{unique:false});}};
   open.onsuccess=()=>{const db=open.result;if(blocked){db.close();return;}db.onversionchange=()=>db.close();resolve(db);};
   open.onerror=()=>reject(open.error??Error('Semantic index database unavailable'));
   open.onblocked=()=>{blocked=true;reject(Error('Semantic index database upgrade blocked'));};
  }).catch(error=>{databasePromise=undefined;throw error;});
  return databasePromise!;
 };
 const abortWithSignal=(transaction:IDBTransaction,signal?:AbortSignal)=>{
  if(!signal)return()=>{};
  const abort=()=>{try{transaction.abort();}catch{}};
  if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
  return()=>signal.removeEventListener('abort',abort);
 };
 return {
  async replaceNote(modelRevision:string,noteId:string,revision:number,records:readonly SemanticVectorRecord[],signal?:AbortSignal){
   if(!validIdentity(modelRevision,512)||!validIdentity(noteId,512)||!Number.isSafeInteger(revision)||revision<1||!Array.isArray(records)||records.length>10000)throw Error('Invalid semantic index source');
   if(signal?.aborted)throw Error('Stopped');
   const values=records.map(record=>validateRecord(record,modelRevision,noteId,revision));
   const db=await database();if(signal?.aborted)throw Error('Stopped');
   const transaction=db.transaction(STORE,'readwrite'),done=transactionDone(transaction),removeAbort=abortWithSignal(transaction,signal),store=transaction.objectStore(STORE),index=store.index('by-source');
   const request=index.getAllKeys([modelRevision,noteId].join('\u0000'));
   request.onsuccess=()=>{if(signal?.aborted){try{transaction.abort();}catch{}return;}for(const key of request.result)store.delete(key);for(const value of values)store.put(value);};
   request.onerror=()=>{try{transaction.abort();}catch{}};
   try{await done;}
   catch(error){if(signal?.aborted)throw Error('Stopped');throw error;}
   finally{removeAbort();}
   return values.length;
  },
  async list(modelRevision:string):Promise<SemanticVectorRecord[]>{
   if(!validIdentity(modelRevision,512))throw Error('Invalid semantic model revision');
   const db=await database(),transaction=db.transaction(STORE,'readonly'),done=transactionDone(transaction),request=transaction.objectStore(STORE).index('by-model').getAll(modelRevision);
   const values=await requestValue(request);await done;
   return values.map(({key,sourceKey,...record})=>record);
  },
  async removeModel(modelRevision:string){
   if(!validIdentity(modelRevision,512))throw Error('Invalid semantic model revision');
   const db=await database(),transaction=db.transaction(STORE,'readwrite'),done=transactionDone(transaction),store=transaction.objectStore(STORE),request=store.index('by-model').getAllKeys(modelRevision);
   request.onsuccess=()=>{for(const key of request.result)store.delete(key);};request.onerror=()=>{try{transaction.abort();}catch{}};await done;
  },
  async close(){closed=true;const pending=databasePromise;if(pending){try{(await pending).close();}catch{}}databasePromise=undefined;},
 };
}
