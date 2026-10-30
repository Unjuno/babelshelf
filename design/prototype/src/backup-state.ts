import {validatePendingCorrection,PENDING_CORRECTION_KEY} from './pending-correction.ts';
import {encodeBackupValue,stateHash} from './backup-hash.ts';
export {stateHash} from './backup-hash.ts';
import {validateHistoricalSourceRefs as sourceRefs} from './historical-source-refs.ts';
import {validateDialogueCopyRecord} from './dialogue-copy.ts';
import {assertFolderNamespace} from './storage-namespaces.ts';
import {validateFileResultLinks} from './file-discovery.ts';
import {validateNoteRestoreReceipt} from './note-restore.ts';
import {utf8BytesWithin,visitUtf8Chunks} from './utf8-text.ts';
import {visitJsonChunks} from './json-chunks.ts';
import {validateWorkingFileLink} from './working-file.ts';
import {validateOcrLinks} from './ocr-text.ts';
import {validateVisionLinks} from './vision-text.ts';
import {validateSettingsRestoreReceipt} from './settings-restore.ts';
import {validateProcessing} from './processing-history.ts';
import {validatePdfLinks} from './pdf-text.ts';
import {validateInputReadings} from './input-readings.ts';
import {validateVoiceInputs} from './voice-input.ts';
import {validateTranscriptLinks} from './speech-transcript.ts';
// Portable local data, never runtime readiness, executable tools or write authority.
// @ts-expect-error Shared baseline core is JavaScript.
import {checkNotes,latest,reviseNote,parseBackup} from '../../../dist/core.js';
// @ts-expect-error Shared paths are JavaScript.
import {notePath} from '../../../dist/files.js';
import {validateDialogue} from './conversation.ts';
import {parsePreference,preferenceGroup,formatPreference} from './preference-records.ts';
import {parseTask,taskDefinition,taskRunView,noticeView,validateNoticeLinks,validateRunCalculation} from './task-records.ts';
import {verifyHistoricalCorrection,correctionOperationRaw} from './note-corrections.ts';
import {memoryFolderPath} from './memory-paths.ts';
import {validateOriginalLinks} from './original-assets.ts';

export type Entry={key:string;value:any};
export type StateSnapshot={notes:any[];settings:Entry[];runs:Entry[]};
export type StatePayload={schema:1|2;createdAt:string;notes:any[];settings?:Entry[];runs?:Entry[];excluded?:string[]};
export type RestoreConflict={store:'notes'|'settings'|'runs';key:string;label:string};
export type StateRestorePlan={conflicts:RestoreConflict[];added:{notes:number;settings:number;runs:number};writes:StateSnapshot|null};
const excluded=['model-assets','runtime-assets','unsaved-drafts','unpersisted-attachments'];
export const MAX_BACKUP_BYTES=200000000;
function checkBackupText(text:string,limit=MAX_BACKUP_BYTES){if(!utf8BytesWithin(text,limit))throw Error('Backup too large · 200 MB limit');return text;}
export function serializeStateBackup(pack:unknown,limit=MAX_BACKUP_BYTES){return checkBackupText(JSON.stringify(pack),limit);}
function backupBytes(pack:unknown,visit:(bytes:Uint8Array)=>void,limit=MAX_BACKUP_BYTES){let count=0;visitJsonChunks(pack,text=>visitUtf8Chunks(text,bytes=>{count+=bytes.length;if(count>limit)throw Error('Backup too large · 200 MB limit');visit(bytes);}));}
export function stateBackupBlob(pack:unknown,limit=MAX_BACKUP_BYTES){const parts:BlobPart[]=[];backupBytes(pack,bytes=>parts.push(bytes.slice().buffer),limit);return new Blob(parts,{type:'application/json'});}
const equal=(a:unknown,b:unknown)=>stateHash(a)===stateHash(b);
function jsonOnly(value:any){
 if(value===undefined||value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
 if(Array.isArray(value)){for(const item of value)jsonOnly(item);return;}
 if(value&&Object.getPrototypeOf(value)===Object.prototype){for(const item of Object.values(value))jsonOnly(item);return;}
 throw Error('Backup contains unsupported non-JSON data');
}
function entries(list:Entry[]){
 if(!Array.isArray(list)||list.length>20000)throw Error('Invalid backup entries');const keys=new Set<string>();
 for(const item of list){if(!item||typeof item.key!=='string'||!item.key||keys.has(item.key))throw Error('Invalid or duplicate backup key');keys.add(item.key);jsonOnly(item.value);}
}
function validateState(state:StateSnapshot){
 jsonOnly(state);checkNotes(state.notes);entries(state.settings);entries(state.runs);validateOriginalLinks(state.notes,state.settings,state.runs);validateTranscriptLinks(state.notes,state.runs);validatePdfLinks(state.notes,state.runs);validateOcrLinks(state.notes,state.runs);validateVisionLinks(state.notes,state.runs);validateVoiceInputs(state.settings.find(s=>s.key==='ui-v1-dialogue')?.value,state.runs);validateInputReadings(state.settings.find(s=>s.key==='ui-v1-dialogue')?.value,state.notes,state.runs);
 for(const n of state.notes){validateDialogueCopyRecord(n);const path=notePath(n),group=preferenceGroup(path);
  if(n.ui?.managed&&group)parsePreference(group,latest(n).body);
  if(n.ui?.recordType==='schedule')parseTask(latest(n).body);
  if(n.ui?.recordType==='execution'){const r=taskRunView(n);if(typeof r.startedAt!=='string'||!['running','succeeded','failed','stopped','missed','interrupted','skipped'].includes(r.status)||!state.notes.some(t=>t.id===r.taskId&&t.revisions.some((v:any)=>v.version===r.taskRevision)))throw Error('Invalid execution target');sourceRefs(state.notes,r.sources??[]);for(const revision of n.revisions){const history=taskRunView({...n,revisions:[revision]});if(history.calculation!==undefined){validateRunCalculation(history);const source=state.notes.find(t=>t.id===history.taskId)?.revisions.find((v:any)=>v.version===history.taskRevision);if(!source||parseTask(source.body).prompt!==history.prompt||taskDefinition(parseTask(source.body))!==history.definition)throw Error('Invalid scheduled calculation target');}}}
  if(n.ui?.recordType==='notification')validateNoticeLinks(state.notes,n);
 }
 for(const {key,value} of state.settings){
  if(key===PENDING_CORRECTION_KEY)validatePendingCorrection(value);
  if(key==='ui-v1-dialogue'){const d=validateDialogue(value);if(d.currentFile)validateWorkingFileLink(state.notes,d.currentFile);for(const turn of d.turns){if(turn.files!==undefined)validateFileResultLinks(state.notes,turn.files);sourceRefs(state.notes,turn.refs??[]);sourceRefs(state.notes,turn.results??[]);if(turn.attachments!==undefined&&(!Array.isArray(turn.attachments)||turn.attachments.some(a=>!a||['id','name','kind','status'].some(k=>typeof (a as any)[k]!=='string'))))throw Error('Invalid dialogue attachments');}}
  if(key==='ui-v1-folders'){if(!Array.isArray(value)||new Set(value).size!==value.length)throw Error('Invalid folder metadata');assertFolderNamespace(state.notes,value);for(const path of value){if(typeof path!=='string')throw Error('Invalid folder metadata');const parts=path.split('/');memoryFolderPath(parts.slice(0,-1).join('/'),parts.at(-1)!);}}
  if(key==='ui-v1-trash'){if(!Array.isArray(value))throw Error('Invalid recovery metadata');for(const batch of value){if(!batch||typeof batch.id!=='string'||typeof batch.label!=='string'||!Array.isArray(batch.notes)||!Array.isArray(batch.folders))throw Error('Invalid recovery metadata');for(const n of batch.notes)if(!state.notes.some(x=>x.id===n.id&&x.state==='withdrawn'))throw Error('Recovery target unavailable');}}
 }
 for(const {key,value} of state.runs)if(key.startsWith('ui-v1-processing-')||value?.type==='media-processing')validateProcessing(key,value);
 for(const {key,value} of state.runs)if(key.startsWith('ui-v1-note-restore-')||value?.type==='note-restore')validateNoteRestoreReceipt(key,value,state.notes);
 for(const {key,value} of state.runs)if(key.startsWith('ui-v1-settings-restore-')||value?.type==='settings-restore')validateSettingsRestoreReceipt(key,value,state.notes);
 for(const {key,value:r} of state.runs)if(key.startsWith('ui-v1-correction-')||r?.type==='note-correction'){
  const n=state.notes.find(n=>n.id===r?.noteId),before=n?.revisions.find((v:any)=>v.version===r?.beforeVersion),after=n?.revisions.find((v:any)=>v.version===r?.afterVersion);
  if(r?.schema!==1||r.type!=='note-correction'||key!=='ui-v1-correction-'+r.id||!before||!after||r.afterVersion!==r.beforeVersion+1||!['applied','undone'].includes(r.status)||typeof r.appliedAt!=='string'||! /^[a-f0-9]{64}$/.test(r.afterHash)||r.proposalHash!==undefined&&(typeof r.proposalHash!=='string'||!/^[a-f0-9]{64}$/.test(r.proposalHash))||typeof r.path!=='string')throw Error('Invalid correction receipt');
  const raw=correctionOperationRaw(r.operation,after.body);
  const old={...n,state:'active',revisions:n.revisions.slice(0,r.beforeVersion)},prepared=verifyHistoricalCorrection(old,r.request,raw);
  if(prepared.after!==after.body||!equal(prepared.operation,r.operation)||r.path!==notePath(n,r.beforeVersion))throw Error('Invalid correction operation');
  if(r.status==='undone'&&(!Number.isInteger(r.undoVersion)||r.undoVersion<=r.afterVersion||n.revisions[r.undoVersion-1]?.body!==before.body||typeof r.undoneAt!=='string'))throw Error('Invalid correction Undo');
 }
}
export async function makeStateBackup(state:StateSnapshot){validateState(state);const encoded=encodeBackupValue(state),payload={schema:2 as const,createdAt:new Date().toISOString(),...encoded.data,undefinedPaths:encoded.undefinedPaths,excluded:[...excluded]},pack={format:'mobile-local-brainpack',sha256:stateHash(payload),payload};backupBytes(pack,()=>{});return pack;}
// Emergency inspection copy: preserve data without accepting it for restore.
// In particular, invalid paths must not prevent reading the original records.
export function makeRecoverySnapshot(state:StateSnapshot){jsonOnly(state);entries(state.settings);entries(state.runs);if(!Array.isArray(state.notes))throw Error('Invalid recovery data');const encoded=encodeBackupValue(state),payload={schema:1,createdAt:new Date().toISOString(),...encoded.data,undefinedPaths:encoded.undefinedPaths,excluded:[...excluded]};const pack={format:'babelshelf-unverified-recovery',sha256:stateHash(payload),payload};backupBytes(pack,()=>{});return pack;}
export async function parseStateBackup(text:string):Promise<StatePayload>{
 checkBackupText(text);const pack=JSON.parse(text);
 if(pack.payload?.schema===1){const legacy=await parseBackup(text);if(legacy.notes.some((n:any)=>n.originalAsset||n.mediaSource||n.transcription||n.pdfText||n.ocrText))throw Error('Originals require state backup');return legacy;}
 if(pack.format!=='mobile-local-brainpack'||pack.payload?.schema!==2||pack.sha256!==stateHash(pack.payload)||typeof pack.payload.createdAt!=='string'||!equal(pack.payload.excluded,excluded))throw Error('Backup verification failed');
 // JSON.parse owns this graph; restoring optional values cannot mutate caller data.
 const payload=pack.payload,paths=payload.undefinedPaths;
 if(!Array.isArray(paths)||paths.length>200000)throw Error('Invalid optional value encoding');const seen=new Set<string>();
 for(const path of paths){if(!Array.isArray(path)||path.length<2||!['notes','settings','runs'].includes(path[0])||path.some(k=>typeof k!=='string')||seen.has(JSON.stringify(path)))throw Error('Invalid optional value path');seen.add(JSON.stringify(path));let parent=payload;
  for(const key of path.slice(0,-1)){if(!parent||typeof parent!=='object'||!Object.hasOwn(parent,key))throw Error('Invalid optional value path');parent=parent[key];}
  const key=path.at(-1);if(!parent||typeof parent!=='object'||!Object.hasOwn(parent,key)||parent[key]!==null)throw Error('Invalid optional value path');Object.defineProperty(parent,key,{value:undefined,enumerable:true,configurable:true,writable:true});
 }
 delete payload.undefinedPaths;validateState(payload);return payload;
}
export function guardRestoredNote(note:any){
 let n=structuredClone(note);if(n.ui?.recordType==='schedule')n.ui={...n.ui,requiresReview:true};
 if(n.id==='settings-connection'&&n.ui?.managed){const current=parsePreference('connection',latest(n).body);if(current.downloads||current.diagnosticLogs)n=reviseNote(n,{body:formatPreference('connection',{downloads:false,diagnosticLogs:false})},latest(n).version);}
 return n;
}
export type RestoreMode='strict'|'new-only';
export function planStateRestore(current:StateSnapshot,incoming:StatePayload,mode:RestoreMode='strict'):StateRestorePlan{
 if(mode!=='strict'&&mode!=='new-only')throw Error('Invalid restore mode');
 if(mode==='new-only'&&incoming.schema!==2)throw Error('New-only restore requires schema2');
 const writes:StateSnapshot={notes:[],settings:[],runs:[]},conflicts:RestoreConflict[]=[];
 // Preserve first-match behavior while avoiding a full scan for every record.
 const notesById=new Map<string,any>();for(const note of current.notes)if(!notesById.has(note.id))notesById.set(note.id,note);
 const entriesByKey={settings:new Map<string,Entry>(),runs:new Map<string,Entry>()};
 for(const store of ['settings','runs'] as const)for(const item of current[store])if(!entriesByKey[store].has(item.key))entriesByKey[store].set(item.key,item);
 for(const n of incoming.notes){const old=notesById.get(n.id);if(old){if(!equal(old,n))conflicts.push({store:'notes',key:n.id,label:notePath(n)});}else writes.notes.push(structuredClone(n));}
 for(const store of ['settings','runs'] as const)for(const item of incoming[store]??[]){const old=entriesByKey[store].get(item.key);if(old){if(!equal(old.value,item.value))conflicts.push({store,key:item.key,label:item.key});}else writes[store].push(structuredClone(item));}
 const added={notes:writes.notes.length,settings:writes.settings.length,runs:writes.runs.length};if(conflicts.length&&mode==='strict')return {conflicts,added,writes:null};
 writes.notes=writes.notes.map(guardRestoredNote);
 if(mode==='new-only'){
  const changedNotes=new Set(conflicts.filter(c=>c.store==='notes').map(c=>c.key));
  for(const entry of writes.settings)if(entry.key==='ui-v1-trash'&&entry.value.some((batch:any)=>batch.notes.some((note:any)=>changedNotes.has(note.id))))throw Error('New recovery data depends on conflicting records');
  for(const entry of writes.runs)if(entry.value?.type==='note-correction'&&changedNotes.has(entry.value.noteId))throw Error('New correction depends on conflicting records');
  for(const note of writes.notes.filter(n=>n.ui?.recordType==='execution'))for(const revision of note.revisions){
   const run=taskRunView({...note,revisions:[revision]}),retained=notesById.get(run.taskId);
   if(changedNotes.has(run.taskId)||retained?.taskCursor?.definition===run.definition&&retained.taskCursor.nextAt===run.dueAt)throw Error('New execution conflicts with retained schedule');
  }
 }
 if(mode==='new-only')for(const note of writes.notes.filter(n=>n.ui?.recordType==='execution'))for(const revision of note.revisions){
  const run=taskRunView({...note,revisions:[revision]}),task=[...current.notes,...writes.notes].find(n=>n.id===run.taskId&&n.ui?.recordType==='schedule'),source=task?.revisions.find((v:any)=>v.version===run.taskRevision);
  if(!source)throw Error('New execution source unavailable');const definition=parseTask(source.body);
  if(run.prompt!==definition.prompt||run.definition!==taskDefinition(definition))throw Error('New execution source changed');
  sourceRefs([...current.notes,...writes.notes],run.sources??[]);
 }
 validateState({notes:[...current.notes,...writes.notes],settings:[...current.settings,...writes.settings],runs:[...current.runs,...writes.runs]});
 return {conflicts,added,writes};
}
