import {assertPaths} from './files.js';
import {latest,checkNotes,mergeNotes} from './core.js';
const closedDatabases=new WeakSet();
const pending=new Map();
export function isDBClosed(database){return closedDatabases.has(database);}
export function closeDB(database){closedDatabases.add(database);database.close();}
export function openDB(name='mlb-memory-v1',timeoutMs=15000){
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(callback,value)=>{if(settled)return false;settled=true;clearTimeout(timer);callback(value);return true;};
  const timer=setTimeout(()=>finish(reject,Error('Local storage did not respond within 15 seconds. Your saved data was not changed. Reopen the app to try again.')),timeoutMs);
  let q;
  try{q=indexedDB.open(name,1);}catch(error){finish(reject,error);return;}
  q.onupgradeneeded=()=>{if(settled){q.transaction?.abort();return;}try{for(const s of ['notes','settings','runs'])if(!q.result.objectStoreNames.contains(s))q.result.createObjectStore(s,s==='notes'?{keyPath:'id'}:undefined);}catch(error){q.transaction?.abort();finish(reject,error);}};
  q.onsuccess=()=>{const database=q.result;if(!finish(resolve,database)){database.close();return;}database.onversionchange=()=>closeDB(database);database.addEventListener('close',()=>closedDatabases.add(database),{once:true});};
  q.onerror=()=>finish(reject,q.error??Error('Local storage could not be opened. Your saved data was not changed.'));
  q.onblocked=()=>finish(reject,Error('Local storage is blocked by another tab. Close other BabelShelf tabs and reopen the app. Your saved data was not changed.'));
 });
}
export async function db(name='mlb-memory-v1'){let opening=pending.get(name);if(opening){const database=await opening;if(!isDBClosed(database))return database;pending.delete(name);}opening=openDB(name);pending.set(name,opening);try{return await opening;}catch(error){if(pending.get(name)===opening)pending.delete(name);throw error;}}
export function txValue(database,store,mode,run){return new Promise((resolve,reject)=>{const t=database.transaction(store,mode);let q;try{q=run(t.objectStore(store),t);}catch(e){t.abort();reject(e);return;}t.oncomplete=()=>resolve(q?.result);t.onabort=t.onerror=()=>reject(t.error??Error('Save failed'));});}
export async function allNotes(){return txValue(await db(),'notes','readonly',s=>s.getAll());}
export async function saveNote(note,expected=null,database=null){
 const d=database??await db();return new Promise((resolve,reject)=>{const t=d.transaction('notes','readwrite'),s=t.objectStore('notes'),q=s.get(note.id);let error;
 q.onsuccess=()=>{const old=q.result;if(expected===null?!!old:!old||latest(old).version!==expected){error=Error('Version conflict');t.abort();return;}const paths=s.getAll();paths.onsuccess=()=>{try{assertPaths([...paths.result.filter(n=>n.id!==note.id),note]);s.put(note);}catch(e){error=e;t.abort();}};};t.oncomplete=()=>resolve(note);t.onabort=t.onerror=()=>reject(error??t.error??Error('Save failed'));});
}
export async function restoreNotes(incoming){checkNotes(incoming);const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('notes','readwrite'),s=t.objectStore('notes'),q=s.getAll();let result,validationError;
 q.onsuccess=()=>{try{result=mergeNotes(q.result,incoming);const ids=new Set(q.result.map(n=>n.id));for(const n of result.notes)if(!ids.has(n.id))s.put(n);}catch(e){validationError=e;t.abort();}};t.oncomplete=()=>resolve(result);t.onabort=t.onerror=()=>reject(validationError??t.error??Error('Restore failed'));});}
export async function getSetting(key){return txValue(await db(),'settings','readonly',s=>s.get(key));}
export async function setSetting(key,value){return txValue(await db(),'settings','readwrite',s=>s.put(value,key));}
