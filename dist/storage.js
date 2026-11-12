import {assertPaths} from './files.js';
import {latest,checkNotes,mergeNotes} from './core.js';
const closedDatabases=new WeakSet();
const pending=new Map();
export function isDBClosed(database){return closedDatabases.has(database);}
export function closeDB(database){closedDatabases.add(database);database.close();}
export function openDB(name='mlb-memory-v1'){
 return new Promise((resolve,reject)=>{const q=indexedDB.open(name,1);q.onupgradeneeded=()=>{for(const s of ['notes','settings','runs'])q.result.createObjectStore(s,s==='notes'?{keyPath:'id'}:undefined);};q.onsuccess=()=>{const database=q.result;database.onversionchange=()=>closeDB(database);database.addEventListener('close',()=>closedDatabases.add(database),{once:true});resolve(database);};q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('Database blocked'));});
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
