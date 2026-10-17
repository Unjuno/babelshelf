// Only exact known app-owned v1 documentation is updated; arbitrary records stay untouched.
// @ts-expect-error Shared baseline is JavaScript.
import {reviseNote} from '../../../dist/core.js';
import {builtinToolNotes,legacyToolBodies} from './tool-definitions.ts';
export function builtinToolUpdates(records:any[],seeds:{id:string;path:string;body:string;protected?:boolean}[]){
 const updates:any[]=[];
 for(const desired of builtinToolNotes){
  const legacy=legacyToolBodies[desired.id],seed=seeds.find(s=>s.id===desired.id);
  if(!legacy||legacy===desired.body||!seed||seed.protected!==true||seed.path!==desired.path||seed.body!==desired.body)continue;
  const n=records.find(n=>n.id===desired.id),v=n?.revisions?.[0];
  if(!n||n.kind!=='original'||n.state!=='active'||n.ui?.protected!==true||n.ui?.managed!==false||n.ui?.recordType||!Array.isArray(n.revisions)||n.revisions.length!==1||v.version!==1||v.path!==desired.path||v.body!==legacy||!Array.isArray(n.aliases)||n.aliases.length||!Array.isArray(n.sources)||n.sources.length||'importedFrom' in n||'originalAsset' in n||'mediaSource' in n)continue;
  updates.push(reviseNote(n,{body:desired.body},1));
 }
 return updates;
}
