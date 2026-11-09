import type {MemoryPassageResult} from './memory-search-types.ts';

export type SemanticChunk={noteId:string;revision:number;title:string;path:string;text:string;start:number;end:number};
type CanonicalNote={id:string;state?:string;path?:string;revisions?:Array<{version:number;title:string;body:string}>};
type ProjectedNote={id:string;version?:number;revision?:number;title:string;path?:string;body:string};
type SemanticHit={noteId:string;revision:number;start:number;end:number;quote:string;score:number};

const isRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const safeBoundary=(text:string,index:number,direction:'left'|'right')=>{
 if(index<=0||index>=text.length)return index;
 const before=text.charCodeAt(index-1),after=text.charCodeAt(index);
 if(before>=0xd800&&before<=0xdbff&&after>=0xdc00&&after<=0xdfff)return direction==='left'?index-1:index+1;
 return index;
};

/** Split canonical text while keeping exact JavaScript UTF-16 source offsets. */
export function chunkSemanticText(note:ProjectedNote,{maxChars=480,overlapChars=80}:{maxChars?:number;overlapChars?:number}={}):SemanticChunk[]{
 if(!isRecord(note)||typeof note.id!=='string'||!note.id||note.id.length>512||typeof note.title!=='string'||typeof note.body!=='string')throw Error('Invalid semantic note');
 if(!Number.isInteger(maxChars)||maxChars<32||maxChars>4096||!Number.isInteger(overlapChars)||overlapChars<0||overlapChars>=maxChars)throw Error('Invalid semantic chunk options');
 const revision=note.version??note.revision;
 if(!Number.isSafeInteger(revision)||revision!<1)throw Error('Invalid semantic note revision');
 const body=note.body;
 if(!body.trim())return [];
 const path=typeof note.path==='string'?note.path:'';
 const chunks:SemanticChunk[]=[];let start=0;
 while(start<body.length){
  let end=Math.min(body.length,start+maxChars);
  end=safeBoundary(body,end,'left');
  if(end<body.length){
   const floor=start+Math.floor(maxChars*0.55);
   const breakAt=Math.max(body.lastIndexOf('\n',end-1),body.lastIndexOf(' ',end-1),body.lastIndexOf('\t',end-1));
   if(breakAt>=floor)end=safeBoundary(body,breakAt,'right');
  }
  if(end<=start)end=safeBoundary(body,Math.min(body.length,start+maxChars),'right');
  if(end<=start)throw Error('Unable to create semantic chunk');
  const text=body.slice(start,end);
  if(text.trim())chunks.push({noteId:note.id,revision:revision!,title:note.title,path,text,start,end});
  if(end>=body.length)break;
  let next=safeBoundary(body,Math.max(start+1,end-overlapChars),'right');
  if(next>=end)next=safeBoundary(body,end-1,'left');
  start=next;
 }
 return chunks;
}

/** Rebind candidate passages to current canonical revisions; candidate text/metadata is never trusted. */
export function bindSemanticHits(notes:CanonicalNote[],hits:SemanticHit[],{limit=12}:{limit?:number}={}):MemoryPassageResult[]{
 if(!Number.isInteger(limit)||limit<1||limit>20)throw Error('Invalid semantic search limit');
 if(!Array.isArray(notes)||!Array.isArray(hits))return [];
 const latestById=new Map<string,{note:CanonicalNote;revision:number;title:string;body:string}>();
 for(const note of notes){
  // Only active canonical records may contribute retrieval evidence. Treat
  // withdrawn, deleted, and unknown states as ineligible rather than relying
  // on a consumer to remember to filter them before semantic ranking.
  if(!isRecord(note)||note.state!=='active'||typeof note.id!=='string'||!Array.isArray(note.revisions))continue;
  const latest=note.revisions.at(-1);
  if(!isRecord(latest)||!Number.isSafeInteger(latest.version)||latest.version<1||typeof latest.title!=='string'||typeof latest.body!=='string')continue;
  latestById.set(note.id,{note,revision:latest.version,title:latest.title,body:latest.body});
 }
 const best=new Map<string,MemoryPassageResult>();
 for(const hit of hits){
  if(!isRecord(hit)||typeof hit.noteId!=='string'||hit.noteId.length>160||!Number.isSafeInteger(hit.revision)||!Number.isSafeInteger(hit.start)||!Number.isSafeInteger(hit.end)||typeof hit.quote!=='string'||!Number.isFinite(hit.score)||hit.score<=0||hit.score>1)continue;
  const source=latestById.get(hit.noteId);
  if(!source||source.revision!==hit.revision||hit.start<0||hit.end<=hit.start||hit.end>source.body.length||hit.end-hit.start>4096)continue;
  const quote=source.body.slice(hit.start,hit.end);
  if(!quote.trim()||quote!==hit.quote)continue;
  const key=`${hit.noteId}\u0000${hit.revision}\u0000${hit.start}\u0000${hit.end}`;
  const path=typeof source.note.path==='string'?source.note.path:undefined;
  const result:MemoryPassageResult={kind:'passage',noteId:hit.noteId,revision:hit.revision,title:source.title,...(path?{path}:{}),start:hit.start,end:hit.end,quote,score:hit.score};
  if(!best.has(key)||best.get(key)!.score<hit.score)best.set(key,result);
 }
 return [...best.values()].sort((a,b)=>b.score-a.score||a.noteId.localeCompare(b.noteId)||a.start-b.start).slice(0,limit);
}
