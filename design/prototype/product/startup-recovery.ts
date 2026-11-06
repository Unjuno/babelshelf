/** Explicit recovery only: never clear storage or change network preferences. */
export function startupGate(storageError:string,metadataError:string,dialogueError:string){
 const message=dialogueError||storageError||metadataError;
 return {message:message||'Opening local storage…',recoverable:!!message};
}
export async function recoverStartup<Registration>(ports:{getRegistration:()=>Promise<Registration|undefined>;update:(registration:Registration)=>Promise<unknown>;reload:()=>void}){
 const registration=await ports.getRegistration();
 if(!registration)throw Error('App update unavailable');
 await ports.update(registration);
 ports.reload();
}
// @ts-expect-error Shared path validation is JavaScript.
import {normalizePath,notePath} from '../../../dist/files.js';
import {originalKey,readOriginal,type OriginalAsset,type OriginalRef} from '../src/original-assets.ts';
function openExistingMemory(){return new Promise<IDBDatabase>((resolve,reject)=>{
 let blocked=false;const r=indexedDB.open('mlb-memory-v1');r.onupgradeneeded=()=>r.transaction?.abort();
 r.onsuccess=()=>{if(blocked){r.result.close();return;}r.result.onversionchange=()=>r.result.close();resolve(r.result);};
 r.onerror=()=>reject(r.error??Error('Storage unavailable'));r.onblocked=()=>{blocked=true;reject(Error('Storage unavailable'));};
});}
export function invalidStoredPaths(records:any[]){
 const problems:{id:string;version:number;path:string;hasOriginal:boolean}[]=[];
 for(const note of records){if(!note||!Array.isArray(note.revisions))continue;
  for(const [i,revision] of note.revisions.entries())try{
   if(revision?.path!==undefined)normalizePath(revision.path);else notePath(note,i+1);
  }catch{problems.push({id:typeof note.id==='string'?note.id:'?',version:i+1,path:typeof revision?.path==='string'?revision.path:'(default path)',hasOriginal:!!(note.originalAsset||note.mediaSource)});}
 }
 return problems;
}
export async function readRecoveryOriginal(id:string){
 const db=await openExistingMemory();
 try{return await new Promise<{name:string;mime:string;bytes:Uint8Array<ArrayBuffer>}>((resolve,reject)=>{const tx=db.transaction(['notes','runs'],'readonly'),q=tx.objectStore('notes').get(id);q.onsuccess=()=>{const ref:OriginalRef|undefined=q.result?.originalAsset??q.result?.mediaSource;if(!ref||typeof ref.id!=='string'){reject(Error('Original unavailable'));return;}const asset=tx.objectStore('runs').get(originalKey(ref.id));asset.onsuccess=()=>{try{const original:OriginalAsset=asset.result;resolve({name:original.name,mime:original.mime,bytes:Uint8Array.from(readOriginal(original,ref))});}catch(e){reject(e);}};asset.onerror=()=>reject(asset.error);};q.onerror=()=>reject(q.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
export async function inspectStoredPaths(){
 const db=await openExistingMemory();
 try{return await new Promise<ReturnType<typeof invalidStoredPaths>>((resolve,reject)=>{const tx=db.transaction('notes','readonly'),r=tx.objectStore('notes').getAll();r.onsuccess=()=>{try{resolve(invalidStoredPaths(r.result));}catch(e){reject(e);}};r.onerror=()=>reject(r.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
export async function readRecoverySnapshot(){
 const db=await openExistingMemory();
 try{return await new Promise<{notes:any[];settings:{key:string;value:any}[];runs:{key:string;value:any}[]}>((resolve,reject)=>{const tx=db.transaction(['notes','settings','runs'],'readonly'),notes=tx.objectStore('notes').getAll(),settings=tx.objectStore('settings'),runs=tx.objectStore('runs'),sk=settings.getAllKeys(),sv=settings.getAll(),rk=runs.getAllKeys(),rv=runs.getAll();
  tx.oncomplete=()=>{try{const pair=(keys:IDBValidKey[],values:any[])=>keys.map((key,i)=>{if(typeof key!=='string')throw Error('Unsupported storage key');return {key,value:values[i]};});resolve({notes:notes.result,settings:pair(sk.result,sv.result),runs:pair(rk.result,rv.result)});}catch(e){reject(e);}};tx.onabort=()=>reject(tx.error??Error('Storage unavailable'));tx.onerror=()=>reject(tx.error??Error('Storage unavailable'));
 });}finally{db.close();}
}
export function recoveryTextRecord(note:any){
 if(!note||typeof note.id!=='string'||!Array.isArray(note.revisions)||!note.revisions.length||note.revisions.some((r:any)=>!r||typeof r.body!=='string'||typeof r.title!=='string'||!Number.isInteger(r.version)||typeof r.at!=='string'||(r.path!==undefined&&typeof r.path!=='string')))throw Error('Text unavailable');
 return {format:'babelshelf-recovery-text',schema:1,id:note.id,revisions:note.revisions.map((r:any)=>({version:r.version,title:r.title,body:r.body,at:r.at,...(r.path!==undefined?{path:r.path}:{})}))};
}
export async function readRecoveryText(id:string){
 const db=await openExistingMemory();
 try{return await new Promise<ReturnType<typeof recoveryTextRecord>>((resolve,reject)=>{const tx=db.transaction('notes','readonly'),r=tx.objectStore('notes').get(id);r.onsuccess=()=>{try{resolve(recoveryTextRecord(r.result));}catch(e){reject(e);}};r.onerror=()=>reject(r.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
