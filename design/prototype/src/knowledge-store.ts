// The existing PWA database is the only knowledge store. UI objects are projections.
// @ts-expect-error Shared baseline is plain JavaScript.
import {createNote,reviseNote,withdrawNote,latest,validateRefs,checkNotes,buildIndex,searchNotes,makeBackup,parseBackup,mergeNotes} from '../../../dist/core.js';
// @ts-expect-error Shared baseline is plain JavaScript.
import {notePath} from '../../../dist/files.js';
// @ts-expect-error Shared baseline is plain JavaScript.
import {openDB} from '../../../dist/storage.js';
import {parsePreference,formatPreference,preferenceGroup} from './preference-records.ts';
import {validateMemoryFilePath} from './memory-paths.ts';

export type NoteView={id:string;path:string;body:string;version:number;history:string[];paths?:string[];protected?:boolean;managed?:boolean;kind?:'original'|'generated';sources?:{noteId:string;revision:number;start:number;end:number;quote:string}[];importedFrom?:{name:string;bytes:number}};
type Canonical=ReturnType<typeof createNote>;
export function projectNote(n:Canonical):NoteView {
 const v=latest(n);return {id:n.id,path:notePath(n),body:v.body,version:v.version,history:n.revisions.slice(0,-1).map((r:any)=>r.body),paths:n.revisions.map((r:any)=>notePath(n,r.version)),protected:!!n.ui?.protected,managed:!!n.ui?.managed,...(n.importedFrom?{importedFrom:n.importedFrom}:{})};
}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function applyKnowledgeChanges(records:Canonical[],before:NoteView[],after:NoteView[]):Canonical[]{
 const result=structuredClone(records),oldView=new Map(before.map(n=>[n.id,n])),newView=new Map(after.map(n=>[n.id,n]));
 if(newView.size!==after.length)throw Error('Duplicate ID conflict');
 for(const id of new Set([...oldView.keys(),...newView.keys()])){
  const previous=oldView.get(id),next=newView.get(id);if(equal(previous,next))continue;
  const i=result.findIndex((n:Canonical)=>n.id===id),old=i<0?undefined:result[i];
  if(previous&&(!old||old.state!=='active'||!equal(projectNote(old),previous)))throw Error('Version conflict · reload and retry');
  if(old?.ui?.protected)throw Error('Built-in record is protected');
  if(!next){if(old?.ui?.managed)throw Error('Settings path is protected');result[i]=withdrawNote(old,latest(old).version);continue;}
  if(old?.ui?.managed){if(next.path!==notePath(old))throw Error('Settings path is protected');parsePreference(preferenceGroup(next.path)!,next.body);}
  if(!old||next.path!==notePath(old))validateMemoryFilePath(next.path);
  if(old){
   if(old.state==='active'&&(!previous||next.version!==previous.version+1||!equal(next.history,[...previous.history,previous.body])))throw Error('Invalid revision history');
   const active={...old,state:'active'};delete active.withdrawnAt;
   result[i]=reviseNote(active,{body:next.body,path:next.path},latest(old).version);
  }else{
   if(next.version!==1||next.history.length)throw Error('Invalid new revision');
   if(next.kind==='generated'&&(!next.sources?.length||!validateRefs(records,next.sources,{currentOnly:true}).ok))throw Error('Source changed · review before saving');
   const created=createNote({title:next.path.split('/').at(-1)!.replace(/\.md$/i,''),body:next.body,path:next.path,kind:next.kind??'original',sources:next.sources??[]});
   result.push({...created,id,...(next.importedFrom?{importedFrom:next.importedFrom}:{})});
  }
 }
 checkNotes(result);return result;
}

export class KnowledgeStore {
 private database:IDBDatabase|null=null;
 private name:string;
 constructor(name='mlb-memory-v1'){this.name=name;}
 async open(){if(!this.database)this.database=await openDB(this.name);return this.database!;}
 private async transaction<T>(stores:string[],mode:IDBTransactionMode,run:(tx:IDBTransaction,done:(v:T)=>void)=>void):Promise<T>{
  const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(stores,mode);let value:T,error:unknown;
   const fail=(e:unknown)=>{error=e;tx.abort();};
   try{run(tx,v=>{value=v;});}catch(e){fail(e);}
   tx.addEventListener('error',()=>{error??=tx.error;});
   tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(error??tx.error??Error('Save failed'));
  });
 }
 async initialize(defaults:NoteView[]){
  return this.transaction<NoteView[]>(['notes'],'readwrite',(tx,done)=>{const store=tx.objectStore('notes'),q=store.getAll();q.onsuccess=()=>{
   try{const records=q.result;for(const seed of defaults){if(records.some(n=>n.id===seed.id))continue;
    const note={...createNote({title:seed.path.split('/').at(-1),body:seed.body,path:seed.path}),id:seed.id,ui:{protected:!!seed.protected,managed:!!seed.managed}};records.push(note);store.add(note);
   }
   const connection=records.find(n=>n.id==='settings-connection'&&n.ui?.managed);
   if(connection&&parsePreference('connection',latest(connection).body).downloads){const changed=reviseNote(connection,{body:formatPreference('connection',{downloads:false})},latest(connection).version);records[records.indexOf(connection)]=changed;store.put(changed);}
   checkNotes(records);done(records.filter(n=>n.state==='active').map(projectNote));}catch(e){tx.abort();console.error('Initialization failed',e);}
  };});
 }
 async all():Promise<Canonical[]>{return this.transaction(['notes'],'readonly',(tx,done)=>{const q=tx.objectStore('notes').getAll();q.onsuccess=()=>done(q.result);});}
 async views(){return (await this.all()).filter(n=>n.state==='active').map(projectNote);}
 async commit(before:NoteView[],after:NoteView[]){
  const db=await this.open();return new Promise<NoteView[]>((resolve,reject)=>{const tx=db.transaction('notes','readwrite'),store=tx.objectStore('notes'),q=store.getAll();let error:unknown,views:NoteView[];
   q.onsuccess=()=>{try{const updated=applyKnowledgeChanges(q.result,before,after);for(const n of updated)if(!equal(q.result.find(x=>x.id===n.id),n))store.put(n);views=updated.filter(n=>n.state==='active').map(projectNote);}catch(e){error=e;tx.abort();}};
   tx.oncomplete=()=>resolve(views);tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Save failed'));
  });
 }
 async getState<T>(key:string):Promise<T|undefined>{return this.transaction(['settings'],'readonly',(tx,done)=>{const q=tx.objectStore('settings').get('ui-v1-'+key);q.onsuccess=()=>done(q.result);});}
 async setState(key:string,value:unknown){return this.transaction<void>(['settings'],'readwrite',(tx,done)=>{tx.objectStore('settings').put(value,'ui-v1-'+key);done();});}
 async reindex(){const records=await this.all();buildIndex(records,{force:true});return records.filter(n=>n.state==='active').length;}
 async search(query:string){return searchNotes(await this.all(),query,12);}
 async backup(){return makeBackup(await this.all());}
 async checkBackup(text:string){return parseBackup(text);}
 async restore(text:string){const incoming=await parseBackup(text);return this.transaction<any>(['notes'],'readwrite',(tx,done)=>{const s=tx.objectStore('notes'),q=s.getAll();q.onsuccess=()=>{try{const merged=mergeNotes(q.result,incoming.notes);for(const n of merged.notes)if(!q.result.some(x=>x.id===n.id))s.add(n);done(merged);}catch(e){tx.abort();}};});}
 close(){this.database?.close();this.database=null;}
}
