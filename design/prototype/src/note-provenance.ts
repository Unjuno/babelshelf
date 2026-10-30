// Read-only presentation of canonical provenance. Historical availability and
// admission as CURRENT evidence are separate; neither proves factual accuracy.
// @ts-expect-error Shared canonical core is JavaScript.
import {latest,validateGroundingRefs} from '../../../dist/core.js';
// @ts-expect-error Shared canonical path contract is JavaScript.
import {notePath} from '../../../dist/files.js';
export type SavedSourceRef={noteId:string;revision:number;start:number;end:number;quote:string;citedQuote?:string};
export type SourceMetadataGuard={noteId:string;revision:number;snapshot:string};
export function sourceReferenceForView(source:SavedSourceRef):SavedSourceRef{
 const {noteId,revision,start,end,quote}=source;
 return {noteId,revision,start,end,quote,...(typeof source.citedQuote==='string'&&source.citedQuote&&typeof quote==='string'&&quote.includes(source.citedQuote)?{citedQuote:source.citedQuote}:{})};
}
export type SourceState='current'|'changed'|'removed'|'unavailable';
export type NoteProvenance={noteId:string;revision:number;status:SourceState|'none';items:{ref:SavedSourceRef;path:string;currentRevision?:number;status:SourceState;historicalAvailable:boolean}[]};
export function noteProvenance(records:any[],noteId:string,revision:number):NoteProvenance{
 const note=records.find(n=>n.id===noteId);
 if(!note||note.state!=='active'||latest(note).version!==revision)throw Error('File changed or unavailable · reopen it');
 const items=(note.sources??[]).map((source:SavedSourceRef)=>{
  const ref=sourceReferenceForView(source);
  const original=records.find(n=>n.id===ref.noteId),version=original?.revisions.find((v:any)=>v.version===ref.revision);
  const historicalAvailable=!!version&&Number.isSafeInteger(ref.start)&&Number.isSafeInteger(ref.end)&&ref.start>=0&&ref.end>ref.start&&ref.end<=version.body.length&&version.body.slice(ref.start,ref.end)===ref.quote;
  const status:SourceState=!historicalAvailable?'unavailable':original.state!=='active'?'removed':validateGroundingRefs(records,[ref]).ok?'current':'changed';
  return {ref,path:original?notePath(original,version?.version??latest(original).version):'Unavailable source',...(original?{currentRevision:latest(original).version}:{}),status,historicalAvailable};
 });
 const status:NoteProvenance['status']=!items.length?'none':items.some((item:NoteProvenance['items'][number])=>item.status==='unavailable')?'unavailable':items.some((item:NoteProvenance['items'][number])=>item.status==='removed')?'removed':items.some((item:NoteProvenance['items'][number])=>item.status==='changed')?'changed':'current';
 return {noteId,revision,status,items};
}

/** Metadata for navigating original sources; never an excerpt or evidence grant. */
export function noteSourceMetadata(records:any[],noteId:string,revision:number){
 const report=noteProvenance(records,noteId,revision);
 return {noteId:report.noteId,revision:report.revision,status:report.status,items:report.items.map(({ref,path,currentRevision,status,historicalAvailable})=>({noteId:ref.noteId,revision:ref.revision,start:ref.start,end:ref.end,path,...(currentRevision===undefined?{}:{currentRevision}),status,historicalAvailable}))};
}
