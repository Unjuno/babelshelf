// Metadata discovery is navigation, never extracted content or a citation.
// @ts-expect-error Shared canonical paths are JavaScript.
import {notePath} from '../../../dist/files.js';
export type FileResult={kind:'file';noteId:string;revision:number;path:string};
const normalize=(text:string)=>text.normalize('NFKC').toLocaleLowerCase('ja').replace(/\s+/g,' ').trim();
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
export function validateFileResults(value:unknown):asserts value is FileResult[]{
 if(!Array.isArray(value)||value.length>20||value.some(r=>!r||Object.keys(r).sort().join(',')!=='kind,noteId,path,revision'||r.kind!=='file'||typeof r.noteId!=='string'||!r.noteId||!Number.isInteger(r.revision)||r.revision<1||typeof r.path!=='string'||!r.path||r.path.length>1024))throw Error('Invalid file result');
}
export function validateFileResultLinks(notes:any[],files:unknown){
 validateFileResults(files);
 for(const file of files){const note=notes.find(n=>n.id===file.noteId);if(!note?.revisions.some((r:any)=>r.version===file.revision)||notePath(note,file.revision)!==file.path)throw Error('Invalid file result link');}
}
