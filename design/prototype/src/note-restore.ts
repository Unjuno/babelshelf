import type {StateSnapshot,StatePayload} from './backup-state.ts';
// @ts-expect-error Shared canonical core.
import {latest,reviseNote,checkNotes} from '../../../dist/core.js';
function ordinary(note:any){return !!note&&note.state==='active'&&note.kind==='original'&&Array.isArray(note.sources)&&!note.sources.length&&!note.originalAsset&&!note.mediaSource&&!note.ocrText&&!note.pdfText&&!note.transcription&&!note.ui?.protected&&!note.ui?.managed&&!note.ui?.recordType&&/^(Inbox|Notes)\//.test(latest(note).path);}
export function noteRestoreCandidates(current:StateSnapshot,incoming:StatePayload){
 return incoming.notes.flatMap(source=>{const note=current.notes.find(n=>n.id===source.id);if(!ordinary(source)||!ordinary(note)||latest(source).body===latest(note).body)return [];
  return [{noteId:note.id,path:latest(note).path,sourcePath:latest(source).path,beforeVersion:latest(note).version,sourceVersion:latest(source).version,before:latest(note).body,after:latest(source).body,source:structuredClone(source)}];
 });
}
export function planNoteRestore(current:StateSnapshot,incoming:StatePayload,noteId:string){
 const change=noteRestoreCandidates(current,incoming).find(c=>c.noteId===noteId);if(!change)throw Error('Note recovery target unavailable');
 const note=current.notes.find(n=>n.id===noteId),write=reviseNote(note,{body:change.after},change.beforeVersion);checkNotes(current.notes.map(n=>n.id===noteId?write:n));return {change,write};
}
export function validateNoteRestoreReceipt(key:string,value:any,notes:any[]){
 if(value?.schema!==1||value.type!=='note-restore'||typeof value.id!=='string'||!value.id||key!=='ui-v1-note-restore-'+value.id||typeof value.appliedAt!=='string'||!Number.isFinite(Date.parse(value.appliedAt))||! /^[a-f0-9]{64}$/.test(value.backupHash)||typeof value.noteId!=='string'||!Number.isSafeInteger(value.beforeVersion)||value.beforeVersion<1||value.afterVersion!==value.beforeVersion+1||!ordinary(value.source)||value.source.id!==value.noteId)throw Error('Invalid note recovery receipt');
 checkNotes([value.source]);const note=notes.find(n=>n.id===value.noteId),after=note?.revisions.find((r:any)=>r.version===value.afterVersion);
 if(!after||!note.revisions.some((r:any)=>r.version===value.beforeVersion)||after.body!==latest(value.source).body)throw Error('Note recovery source changed');
}
