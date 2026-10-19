import {parsePreference,formatPreference,preferencePath,type PreferenceGroup} from './preference-records.ts';
import type {StateSnapshot,StatePayload} from './backup-state.ts';
// @ts-expect-error Shared canonical core is JavaScript.
import {latest,reviseNote,checkNotes} from '../../../dist/core.js';
const groups:PreferenceGroup[]=['appearance','models','connection'];
function checked(note:any,group:PreferenceGroup){
 if(!note||note.id!=='settings-'+group||note.state!=='active'||!note.ui?.managed||note.ui.protected||note.ui.recordType||latest(note).path!==preferencePath(group))throw Error('Settings recovery target unavailable');
 // Historical source links are archive metadata, never execution authority.
 checkNotes([{...note,sources:[]}]);
 return parsePreference(group,latest(note).body);
}
function effective(source:any,group:PreferenceGroup){const value=checked(source,group);return formatPreference(group,group==='connection'?{...value,downloads:false}:value);}
export function planSettingsRestore(current:StateSnapshot,incoming:StatePayload){
 if(incoming.schema!==2)return {changes:[],writes:[]};
 const changes:{group:PreferenceGroup;noteId:string;before:string;after:string;beforeVersion:number;source:any}[]=[],writes:any[]=[];
 for(const group of groups){
  const source=incoming.notes.find(n=>n.id==='settings-'+group);if(!source)continue;
  const note=current.notes.find(n=>n.id===source.id);if(!note)continue;checked(note,group);
  const after=effective(source,group),before=latest(note);
  if(before.body===after||group==='connection'&&JSON.stringify(parsePreference('connection',before.body))===JSON.stringify(parsePreference('connection',after)))continue;
  changes.push({group,noteId:note.id,before:before.body,after,beforeVersion:before.version,source:structuredClone(source)});
  writes.push(reviseNote(note,{body:after},before.version));
 }
 return {changes,writes};
}
export function validateSettingsRestoreReceipt(key:string,value:any,notes:any[]){
 if(value?.schema!==1||value.type!=='settings-restore'||typeof value.id!=='string'||key!=='ui-v1-settings-restore-'+value.id||typeof value.appliedAt!=='string'||! /^[a-f0-9]{64}$/.test(value.backupHash)||!Array.isArray(value.changes)||!value.changes.length||value.changes.length>3||new Set(value.changes.map((c:any)=>c.group)).size!==value.changes.length)throw Error('Invalid settings recovery receipt');
 for(const change of value.changes){
  if(!groups.includes(change.group)||change.noteId!=='settings-'+change.group||!Number.isSafeInteger(change.beforeVersion)||change.beforeVersion<1||change.afterVersion!==change.beforeVersion+1)throw Error('Invalid settings recovery revision');
  const note=notes.find(n=>n.id===change.noteId),after=note?.revisions.find((r:any)=>r.version===change.afterVersion);
  if(!after||!note.revisions.some((r:any)=>r.version===change.beforeVersion)||after.path!==preferencePath(change.group)||after.body!==effective(change.source,change.group))throw Error('Settings recovery source changed');
 }
}
