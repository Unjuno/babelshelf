// Only exact known app-owned documentation is updated; arbitrary records stay untouched.
// @ts-expect-error Shared baseline is JavaScript.
import {reviseNote} from '../../../dist/core.js';
import {builtinToolNotes,knownToolBodies} from './tool-definitions.ts';
import {knownPackageBodies} from './builtin-package-previous.ts';
export function builtinToolUpdates(records:any[],seeds:{id:string;path:string;body:string;protected?:boolean}[]){
 const updates:any[]=[];
 const packageSeeds=seeds.filter(seed=>Object.hasOwn(knownPackageBodies,seed.id));
 for(const desired of [...builtinToolNotes,...packageSeeds]){
  const known=knownToolBodies[desired.id]??knownPackageBodies[desired.id],seed=seeds.find(s=>s.id===desired.id);
  if(knownPackageBodies[desired.id]&&desired.path!==`Tools/${desired.id.slice('builtin-package-'.length)}`)continue;
  if(!known?.length||!seed||seed.protected!==true||seed.path!==desired.path||seed.body!==desired.body)continue;
  const n=records.find(n=>n.id===desired.id);
  if(!n||n.kind!=='original'||n.state!=='active'||n.ui?.protected!==true||n.ui?.managed!==false||n.ui?.recordType||!Array.isArray(n.revisions)||!n.revisions.length||n.revisions.some((r:any,i:number)=>i>0&&known.indexOf(r.body)<=known.indexOf(n.revisions[i-1].body))||!n.revisions.every((r:any,i:number)=>r.version===i+1&&r.path===desired.path&&known.includes(r.body))||n.revisions.at(-1).body===desired.body||!Array.isArray(n.aliases)||n.aliases.length||!Array.isArray(n.sources)||n.sources.length||'importedFrom' in n||'originalAsset' in n||'mediaSource' in n)continue;
  updates.push(reviseNote(n,{body:desired.body},n.revisions.length));
 }
 return updates;
}
