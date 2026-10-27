// Metadata discovery is navigation, never extracted content or a citation.
// @ts-expect-error Shared canonical paths are JavaScript.
import {notePath} from '../../../dist/files.js';
// @ts-expect-error Shared search folding is JavaScript.
import {normalizeSearchText} from '../../../dist/core.js';
export type FileResult={kind:'file';noteId:string;revision:number;path:string};
const normalize:(text:string)=>string=normalizeSearchText;
export function findStoredFiles(notes:any[],query:string,limit=12):FileResult[]{
 const q=normalize(query);if(!q||q.length>2000)return [];
 const terms=q.split(' ');
 return notes.filter(n=>n.state==='active').flatMap(n=>{
  const v=n.revisions.at(-1),path=notePath(n),fields=[path,v.title,...(n.aliases??[])].map(normalize);
  if(!terms.every(term=>fields.some(field=>field.includes(term))))return [];
  const score=fields.some(field=>field===q)?100:fields.some(field=>field.includes(q))?50:10;
  return [{score,file:{kind:'file' as const,noteId:n.id,revision:v.version,path}}];
 }).sort((a,b)=>b.score-a.score||a.file.path.localeCompare(b.file.path)||a.file.noteId.localeCompare(b.file.noteId)).slice(0,Math.max(1,Math.min(20,limit))).map(r=>r.file);
}
/** File and passage discovery share a bounded result budget. Alternate the
 * two ranked lists so neither kind can hide the other; keep the passage when
 * both describe the same file. These results do not grant read/write authority. */
export function mergeStoredSearchResults<T extends {noteId:string}>(files:FileResult[],passages:T[],limit=12):(FileResult|T)[]{
 const cap=Math.max(1,Math.min(20,limit)),passageById=new Map<string,T>();
 for(const passage of passages)if(!passageById.has(passage.noteId))passageById.set(passage.noteId,passage);
 const seen=new Set<string>(),merged:(FileResult|T)[]=[];
 const add=(item:FileResult|T|undefined)=>{if(item&&!seen.has(item.noteId)){seen.add(item.noteId);merged.push(item);}};
 for(let i=0;(i<files.length||i<passages.length)&&merged.length<cap;i++){
  const file=files[i];add(file?(passageById.get(file.noteId)??file):undefined);if(merged.length<cap)add(passages[i]);
 }
 return merged;
}
export function validateFileResults(value:unknown):asserts value is FileResult[]{
 if(!Array.isArray(value)||value.length>20||value.some(r=>!r||Object.keys(r).sort().join(',')!=='kind,noteId,path,revision'||r.kind!=='file'||typeof r.noteId!=='string'||!r.noteId||!Number.isInteger(r.revision)||r.revision<1||typeof r.path!=='string'||!r.path||r.path.length>1024))throw Error('Invalid file result');
}
export function validateFileResultLinks(notes:any[],files:unknown){
 validateFileResults(files);
 for(const file of files){const note=notes.find(n=>n.id===file.noteId);if(!note?.revisions.some((r:any)=>r.version===file.revision)||notePath(note,file.revision)!==file.path)throw Error('Invalid file result link');}
}
