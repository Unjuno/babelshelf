// The existing PWA database is the only knowledge store. UI objects are projections.
// @ts-expect-error Shared baseline is plain JavaScript.
import {createNote,reviseNote,withdrawNote,latest,validateRefs,checkNotes,buildIndex,searchNotes,makeBackup,parseBackup,mergeNotes} from '../../../dist/core.js';
// @ts-expect-error Shared baseline is plain JavaScript.
import {notePath} from '../../../dist/files.js';
// @ts-expect-error Shared baseline is plain JavaScript.
import {openDB} from '../../../dist/storage.js';
import {parsePreference,formatPreference,preferenceGroup} from './preference-records.ts';
import {validateMemoryFilePath} from './memory-paths.ts';
import {localDate} from './schedule-time.ts';
import {parseTask,formatTask,taskDefinition,taskNextAt,taskRunView,noticeView,noticeBody,taskNotice,claimTaskRun,finishTaskRun,skipTaskRun,heartbeatRun,type Task,type RunStatus} from './task-records.ts';
import {applyCorrection,undoCorrection,type CorrectionProposal,type CorrectionReceipt} from './note-corrections.ts';
export {prepareCorrection,applyCorrection,undoCorrection,resolveCorrectionTarget,canUndoCorrection,loadCorrectionHistory,runReviewedCorrection} from './note-corrections.ts';

export type NoteView={id:string;path:string;body:string;version:number;history:string[];paths?:string[];protected?:boolean;managed?:boolean;recordType?:'schedule'|'execution'|'notification';nextAt?:string|null;requiresReview?:boolean;readOnly?:boolean;kind?:'original'|'generated';sources?:{noteId:string;revision:number;start:number;end:number;quote:string}[];importedFrom?:{name:string;bytes:number}};
type Canonical=ReturnType<typeof createNote>;
export function projectNote(n:Canonical):NoteView {
 const v=latest(n);return {id:n.id,path:notePath(n),body:v.body,version:v.version,history:n.revisions.slice(0,-1).map((r:any)=>r.body),paths:n.revisions.map((r:any)=>notePath(n,r.version)),protected:!!n.ui?.protected,managed:!!n.ui?.managed,...(n.ui?.recordType?{recordType:n.ui.recordType,nextAt:n.taskCursor?.nextAt,requiresReview:!!n.ui.requiresReview,readOnly:n.ui.recordType!=='schedule'}:{}),...(n.importedFrom?{importedFrom:n.importedFrom}:{})};
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
  if(!next){if(old?.ui?.managed)throw Error('Settings path is protected');if(old?.ui?.recordType==='execution'&&taskRunView(old).status==='running')throw Error('Stop execution before deleting');result[i]=withdrawNote(old,latest(old).version);continue;}
  if(old?.ui?.recordType&&old.ui.recordType!=='schedule'&&old.state==='active')throw Error('Execution and notification content is read only');
  if(old?.ui?.managed){if(next.path!==notePath(old))throw Error('Settings path is protected');parsePreference(preferenceGroup(next.path)!,next.body);}
  if(!old||next.path!==notePath(old))validateMemoryFilePath(next.path);
  if(old){
   if(old.state==='active'&&(!previous||next.version!==previous.version+1||!equal(next.history,[...previous.history,previous.body])))throw Error('Invalid revision history');
   if(old.state==='withdrawn'&&['execution','notification'].includes(old.ui?.recordType)&&(next.body!==latest(old).body||next.path!==notePath(old)))throw Error('Restore exact log before changing it');
   const active={...old,state:'active'};delete active.withdrawnAt;
   result[i]=reviseNote(active,{body:next.body,path:next.path},latest(old).version);
   if(old.ui?.recordType==='schedule'){const task=parseTask(next.body),definition=taskDefinition(task);if(old.taskCursor?.definition!==definition)result[i].taskCursor={definition,nextAt:taskNextAt(task).toISOString()};}
  }else{
   if(next.recordType)throw Error('Register through Schedule');
   if(next.version!==1||next.history.length)throw Error('Invalid new revision');
   if(next.kind==='generated'&&(!Array.isArray(next.sources)||!validateRefs(records,next.sources,{currentOnly:true}).ok))throw Error('Source changed · review before saving');
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
 async corrections(noteId?:string):Promise<CorrectionReceipt[]>{return this.transaction(['runs'],'readonly',(tx,done)=>{const q=tx.objectStore('runs').getAll();q.onsuccess=()=>done(q.result.filter(r=>r?.type==='note-correction'&&r.schema===1&&(!noteId||r.noteId===noteId)).sort((a,b)=>b.appliedAt.localeCompare(a.appliedAt)));});}
 async approveCorrection(proposal:CorrectionProposal){
  const db=await this.open();return new Promise<CorrectionReceipt>((resolve,reject)=>{
   const tx=db.transaction(['notes','runs'],'readwrite'),notes=tx.objectStore('notes'),runs=tx.objectStore('runs'),prior=runs.get('ui-v1-correction-'+proposal.id);let receipt:CorrectionReceipt,error:unknown;
   prior.onsuccess=()=>{if(prior.result){error=Error('Correction already applied');tx.abort();return;}const q=notes.getAll();q.onsuccess=()=>{try{const result=applyCorrection(q.result,proposal);notes.put(result.note);runs.add(result.receipt,'ui-v1-correction-'+result.receipt.id);receipt=result.receipt;}catch(e){error=e;tx.abort();}};};
   tx.oncomplete=()=>resolve(receipt);tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Correction save failed'));
  });
 }
 async revertCorrection(id:string){
  const db=await this.open();return new Promise<CorrectionReceipt>((resolve,reject)=>{
   const tx=db.transaction(['notes','runs'],'readwrite'),notes=tx.objectStore('notes'),runs=tx.objectStore('runs'),q=runs.get('ui-v1-correction-'+id);let receipt:CorrectionReceipt,error:unknown;
   q.onsuccess=()=>{const records=notes.getAll();records.onsuccess=()=>{try{const result=undoCorrection(records.result,q.result);notes.put(result.note);runs.put(result.receipt,'ui-v1-correction-'+id);receipt=result.receipt;}catch(e){error=e;tx.abort();}};};
   tx.oncomplete=()=>resolve(receipt);tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Undo failed'));
  });
 }
 private async editRecords<T>(change:(records:Canonical[])=>{put:Canonical[];value:T}):Promise<T>{
  const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction('notes','readwrite'),s=tx.objectStore('notes'),q=s.getAll();let value:T,error:unknown;
   q.onsuccess=()=>{try{const result=change(q.result);const map=new Map(q.result.map(n=>[n.id,n]));for(const n of result.put)map.set(n.id,n);checkNotes([...map.values()]);for(const n of result.put)s.put(n);value=result.value;}catch(e){error=e;tx.abort();}};
   tx.oncomplete=()=>resolve(value);tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Save failed'));
  });
 }
 async putTask(task:Task,id?:string,expected?:number){return this.editRecords(records=>{
  let note;if(id){const old=records.find(n=>n.id===id&&n.state==='active');if(!old||old.ui?.recordType!=='schedule'||latest(old).version!==expected)throw Error('Version conflict · reload schedule');note=reviseNote(old,{body:formatTask(task)},expected);if(note.ui.requiresReview)delete note.taskCursor;note.ui={...note.ui,requiresReview:false};}
  else{note=createNote({path:'Schedule/'+localDate()+'-'+crypto.randomUUID()+'.md',title:task.prompt.trim().split('\n')[0].slice(0,72),body:formatTask(task)});note.ui={recordType:'schedule'};}
  const definition=taskDefinition(task);if(!note.taskCursor||note.taskCursor.definition!==definition||note.ui.requiresReview)note.taskCursor={definition,nextAt:taskNextAt(task).toISOString()};
  return {put:[note],value:projectNote(note)};
 });}
 async claimRun(taskId:string,owner:string,options:{retry?:boolean;manual?:boolean}={},now=new Date()){return this.editRecords(records=>{
  const task=records.find(n=>n.id===taskId);if(task?.ui?.requiresReview)throw Error('Review restored schedule first');
  const result=claimTaskRun(records,taskId,owner,now,options),notice=result.execute?null:taskNotice(result.task,result.run);
  return {put:[result.run,...(notice?[notice]:[])],value:result};
 });}
 async heartbeat(runId:string,owner:string){return this.editRecords(records=>({put:[heartbeatRun(records,runId,owner)],value:true}));}
 async skipRun(taskId:string,owner:string){return this.editRecords(records=>{const result=skipTaskRun(records,taskId,owner),notice=taskNotice(result.task,result.run);return {put:[result.task,result.run,...(notice?[notice]:[])],value:projectNote(result.run)};});}
 async finishRun(runId:string,owner:string,result:{status:RunStatus;answer?:string;error?:string;sources?:any[]},now=new Date()){return this.editRecords(records=>{
  const completed=finishTaskRun(records,runId,owner,result,now),notice=taskNotice(completed.task,completed.run);
  return {put:[completed.task,completed.run,...(notice?[notice]:[])],value:projectNote(completed.run)};
 });}
 async readNotification(id:string){return this.editRecords(records=>{const old=records.find(n=>n.id===id&&n.state==='active');if(!old)throw Error('Notification unavailable');const data=noticeView(old),note=data.read?old:reviseNote(old,{body:noticeBody({...data,read:true})},latest(old).version);return {put:[note],value:projectNote(note)};});}
 async commit(before:NoteView[],after:NoteView[]){
  const db=await this.open();return new Promise<NoteView[]>((resolve,reject)=>{const tx=db.transaction('notes','readwrite'),store=tx.objectStore('notes'),q=store.getAll();let error:unknown,views:NoteView[];
   q.onsuccess=()=>{try{const updated=applyKnowledgeChanges(q.result,before,after);for(const n of updated)if(!equal(q.result.find(x=>x.id===n.id),n))store.put(n);views=updated.filter(n=>n.state==='active').map(projectNote);}catch(e){error=e;tx.abort();}};
   tx.oncomplete=()=>resolve(views);tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Save failed'));
  });
 }
 async getState<T>(key:string):Promise<T|undefined>{return this.transaction(['settings'],'readonly',(tx,done)=>{const q=tx.objectStore('settings').get('ui-v1-'+key);q.onsuccess=()=>done(q.result);});}
 async setState(key:string,value:unknown){return this.transaction<void>(['settings'],'readwrite',(tx,done)=>{tx.objectStore('settings').put(value,'ui-v1-'+key);done();});}
 async compareState(key:string,before:unknown,next:unknown){
  const db=await this.open();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('settings','readwrite'),s=tx.objectStore('settings'),q=s.get('ui-v1-'+key);let error:unknown;
   q.onsuccess=()=>{if(!equal(q.result,before)){error=Error('Conversation changed in another tab · reopen to continue');tx.abort();return;}s.put(next,'ui-v1-'+key);};
   tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Conversation save failed'));
  });
 }
 async reindex(){const records=await this.all();buildIndex(records,{force:true});return records.filter(n=>n.state==='active').length;}
 async search(query:string){const all=await this.all(),explicit=/\b(?:Tools|Settings|Notifications|Schedule\/Runs)\//i.test(query),records=explicit?all:all.filter(n=>!n.ui?.protected&&!['execution','notification'].includes(n.ui?.recordType)&&! /^(?:Tools|Settings|Notifications)\/|^Schedule\/Runs\//i.test(notePath(n)));return searchNotes(records,query,12);}
 async backup(){return makeBackup(await this.all());}
 async checkBackup(text:string){return parseBackup(text);}
 async restore(text:string){const incoming=await parseBackup(text);for(const n of incoming.notes){if(n.ui?.recordType==='schedule'){parseTask(latest(n).body);}else if(n.ui?.recordType==='execution')taskRunView(n);else if(n.ui?.recordType==='notification')noticeView(n);}return this.transaction<any>(['notes'],'readwrite',(tx,done)=>{const s=tx.objectStore('notes'),q=s.getAll();q.onsuccess=()=>{try{const merged=mergeNotes(q.result,incoming.notes);for(const n of merged.notes)if(!q.result.some(x=>x.id===n.id)){if(n.ui?.recordType==='schedule')n.ui={...n.ui,requiresReview:true};s.add(n);}done(merged);}catch(e){tx.abort();}};});}
 close(){this.database?.close();this.database=null;}
}
