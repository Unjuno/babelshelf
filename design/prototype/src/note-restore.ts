import type {StateSnapshot,StatePayload} from './backup-state.ts';
import {validateHistoricalSourceRefs} from './historical-source-refs.ts';
// @ts-expect-error Shared canonical core.
import {latest,reviseNote,checkNotes} from '../../../dist/core.js';
function ordinary(note:any){return !!note&&note.state==='active'&&['original','generated'].includes(note.kind)&&Array.isArray(note.sources)&&(note.kind==='generated'||!note.sources.length)&&!note.originalAsset&&!note.mediaSource&&!note.ocrText&&!note.pdfText&&!note.transcription&&!note.ui?.protected&&!note.ui?.managed&&!note.ui?.recordType&&/^(Inbox|Notes)\//.test(latest(note).path);}
function provenance(note:any){return JSON.stringify(Object.fromEntries(Object.entries(note).filter(([key])=>!['revisions','aliases','state','withdrawnAt'].includes(key)).sort(([a],[b])=>a.localeCompare(b))));}
function compatible(source:any,note:any){return !!note&&source.kind===note.kind&&(source.kind!=='generated'||provenance(source)===provenance(note));}
function sourceGraphMatches(current:Map<string,any>,incoming:Map<string,any>,source:any){
 const queue=[...source.sources],seen=new Set<string>();
 while(queue.length){const ref=queue.pop(),key=JSON.stringify([ref?.noteId,ref?.revision]);if(seen.has(key))continue;seen.add(key);
  const before=incoming.get(ref?.noteId),local=current.get(ref?.noteId),version=before?.revisions.find((r:any)=>r.version===ref.revision),retained=local?.revisions.find((r:any)=>r.version===ref.revision);
  if(!before||!local||!version||!retained||provenance(before)!==provenance(local)||JSON.stringify(version)!==JSON.stringify(retained))return false;
  queue.push(...before.sources);
 }
 return true;
}
export function noteRestoreCandidates(current:StateSnapshot,incoming:StatePayload){
 const currentById=new Map(current.notes.map(n=>[n.id,n])),incomingById=new Map(incoming.notes.map(n=>[n.id,n]));
 return incoming.notes.flatMap(source=>{const note=currentById.get(source.id);if(!ordinary(source)||!ordinary(note)||!compatible(source,note)||latest(source).body===latest(note).body||source.kind==='generated'&&!sourceGraphMatches(currentById,incomingById,source))return [];
  return [{noteId:note.id,path:latest(note).path,sourcePath:latest(source).path,beforeVersion:latest(note).version,sourceVersion:latest(source).version,before:latest(note).body,after:latest(source).body,source:structuredClone(source)}];
 });
}
export function planNoteRestore(current:StateSnapshot,incoming:StatePayload,noteId:string){
 const change=noteRestoreCandidates(current,incoming).find(c=>c.noteId===noteId);if(!change)throw Error('Note recovery target unavailable');
 const note=current.notes.find(n=>n.id===noteId),write=reviseNote(note,{body:change.after},change.beforeVersion);checkNotes(current.notes.map(n=>n.id===noteId?write:n));return {change,write};
}
export function validateNoteRestoreReceipt(key:string,value:any,notes:any[]){
 if(value?.schema!==1||value.type!=='note-restore'||typeof value.id!=='string'||!value.id||key!=='ui-v1-note-restore-'+value.id||typeof value.appliedAt!=='string'||!Number.isFinite(Date.parse(value.appliedAt))||! /^[a-f0-9]{64}$/.test(value.backupHash)||typeof value.noteId!=='string'||!Number.isSafeInteger(value.beforeVersion)||value.beforeVersion<1||value.afterVersion!==value.beforeVersion+1||!ordinary(value.source)||value.source.id!==value.noteId)throw Error('Invalid note recovery receipt');
 // Validate the archived record's shape independently of its old path, then its
 // source bytes against retained records. Never replace current provenance.
 checkNotes([{...value.source,sources:[]}]);validateHistoricalSourceRefs(notes,value.source.sources);const note=notes.find(n=>n.id===value.noteId),after=note?.revisions.find((r:any)=>r.version===value.afterVersion);
 if(!compatible(value.source,note))throw Error('Note recovery source changed');
 if(!after||!note.revisions.some((r:any)=>r.version===value.beforeVersion)||after.body!==latest(value.source).body)throw Error('Note recovery source changed');
}
