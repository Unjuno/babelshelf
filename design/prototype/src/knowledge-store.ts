import {sourceReferenceForView,type SavedSourceRef} from './note-provenance.ts';
import {PendingCorrectionConflictError,makePendingCorrection,validatePendingCorrection,PENDING_CORRECTION_KEY,type PendingCorrection} from './pending-correction.ts';
import {assertDialogueCopySource,validateDialogueCopyRecord,type DialogueCopy} from './dialogue-copy.ts';
import {assertFolderNamespace} from './storage-namespaces.ts';
export {assertFolderNamespace} from './storage-namespaces.ts';
import {findStoredFiles} from './file-discovery.ts';
import type {MemorySearchResult,MemoryPassageResult} from './memory-search-types.ts';
import {noteRestoreCandidates,planNoteRestore,validateNoteRestoreReceipt} from './note-restore.ts';
import {exportMarkdownRevision} from './markdown-export.ts';
import {planSettingsRestore,validateSettingsRestoreReceipt} from './settings-restore.ts';
import {buildInputReadings,validateInputReadings,inputReadingKind,type ReviewedText} from './input-readings.ts';
import {ocrTextNote,type OcrText} from './ocr-text.ts';
import {visionTextNote,type VisionText} from './vision-text.ts';
import {processingKey,processingUpdate,validateProcessing,type ProcessingRecord} from './processing-history.ts';
import type {Activity} from './harness-activity.ts';
import {pdfTextNote,type PdfText} from './pdf-text.ts';
import {deletionContents,canRestore} from './memory-trash.ts';
import {builtinToolUpdates} from './builtin-updates.ts';
import {validateVoiceInputs} from './voice-input.ts';
// The existing PWA database is the only knowledge store. UI objects are projections.
// @ts-expect-error Shared baseline is plain JavaScript.
import {createNote,reviseNote,withdrawNote,latest,validateRefs,validateGroundingRefs,checkNotes,buildIndex,searchNotes,searchStoredNotes,mergeNotes} from '../../../dist/core.js';
// @ts-expect-error Shared baseline is plain JavaScript.
import {notePath} from '../../../dist/files.js';
// @ts-expect-error Shared baseline is plain JavaScript.
import {openDB} from '../../../dist/storage.js';
import {parsePreference,readPreference,restoreDefaultPreferences,formatPreference,preferenceGroup} from './preference-records.ts';
import {validateMemoryFilePath,memoryFolderPath,assertMutableFolder,SYSTEM_FOLDERS,isSystemFolder,MAX_FOLDER_DEPTH} from './memory-paths.ts';
import {parseTask,taskDefinition,taskNextAt,reviseTaskNote,createTaskNote,taskRunView,noticeView,noticeBody,taskNotice,claimTaskRun,finishTaskRun,skipTaskRun,heartbeatRun,type Task,type RunStatus} from './task-records.ts';
import {applyCorrection,undoCorrection,type CorrectionProposal,type CorrectionReceipt} from './note-corrections.ts';
import {makeStateBackup,parseStateBackup,planStateRestore,stateHash,guardRestoredNote,type StateSnapshot,type RestoreMode} from './backup-state.ts';
import {originalNote,originalKey,readOriginal,validateOriginalLinks,checkAttachmentBatch,type OriginalAsset,type OriginalRef} from './original-assets.ts';
import {transcriptNote,type Transcript} from './speech-transcript.ts';
import {validateDialogue,type Dialogue} from './conversation.ts';
export {CorrectionConflictError,prepareCorrection,applyCorrection,undoCorrection,resolveCorrectionTarget,canUndoCorrection,loadCorrectionHistory,runReviewedCorrection} from './note-corrections.ts';

export type NoteView={id:string;path:string;body:string;version:number;history:string[];paths?:string[];protected?:boolean;managed?:boolean;recordType?:'schedule'|'execution'|'notification';nextAt?:string|null;requiresReview?:boolean;readOnly?:boolean;kind?:'original'|'generated';sources?:SavedSourceRef[];dialogueCopy?:DialogueCopy;importedFrom?:{name:string;bytes:number};originalAsset?:OriginalRef;mediaSource?:OriginalRef;vision?:{model:string;revision:string;prompt:string}};
type Canonical=ReturnType<typeof createNote>;
export function projectNote(n:Canonical):NoteView {
 validateDialogueCopyRecord(n);const v=latest(n);return {id:n.id,path:notePath(n),body:v.body,version:v.version,history:n.revisions.slice(0,-1).map((r:any)=>r.body),...(n.kind?{kind:n.kind}:{}),...(Array.isArray(n.sources)?{sources:n.sources.map(sourceReferenceForView)}:{}),paths:n.revisions.map((r:any)=>notePath(n,r.version)),protected:!!n.ui?.protected,managed:!!n.ui?.managed,...(n.ui?.recordType?{recordType:n.ui.recordType,nextAt:n.taskCursor?.nextAt,requiresReview:!!n.ui.requiresReview,readOnly:n.ui.recordType!=='schedule'}:{}),...(n.dialogueCopy?{dialogueCopy:structuredClone(n.dialogueCopy)}:{}),...(n.importedFrom?{importedFrom:n.importedFrom}:{}),...(n.originalAsset?{originalAsset:structuredClone(n.originalAsset)}:{}),...(n.mediaSource?{mediaSource:structuredClone(n.mediaSource)}:{}),...(n.visionText?{vision:{model:n.visionText.model,revision:n.visionText.revision,prompt:n.visionText.prompt}}:{})};
}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function readSnapshot(tx:IDBTransaction,done:(value:StateSnapshot)=>void){
 const result:StateSnapshot={notes:[],settings:[],runs:[]};let pending=5;
 const complete=()=>{if(!--pending)done(result);};
 const notes=tx.objectStore('notes').getAll();notes.onsuccess=()=>{result.notes=notes.result;complete();};
 for(const name of ['settings','runs'] as const){const store=tx.objectStore(name),keys=store.getAllKeys(),values=store.getAll();
  // Both requests share a transaction, so no writer can interleave keys/values.
  const finish=()=>{if(keys.readyState==='done'&&values.readyState==='done')result[name]=keys.result.map((key,i)=>({key:key as string,value:values.result[i]}));};
  keys.onsuccess=()=>{finish();complete();};values.onsuccess=()=>{finish();complete();};
 }
}
export function applyKnowledgeChanges(records:Canonical[],before:NoteView[],after:NoteView[],dialogue?:Dialogue):Canonical[]{
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
   if(!equal(old.dialogueCopy,next.dialogueCopy))throw Error('Dialogue copy origin is immutable');
   if(old.state==='active'&&(!previous||next.version!==previous.version+1||!equal(next.history,[...previous.history,previous.body])))throw Error('Invalid revision history');
   if(old.state==='withdrawn'&&['execution','notification'].includes(old.ui?.recordType)&&(next.body!==latest(old).body||next.path!==notePath(old)))throw Error('Restore exact log before changing it');
   const active={...old,state:'active'};delete active.withdrawnAt;
   result[i]=reviseNote(active,{body:next.body,path:next.path},latest(old).version);
   if(old.ui?.recordType==='schedule'){const task=parseTask(next.body),definition=taskDefinition(task);if(old.taskCursor?.definition!==definition)result[i].taskCursor={definition,nextAt:taskNextAt(task).toISOString()};}
  }else{
   if(next.recordType)throw Error('Register through Schedule');
   if(next.version!==1||next.history.length)throw Error('Invalid new revision');
   if(next.kind==='generated'&&(!Array.isArray(next.sources)||!validateGroundingRefs(records,next.sources).ok))throw Error('Source changed · review before saving');
   const managedGroup=preferenceGroup(next.path),managed=managedGroup&&id==='settings-'+managedGroup;
   if(managedGroup&&managed)parsePreference(managedGroup,next.body);
   const created=createNote({title:next.path.split('/').at(-1)!.replace(/\.md$/i,''),body:next.body,path:next.path,kind:next.kind??'original',sources:next.sources??[]});
   const record={...created,id,...(managed?{ui:{managed:true}}:{}),...(next.importedFrom?{importedFrom:next.importedFrom}:{}),...(next.dialogueCopy?{dialogueCopy:structuredClone(next.dialogueCopy)}:{})};
   validateDialogueCopyRecord(record);if(record.dialogueCopy)assertDialogueCopySource(dialogue,record.dialogueCopy);result.push(record);
  }
 }
 checkNotes(result);for(const note of result)if(!records.some(old=>old.id===note.id)&&note.kind==='generated'&&!validateGroundingRefs(result,note.sources).ok)throw Error('Source changed · review before saving');return result;
}

export function planFolderRename(records:Canonical[],storedFolders:string[],from:string,name:string,expected:NoteView[]){
 assertMutableFolder(from);const inside=(path:string)=>path===from||path.startsWith(from+'/');
 const views=records.filter(n=>n.state==='active').map(projectNote),selected=views.filter(n=>inside(n.path)),prior=expected.filter(n=>inside(n.path));
 const ordered=(notes:NoteView[])=>[...notes].sort((a,b)=>a.id.localeCompare(b.id));
 if(!equal(ordered(selected),ordered(prior)))throw Error('Folder changed · reopen before renaming');
 const folders=[...new Set([...SYSTEM_FOLDERS,...storedFolders,...views.map(n=>n.path.split('/').slice(0,-1).join('/'))].flatMap(path=>path?path.split('/').map((_,i,a)=>a.slice(0,i+1).join('/')):[]))];
 if(!folders.includes(from))throw Error('Folder unavailable');
 const parent=from.split('/').slice(0,-1).join('/'),to=memoryFolderPath(parent,name,[...folders.filter(p=>p!==from),...records.map(n=>notePath(n))]);
 if(to===from)throw Error('No change');const moved=(path:string)=>inside(path)?to+path.slice(from.length):path;
 const nextFolders=folders.map(moved),nextViews=selected.map(n=>({...n,path:moved(n.path),version:n.version+1,history:[...n.history,n.body]}));
 if(nextFolders.some(p=>p.split('/').length>MAX_FOLDER_DEPTH))throw Error('Maximum 5 folder levels');
 const paths=[...views.map(n=>moved(n.path)),...nextFolders];if(new Set(paths.map(p=>p.toLowerCase())).size!==paths.length)throw Error('Name already exists');
 const updated=applyKnowledgeChanges(records,selected,nextViews);
 return {records:updated,folders:nextFolders.filter(p=>!isSystemFolder(p)).sort(),from,to};
}
export type RecoveryBatch={id:string;label:string;notes:NoteView[];folders:string[]};
export type RecoveryAction={kind:'delete';target:{kind:'file'|'folder';value:string};expectedNotes:NoteView[];id:string;label:string}|{kind:'restore';batch:RecoveryBatch};
export function planMemoryRecovery(records:Canonical[],storedFolders:string[],storedTrash:RecoveryBatch[],action:RecoveryAction){
 const views=records.filter(n=>n.state==='active').map(projectNote),folders=[...new Set([...SYSTEM_FOLDERS,...storedFolders,...views.map(n=>n.path.split('/').slice(0,-1).join('/'))].flatMap(path=>path?path.split('/').map((_,i,a)=>a.slice(0,i+1).join('/')):[]))];
 if(action.kind==='delete'){
  const actual=deletionContents(action.target,views,folders),prior=deletionContents(action.target,action.expectedNotes,folders),ordered=(notes:NoteView[])=>[...notes].sort((a,b)=>a.id.localeCompare(b.id));
  if(!equal(ordered(actual.notes),ordered(prior.notes)))throw Error('Item changed · reopen before deleting');
  if(!actual.notes.length&&!actual.folders.length)throw Error('Item unavailable');
  if(!action.id||storedTrash.some(b=>b.id===action.id))throw Error('Recovery identity conflict');
  const batch={id:action.id,label:action.label,...structuredClone(actual)},updated=applyKnowledgeChanges(records,actual.notes,[]);
  return {records:updated,folders:storedFolders.filter(path=>!actual.folders.includes(path)),trash:[...structuredClone(storedTrash),batch]};
 }
 if(action.kind!=='restore')throw Error('Invalid recovery action');
 const batch=action.batch,saved=storedTrash.find(b=>b.id===batch.id);
 if(saved?!equal(saved,batch):batch.notes.length!==1||batch.folders.length!==0||batch.id!=='recovered-'+batch.notes[0].id)throw Error('Recovery batch changed · reopen Trash');
 if(!canRestore(batch,views,folders))throw Error('Restore conflict · name already exists');
 for(const path of batch.folders)assertMutableFolder(path);
 for(const snapshot of batch.notes){
  const note=records.find(n=>n.id===snapshot.id),version=note?.revisions.length;
  if(!note||note.state!=='withdrawn'||!Number.isSafeInteger(snapshot.version)||snapshot.version<1||![snapshot.version,snapshot.version+1].includes(version))throw Error('Recovery snapshot changed · reopen Trash');
  const expected=projectNote({...note,revisions:note.revisions.slice(0,snapshot.version)}),last=projectNote(note);
  if(snapshot.body!==expected.body||snapshot.path!==expected.path||!equal(snapshot.history,expected.history)||snapshot.paths&&!equal(snapshot.paths,expected.paths)||last.body!==snapshot.body||last.path!==snapshot.path)throw Error('Recovery snapshot changed · reopen Trash');
 }
 const updated=applyKnowledgeChanges(records,[],batch.notes);
 return {records:updated,folders:[...new Set([...storedFolders,...batch.folders])],trash:structuredClone(storedTrash.filter(b=>b.id!==batch.id))};
}
export class KnowledgeStore {
 private database:IDBDatabase|null=null;
 private name:string;
 constructor(name='mlb-memory-v1'){this.name=name;}
 async open(){if(!this.database)this.database=await openDB(this.name);return this.database!;}
 private async transaction<T>(stores:string[],mode:IDBTransactionMode,run:(tx:IDBTransaction,done:(v:T)=>void,fail:(error:unknown)=>void)=>void,signal?:AbortSignal):Promise<T>{
  if(signal?.aborted)throw Error('Stopped');
  const guarded=mode==='readwrite'&&stores.includes('notes'),scope=guarded?[...new Set([...stores,'settings'])]:stores;const db=await this.open();if(signal?.aborted)throw Error('Stopped');return new Promise((resolve,reject)=>{const tx=db.transaction(scope,mode);let value:T,error:unknown,stopped=false;
   const cleanup=()=>signal?.removeEventListener('abort',abort);
   const abort=()=>{stopped=true;try{tx.abort();}catch{/* The transaction may already be complete. */}};
   signal?.addEventListener('abort',abort,{once:true});
   const fail=(e:unknown)=>{error=e;tx.abort();};
   try{run(tx,v=>{value=v;if(guarded){const rows=tx.objectStore('notes').getAll(),folders=tx.objectStore('settings').get('ui-v1-folders');let pending=2;const check=()=>{if(--pending)return;try{assertFolderNamespace(rows.result,folders.result??[]);}catch(e){fail(e);}};rows.onsuccess=check;folders.onsuccess=check;}},fail);}catch(e){fail(e);}
   tx.addEventListener('error',()=>{error??=tx.error;});
   tx.oncomplete=()=>{cleanup();resolve(value);};tx.onabort=()=>{cleanup();reject(stopped?Error('Stopped'):error??tx.error??Error('Save failed'));};
  });
 }
 async initialize(defaults:NoteView[]){
  return this.transaction<NoteView[]>(['notes'],'readwrite',(tx,done,fail)=>{const store=tx.objectStore('notes'),q=store.getAll();q.onsuccess=()=>{
   try{const records=q.result;for(const seed of defaults){if(records.some(n=>n.id===seed.id))continue;
    const note={...createNote({title:seed.path.split('/').at(-1),body:seed.body,path:seed.path}),id:seed.id,ui:{protected:!!seed.protected,managed:!!seed.managed}};records.push(note);store.add(note);
   }
   for(const update of builtinToolUpdates(records,defaults)){records[records.findIndex(n=>n.id===update.id)]=update;store.put(update);}
   // Connection mode is a durable user preference. Offline remains the default,
   // but a deliberate Online choice must survive a normal PWA restart/reload.
   // Malformed settings are retained for explicit recovery; never rewrite user data here.
   checkNotes(records);done(records.filter(n=>n.state==='active').map(projectNote));}catch(e){fail(e);}
  };});
 }
 async all(signal?:AbortSignal):Promise<Canonical[]>{return this.transaction(['notes'],'readonly',(tx,done)=>{const q=tx.objectStore('notes').getAll();q.onsuccess=()=>done(q.result);},signal);}
 async views(signal?:AbortSignal){return (await this.all(signal)).filter(n=>n.state==='active').map(projectNote);}
 // Preparation needs only these two canonical records, even with a large diary.
 async preparationSettings(){
  return this.transaction<{models:ReturnType<typeof readPreference<'models'>>;connection:ReturnType<typeof readPreference<'connection'>>}>(['notes'],'readonly',(tx,done,fail)=>{
   const records:NoteView[]=[];let pending=2;
   for(const group of ['models','connection'] as const){const request=tx.objectStore('notes').get('settings-'+group);request.onsuccess=()=>{try{
    if(!request.result||request.result.state!=='active')throw Error('Settings unavailable · reopen Models');
    records.push(projectNote(request.result));if(!--pending)done({models:readPreference('models',records),connection:readPreference('connection',records)});
   }catch(error){fail(error);}};}
  });
 }
 async original(ref:OriginalRef):Promise<OriginalAsset>{const asset=await this.transaction<OriginalAsset>(['runs'],'readonly',(tx,done)=>{const q=tx.objectStore('runs').get(originalKey(ref.id));q.onsuccess=()=>done(q.result);});readOriginal(asset,ref);return asset;}
 private saveReading(id:string,originalId:string,newOriginal:OriginalAsset|undefined,duplicateError:string,build:(asset:OriginalAsset)=>Canonical){
  return this.transaction<Canonical>(['notes','runs'],'readwrite',(tx,done,fail)=>{
   const raw=tx.objectStore('runs').get(originalKey(originalId)),notes=tx.objectStore('notes').getAll();let finished=0;
   const commit=()=>{if(++finished!==2)return;try{
    const original=notes.result.find(n=>n.id===originalId);
    if(newOriginal&&(original||raw.result))throw Error('Original already exists');
    if(!newOriginal&&(!original||original.state!=='active'))throw Error('Original withdrawn');
    if(notes.result.some(n=>n.id===id))throw Error(duplicateError);
    // Each reader builder still validates its own original pin, hash, model,
    // coordinates/pages/timing. The shared transaction owns only persistence.
    const note=build(newOriginal??raw.result),created=newOriginal?[originalNote(newOriginal)]:[];
    checkNotes([...notes.result,...created,note]);
    if(newOriginal){tx.objectStore('runs').add(newOriginal,originalKey(newOriginal.id));tx.objectStore('notes').add(created[0]);}
    tx.objectStore('notes').add(note);done(note);
   }catch(error){fail(error);}};
   raw.onsuccess=commit;notes.onsuccess=commit;
  });
 }
 async saveTranscript(id:string,value:Transcript,newOriginal?:OriginalAsset){
  return this.saveReading(id,value.original.id,newOriginal,'Transcript already saved',asset=>transcriptNote(id,asset,value));
 }
 async savePdfText(id:string,value:PdfText,newOriginal?:OriginalAsset){
  return this.saveReading(id,value.original.id,newOriginal,'PDF text already saved',asset=>pdfTextNote(id,asset,value));
 }
 async saveOcrText(id:string,value:OcrText,newOriginal?:OriginalAsset){
  return this.saveReading(id,value.original.id,newOriginal,'OCR text already saved',asset=>ocrTextNote(id,asset,value));
 }
 async saveVisionText(id:string,value:VisionText,newOriginal?:OriginalAsset){
  return this.saveReading(id,value.original.id,newOriginal,'Vision note already saved',asset=>visionTextNote(id,asset,value));
 }
 async submitInput(expected:Dialogue|undefined,next:Dialogue,originals:OriginalAsset[],readings:ReviewedText[]=[]){
  validateDialogue(next);checkAttachmentBatch(originals.map(a=>({size:a.bytes})));const created=originals.map(originalNote);
  if(next.revision!==(expected?.revision??0)+1||next.turns.length!==(expected?.turns.length??0)+1||stateHash(next.turns.slice(0,-1))!==stateHash(expected?.turns??[]))throw Error('Invalid submitted input');
  const turn=next.turns.at(-1)!,ids=new Set(originals.map(a=>a.id));if(ids.size!==originals.length||!Array.isArray(turn.attachments)||new Set(turn.attachments.map(a=>a.id)).size!==turn.attachments.length||[...ids].some(id=>!turn.attachments!.some(a=>a.id===id))||turn.attachments.some(a=>!a.asset||a.asset.id!==a.id))throw Error('Attachment input mismatch');
  const db=await this.open();return new Promise<any[]>((resolve,reject)=>{const tx=db.transaction(['notes','settings','runs'],'readwrite');let error:unknown,inputNotes=created;
   readSnapshot(tx,current=>{try{
    if(stateHash(current.settings.find(s=>s.key==='ui-v1-dialogue')?.value)!==stateHash(expected))throw Error('Conversation changed in another tab · reopen to continue');
    if(created.some(n=>current.notes.some(old=>old.id===n.id))||originals.some(a=>current.runs.some(r=>r.key===originalKey(a.id))))throw Error('Original already saved');
    const runs=[...current.runs,...originals.map(a=>({key:originalKey(a.id),value:a}))],derived=buildInputReadings(readings,runs),notes=[...current.notes,...created,...derived];inputNotes=[...created,...derived];if(derived.some(n=>!turn.attachments!.some(a=>a.reading?.noteId===n.id&&a.reading?.kind===inputReadingKind(n))))throw Error('Input reading mismatch');checkNotes(notes);assertFolderNamespace(notes,current.settings.find(s=>s.key==='ui-v1-folders')?.value??[]);validateOriginalLinks(notes,[{key:'ui-v1-dialogue',value:next}],runs);validateVoiceInputs(next,runs);validateInputReadings(next,notes,runs);
    for(const a of turn.attachments!)if(a.reading&&!notes.some(n=>n.id===a.reading?.noteId&&n.state==='active'&&latest(n).version===a.reading?.revision))throw Error('Input source changed');
    for(const a of turn.attachments!)if(!notes.some(n=>n.id===a.id&&n.originalAsset&&n.state==='active'))throw Error('Original withdrawn or unavailable');
    checkAttachmentBatch(turn.attachments!.map(a=>({size:runs.find(r=>r.key===originalKey(a.id))!.value.bytes})));
    for(const n of [...created,...derived])tx.objectStore('notes').add(n);for(const a of originals)tx.objectStore('runs').add(a,originalKey(a.id));tx.objectStore('settings').put(next,'ui-v1-dialogue');
   }catch(e){error=e;tx.abort();}});tx.oncomplete=()=>resolve(inputNotes);tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Original save failed'));
  });
 }
 async corrections(noteId?:string):Promise<CorrectionReceipt[]>{return this.transaction(['runs'],'readonly',(tx,done)=>{const q=tx.objectStore('runs').getAll();q.onsuccess=()=>done(q.result.filter(r=>r?.type==='note-correction'&&r.schema===1&&(!noteId||r.noteId===noteId)).sort((a,b)=>b.appliedAt.localeCompare(a.appliedAt)));});}
 async settingsRecoveryHistory(noteId:string){
  const db=await this.open();return new Promise<{id:string;appliedAt:string;source:any}[]>((resolve,reject)=>{
   const tx=db.transaction(['notes','runs'],'readonly'),notes=tx.objectStore('notes').getAll(),q=tx.objectStore('runs').getAll(IDBKeyRange.bound('ui-v1-settings-restore-','ui-v1-settings-restore-\uffff'));
   let rows:{id:string;appliedAt:string;source:any}[]=[],error:unknown;
   q.onsuccess=()=>{try{for(const receipt of q.result){validateSettingsRestoreReceipt('ui-v1-settings-restore-'+receipt.id,receipt,notes.result);const change=receipt.changes.find((c:any)=>c.noteId===noteId);if(change)rows.push({id:receipt.id,appliedAt:receipt.appliedAt,source:change.source});}rows.sort((a,b)=>b.appliedAt.localeCompare(a.appliedAt));}catch(e){error=e;tx.abort();}};
   tx.oncomplete=()=>resolve(rows);tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Recovery history unavailable'));
  });
 }
 async stageCorrection(proposal:CorrectionProposal,turnId?:string,signal?:AbortSignal):Promise<PendingCorrection>{
  if(signal?.aborted)throw Error('Stopped');const pending=makePendingCorrection(proposal,turnId),db=await this.open();if(signal?.aborted)throw Error('Stopped');
  return new Promise((resolve,reject)=>{const tx=db.transaction(['notes','settings'],'readwrite'),settings=tx.objectStore('settings'),prior=settings.get(PENDING_CORRECTION_KEY),rows=tx.objectStore('notes').getAll();let left=2,result=pending,error:unknown,stopped=false;
   const abort=()=>{stopped=true;try{tx.abort();}catch{}};signal?.addEventListener('abort',abort,{once:true});
   const cleanup=()=>signal?.removeEventListener('abort',abort);
   const commit=()=>{if(--left)return;try{if(signal?.aborted)throw Error('Stopped');applyCorrection(rows.result,proposal);if(prior.result!==undefined){const existing=validatePendingCorrection(prior.result);if(!equal(existing.proposal,proposal)||existing.turnId!==turnId)throw Error('Review pending changes first');result=existing;}else settings.put(pending,PENDING_CORRECTION_KEY);}catch(e){error=e;tx.abort();}};prior.onsuccess=commit;rows.onsuccess=commit;
   tx.oncomplete=()=>{cleanup();resolve(result);};tx.onabort=tx.onerror=()=>{cleanup();reject(stopped?Error('Stopped'):error??tx.error??Error('Could not save review'));};
  });
 }
 async discardCorrection(expected:unknown){
  const db=await this.open();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('settings','readwrite'),settings=tx.objectStore('settings'),q=settings.get(PENDING_CORRECTION_KEY);let error:unknown;
   q.onsuccess=()=>{if(!equal(q.result,expected)){error=new PendingCorrectionConflictError();tx.abort();return;}settings.delete(PENDING_CORRECTION_KEY);};
   tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Could not discard review'));
  });
 }
 async approveCorrection(proposal:CorrectionProposal,pending?:PendingCorrection){
  const db=await this.open();return new Promise<CorrectionReceipt>((resolve,reject)=>{
   const tx=db.transaction(['notes','runs',...(pending?['settings']:[])],'readwrite'),notes=tx.objectStore('notes'),runs=tx.objectStore('runs'),prior=runs.get('ui-v1-correction-'+proposal.id);let receipt:CorrectionReceipt,error:unknown;
   const saved=pending?tx.objectStore('settings').get(PENDING_CORRECTION_KEY):null;
   prior.onsuccess=()=>{if(prior.result){error=Error('Correction already applied');tx.abort();return;}const q=notes.getAll();q.onsuccess=()=>{try{if(pending){validatePendingCorrection(pending);if(!equal(saved?.result,pending)||!equal(pending.proposal,proposal))throw new PendingCorrectionConflictError();}const result=applyCorrection(q.result,proposal);notes.put(result.note);runs.add(result.receipt,'ui-v1-correction-'+result.receipt.id);if(pending)tx.objectStore('settings').delete(PENDING_CORRECTION_KEY);receipt=result.receipt;}catch(e){error=e;tx.abort();}};};
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
  const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(['notes','settings'],'readwrite'),s=tx.objectStore('notes'),q=s.getAll(),folders=tx.objectStore('settings').get('ui-v1-folders');let pending=2,value:T,error:unknown;
   const commit=()=>{if(--pending)return;try{const result=change(q.result);const map=new Map(q.result.map(n=>[n.id,n]));for(const n of result.put)map.set(n.id,n);checkNotes([...map.values()]);assertFolderNamespace([...map.values()],folders.result??[]);for(const n of result.put)s.put(n);value=result.value;}catch(e){error=e;tx.abort();}};q.onsuccess=commit;folders.onsuccess=commit;
   tx.oncomplete=()=>resolve(value);tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Save failed'));
  });
 }
 async putTask(task:Task,id?:string,expected?:number,creationId?:string){return this.editRecords(records=>{
  let note;if(id){const old=records.find(n=>n.id===id&&n.state==='active');if(!old||old.ui?.recordType!=='schedule'||latest(old).version!==expected)throw Error('Version conflict · reload schedule');note=reviseTaskNote(old,task);}
  else note=createTaskNote(records,task,creationId);
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
 async restoreDefaults(expected:NoteView[]){
  return this.transaction<void>(['notes'],'readwrite',(tx,done,fail)=>{const store=tx.objectStore('notes'),q=store.getAll();q.onsuccess=()=>{
   try{const before=q.result.filter(n=>n.state==='active').map(projectNote);
    for(const id of ['settings-models','settings-appearance','settings-connection','settings-harness']){
     const reviewed=expected.filter(n=>n.id===id),current=before.find(n=>n.id===id);
     if(reviewed.length!==1||!current||!equal(current,reviewed[0]))throw Error('Settings changed · cancel and reopen');
    }
    const updated=applyKnowledgeChanges(q.result,before,restoreDefaultPreferences(before));
    for(const note of updated)if(!equal(q.result.find(n=>n.id===note.id),note))store.put(note);
    done();
   }catch(e){fail(e);}
  };});
 }
 async commit(before:NoteView[],after:NoteView[]){
  const db=await this.open();return new Promise<NoteView[]>((resolve,reject)=>{const tx=db.transaction(['notes','settings'],'readwrite'),store=tx.objectStore('notes'),q=store.getAll(),folders=tx.objectStore('settings').get('ui-v1-folders'),dialogue=tx.objectStore('settings').get('ui-v1-dialogue');let pending=3,error:unknown,views:NoteView[];
   const commit=()=>{if(--pending)return;try{const updated=applyKnowledgeChanges(q.result,before,after,dialogue.result);assertFolderNamespace(updated,folders.result??[]);for(const n of updated)if(!equal(q.result.find(x=>x.id===n.id),n))store.put(n);views=updated.filter(n=>n.state==='active').map(projectNote);}catch(e){error=e;tx.abort();}};q.onsuccess=commit;folders.onsuccess=commit;dialogue.onsuccess=commit;
   tx.oncomplete=()=>resolve(views);tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Save failed'));
  });
 }
 async createFolder(path:string,expected:string[]|undefined){const db=await this.open();return new Promise<{path:string;folders:string[]}>((resolve,reject)=>{const tx=db.transaction(['notes','settings'],'readwrite'),store=tx.objectStore('settings'),rows=tx.objectStore('notes').getAll(),folders=store.get('ui-v1-folders');let pending=2,error:unknown,result:{path:string;folders:string[]};const commit=()=>{if(--pending)return;try{if(!equal(folders.result,expected))throw Error('Local data changed in another tab · reopen to continue');const old=folders.result??[],occupied=[...old];for(const n of rows.result){const parts=notePath(n).split('/');while(parts.length){occupied.push(parts.join('/'));parts.pop();}}const parts=path.split('/'),name=parts.pop()??'',clean=memoryFolderPath(parts.join('/'),name,occupied);if(clean!==path)throw Error('Invalid folder path');const next=[...old,clean];assertFolderNamespace(rows.result,next);store.put(next,'ui-v1-folders');result={path:clean,folders:next};}catch(e){error=e;tx.abort();}};rows.onsuccess=commit;folders.onsuccess=commit;tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Folder save failed'));});}
 async renameFolder(from:string,name:string,expectedNotes:NoteView[],expectedFolders:string[]|undefined){
  const db=await this.open();return new Promise<{folders:string[];from:string;to:string}>((resolve,reject)=>{
   const tx=db.transaction(['notes','settings'],'readwrite'),notes=tx.objectStore('notes'),settings=tx.objectStore('settings'),rows=notes.getAll(),folders=settings.get('ui-v1-folders');let pending=2,error:unknown,result:{folders:string[];from:string;to:string};
   const commit=()=>{if(--pending)return;try{
    if(!equal(folders.result,expectedFolders))throw Error('Folders changed · reopen before renaming');
    const plan=planFolderRename(rows.result,folders.result??[],from,name,expectedNotes);
    assertFolderNamespace(plan.records,plan.folders);for(const note of plan.records)if(!equal(rows.result.find(n=>n.id===note.id),note))notes.put(note);
    settings.put(plan.folders,'ui-v1-folders');result={folders:plan.folders,from:plan.from,to:plan.to};
   }catch(e){error=e;tx.abort();}};rows.onsuccess=commit;folders.onsuccess=commit;
   tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Folder rename failed'));
  });
 }
 async recoverMemory(action:RecoveryAction,expectedFolders:string[]|undefined,expectedTrash:RecoveryBatch[]|undefined){
  const db=await this.open();return new Promise<{folders:string[];trash:RecoveryBatch[]}>((resolve,reject)=>{
   const tx=db.transaction(['notes','settings'],'readwrite'),notes=tx.objectStore('notes'),settings=tx.objectStore('settings'),rows=notes.getAll(),folders=settings.get('ui-v1-folders'),trash=settings.get('ui-v1-trash');let pending=3,error:unknown,result:{folders:string[];trash:RecoveryBatch[]};
   const commit=()=>{if(--pending)return;try{
    if(!equal(folders.result,expectedFolders)||!equal(trash.result,expectedTrash))throw Error('Recovery data changed · reopen app');
    const plan=planMemoryRecovery(rows.result,folders.result??[],trash.result??[],action);
    assertFolderNamespace(plan.records,plan.folders);for(const note of plan.records)if(!equal(rows.result.find(n=>n.id===note.id),note))notes.put(note);
    settings.put(plan.folders,'ui-v1-folders');settings.put(plan.trash,'ui-v1-trash');result={folders:plan.folders,trash:plan.trash};
   }catch(e){error=e;tx.abort();}};rows.onsuccess=commit;folders.onsuccess=commit;trash.onsuccess=commit;
   tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Recovery save failed'));
  });
 }
 async exportMarkdown(id:string,revision:number){
  const db=await this.open();return new Promise<ReturnType<typeof exportMarkdownRevision>>((resolve,reject)=>{
   const tx=db.transaction('notes','readonly'),q=tx.objectStore('notes').get(id);let error:unknown,file:ReturnType<typeof exportMarkdownRevision>;
   q.onsuccess=()=>{try{file=exportMarkdownRevision(q.result,revision);}catch(e){error=e;tx.abort();}};
   tx.oncomplete=()=>resolve(file);tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Markdown export failed'));
  });
 }
 async getState<T>(key:string):Promise<T|undefined>{return this.transaction(['settings'],'readonly',(tx,done)=>{const q=tx.objectStore('settings').get('ui-v1-'+key);q.onsuccess=()=>done(q.result);});}
 async setState(key:string,value:unknown){return this.transaction<void>(['settings'],'readwrite',(tx,done)=>{tx.objectStore('settings').put(value,'ui-v1-'+key);done();});}
 async compareState(key:string,before:unknown,next:unknown){
  if(key==='dialogue')validateDialogue(next);
  const db=await this.open();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('settings','readwrite'),s=tx.objectStore('settings'),q=s.get('ui-v1-'+key);let error:unknown;
   q.onsuccess=()=>{if(!equal(q.result,before)){error=Error(key==='dialogue'?'Conversation changed in another tab · reopen to continue':'Local data changed in another tab · reopen to continue');tx.abort();return;}s.put(next,'ui-v1-'+key);};
   tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Conversation save failed'));
  });
 }
 async reindex(){const records=await this.all();buildIndex(records,{force:true});return records.filter(n=>n.state==='active').length;}
 search(query:string,stored:true,signal?:AbortSignal):Promise<MemorySearchResult[]>;
 search(query:string,stored?:false,signal?:AbortSignal):Promise<MemoryPassageResult[]>;
 async search(query:string,stored=false,signal?:AbortSignal):Promise<MemorySearchResult[]>{const all=await this.all(signal);signal?.throwIfAborted();const explicit=/\b(?:Tools|Settings|Notifications|Schedule\/Runs)\//i.test(query),records=explicit?all:all.filter(n=>!n.ui?.protected&&!['execution','notification'].includes(n.ui?.recordType)&&! /^(?:Tools|Settings|Notifications)\/|^Schedule\/Runs\//i.test(notePath(n)));if(!stored)return searchNotes(records,query,12) as MemoryPassageResult[];const text=searchStoredNotes(records,query,12) as MemoryPassageResult[],ids=new Set(text.map(result=>result.noteId));return [...findStoredFiles(records,query).filter(file=>!ids.has(file.noteId)),...text].slice(0,12);}
 async processingHistory():Promise<Activity[]>{
  const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(['runs'],'readonly'),range=IDBKeyRange.bound(processingKey(''),processingKey('')+'\uffff'),q=tx.objectStore('runs').openCursor(range),items:Activity[]=[];let error:unknown;
   q.onsuccess=()=>{const cursor=q.result;if(!cursor)return;try{validateProcessing(String(cursor.key),cursor.value);items.push(structuredClone(cursor.value.activity));cursor.continue();}catch(e){error=e;tx.abort();}};
   tx.oncomplete=()=>resolve(items.sort((a,b)=>b.startedAt.localeCompare(a.startedAt)||b.id.localeCompare(a.id)));tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Processing history unavailable'));
  });
 }
 async recordProcessing(next:Activity):Promise<void>{
  const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(['runs'],'readwrite'),store=tx.objectStore('runs'),key=processingKey(next.id),q=store.get(key);let error:unknown;
   q.onsuccess=()=>{try{store.put(processingUpdate(q.result as ProcessingRecord|undefined,next),key);}catch(e){error=e;tx.abort();}};
   tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Processing record unavailable'));
  });
 }
 async snapshot():Promise<StateSnapshot>{return this.transaction(['notes','settings','runs'],'readonly',(tx,done)=>readSnapshot(tx,done));}
 async backup(){return makeStateBackup(await this.snapshot());}
 async checkBackup(text:string){return parseStateBackup(text);}
 async reviewBackup(text:string){const payload=await this.checkBackup(text),current=await this.snapshot(),plan=planStateRestore(current,payload);let newOnly=false,newOnlyError='';
  if(payload.schema===2&&plan.conflicts.length&&Object.values(plan.added).some(n=>n>0)){try{newOnly=!!planStateRestore(current,payload,'new-only').writes;}catch{newOnlyError='New records conflict with current data';}}
  let settingsRecovery:{group:string;noteId:string;before:string;after:string;beforeVersion:number;sourceVersion:number}[]=[];
  try{settingsRecovery=planSettingsRestore(current,payload).changes.map(({source,...change})=>({...change,sourceVersion:latest(source).version}));}catch{/* Unsupported settings never enable the separate recovery action. */}
  return {schema:payload.schema,expected:stateHash(current),conflicts:plan.conflicts,added:plan.added,newOnly,newOnlyError,settingsRecovery,noteRecovery:noteRestoreCandidates(current,payload).map(({source,...change})=>change),total:{notes:payload.notes.length,settings:payload.settings?.length??0,runs:payload.runs?.length??0,originals:payload.runs?.filter(r=>r.value?.type==='original-asset').length??0}};}
 async noteRecoveryHistory(noteId:string){
  const db=await this.open();return new Promise<{id:string;appliedAt:string;source:any}[]>((resolve,reject)=>{
   const tx=db.transaction(['notes','runs'],'readonly'),notes=tx.objectStore('notes').getAll(),q=tx.objectStore('runs').getAll(IDBKeyRange.bound('ui-v1-note-restore-','ui-v1-note-restore-\uffff'));let rows:{id:string;appliedAt:string;source:any}[]=[],error:unknown;
   q.onsuccess=()=>{try{for(const receipt of q.result){validateNoteRestoreReceipt('ui-v1-note-restore-'+receipt.id,receipt,notes.result);if(receipt.noteId===noteId)rows.push({id:receipt.id,appliedAt:receipt.appliedAt,source:receipt.source});}rows.sort((a,b)=>b.appliedAt.localeCompare(a.appliedAt));}catch(e){error=e;tx.abort();}};tx.oncomplete=()=>resolve(rows);tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Recovery history unavailable'));
  });
 }
 async restoreNote(text:string,expected:string,noteId:string){
  if(!expected)throw Error('Review note before restoring');const incoming=await parseStateBackup(text),backupHash=JSON.parse(text).sha256,db=await this.open();
  return new Promise<void>((resolve,reject)=>{const tx=db.transaction(['notes','settings','runs'],'readwrite');let error:unknown;
   readSnapshot(tx,current=>{try{if(stateHash(current)!==expected)throw Error('Local data changed · review backup again');const {change,write}=planNoteRestore(current,incoming,noteId),id=crypto.randomUUID(),receipt={schema:1,type:'note-restore',id,appliedAt:new Date().toISOString(),backupHash,noteId,beforeVersion:change.beforeVersion,afterVersion:change.beforeVersion+1,source:change.source};validateNoteRestoreReceipt('ui-v1-note-restore-'+id,receipt,current.notes.map(n=>n.id===noteId?write:n));tx.objectStore('notes').put(write);tx.objectStore('runs').add(receipt,'ui-v1-note-restore-'+id);}catch(e){error=e;tx.abort();}});
   tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Note restore failed'));
  });
 }
 async restoreSettings(text:string,expected:string){
  if(!expected)throw Error('Review settings before restoring');
  const incoming=await parseStateBackup(text),backupHash=JSON.parse(text).sha256,db=await this.open();
  return new Promise<number>((resolve,reject)=>{
   const tx=db.transaction(['notes','settings','runs'],'readwrite');let count=0,error:unknown;
   readSnapshot(tx,current=>{try{
    if(stateHash(current)!==expected)throw Error('Local data changed · review backup again');
    const plan=planSettingsRestore(current,incoming);if(!plan.changes.length)throw Error('No settings changes');
    const id=crypto.randomUUID(),receipt={schema:1,type:'settings-restore',id,appliedAt:new Date().toISOString(),backupHash,changes:plan.changes.map(c=>({group:c.group,noteId:c.noteId,beforeVersion:c.beforeVersion,afterVersion:c.beforeVersion+1,source:c.source}))};
    validateSettingsRestoreReceipt('ui-v1-settings-restore-'+id,receipt,current.notes.map(n=>plan.writes.find(w=>w.id===n.id)??n));
    for(const note of plan.writes)tx.objectStore('notes').put(note);
    tx.objectStore('runs').add(receipt,'ui-v1-settings-restore-'+id);count=plan.writes.length;
   }catch(e){error=e;tx.abort();}});
   tx.oncomplete=()=>resolve(count);tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Settings restore failed'));
  });
 }
 async restore(text:string,expected?:string,mode:RestoreMode='strict'){
  if(mode!=='strict'&&mode!=='new-only')throw Error('Invalid restore mode');
  if(mode==='new-only'&&!expected)throw Error('Review backup before restoring new records');
  const incoming=await parseStateBackup(text);
  if(mode==='new-only'&&incoming.schema!==2)throw Error('New-only restore requires schema2');
  if(incoming.schema===1){for(const n of incoming.notes){if(n.ui?.recordType==='schedule')parseTask(latest(n).body);else if(n.ui?.recordType==='execution')taskRunView(n);else if(n.ui?.recordType==='notification')noticeView(n);}}
  const db=await this.open();return new Promise<{conflicts:any[];added:{notes:number;settings:number;runs:number};restored:boolean}>((resolve,reject)=>{
   const tx=db.transaction(['notes','settings','runs'],'readwrite');let result:{conflicts:any[];added:{notes:number;settings:number;runs:number};restored:boolean},error:unknown;
   readSnapshot(tx,current=>{try{
    if(expected&&expected!==stateHash(current))throw Error('Local data changed · review backup again');
    if(incoming.schema===1){const merged=mergeNotes(current.notes,incoming.notes);assertFolderNamespace(merged.notes,current.settings.find(s=>s.key==='ui-v1-folders')?.value??[]);const fresh=merged.notes.filter((n:any)=>!current.notes.some(old=>old.id===n.id));for(const n of fresh)tx.objectStore('notes').add(guardRestoredNote(n));result={conflicts:merged.conflicts,added:{notes:fresh.length,settings:0,runs:0},restored:true};return;}
    const plan=planStateRestore(current,incoming,mode);if(!plan.writes){result={conflicts:plan.conflicts,added:{notes:0,settings:0,runs:0},restored:false};return;}
    for(const note of plan.writes.notes)tx.objectStore('notes').add(note);
    for(const store of ['settings','runs'] as const)for(const entry of plan.writes[store])tx.objectStore(store).add(entry.value,entry.key);
    result={conflicts:plan.conflicts,added:plan.added,restored:true};
   }catch(e){error=e;tx.abort();}});
   tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(error??tx.error??Error('Restore failed'));
  });
 }
 close(){this.database?.close();this.database=null;}
}
