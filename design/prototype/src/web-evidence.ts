import type {SourceRef} from './conversation.ts';
const MAX_SNAPSHOT_BYTES=12_000;
const MAX_QUOTE_CHARS=4_000;
const MAX_MEMORY_QUOTE_CHARS=24_000;

export type WebSnapshot={
 id:string;
 sessionId:string;
 provider:'RustXNG';
 url:string;
 title:string;
 retrievedAt:string;
 text:string;
};

/** A bounded citation to exact page text held only in the current search session. */
export type WebCitation={
 kind:'web';
 snapshotId:string;
 sessionId:string;
 provider:'RustXNG';
 url:string;
 title:string;
 retrievedAt:string;
 start:number;
 end:number;
 quote:string;
};

export type BoundAnswerEvidence={kind:'memory';source:SourceRef}|{kind:'web';source:WebCitation};

function record(value:unknown):value is Record<string,unknown>{
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
}

function safeWebUrl(value:unknown):value is string{
 if(typeof value!=='string'||value.length>4096)return false;
 try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&url.href===value;}catch{return false;}
}

function validTimestamp(value:unknown):value is string{
 return typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
}

/** Accept only bounded, host-identified snapshots from the current RustXNG session. */
export function createWebSnapshot(value:unknown):WebSnapshot{
 if(!record(value)||Object.keys(value).some(key=>!['id','sessionId','provider','url','title','retrievedAt','text'].includes(key))||
  typeof value.id!=='string'||!/^[a-f0-9-]{16,80}$/i.test(value.id)||
  typeof value.sessionId!=='string'||!/^[a-f0-9-]{16,80}$/i.test(value.sessionId)||
  value.provider!=='RustXNG'||!safeWebUrl(value.url)||
  typeof value.title!=='string'||!value.title.trim()||value.title.length>240||
  !validTimestamp(value.retrievedAt)||typeof value.text!=='string'||!value.text.trim()||
  new TextEncoder().encode(value.text).byteLength>MAX_SNAPSHOT_BYTES)throw Error('Invalid Web source snapshot');
 return Object.freeze({id:value.id,sessionId:value.sessionId,provider:'RustXNG',url:value.url,title:value.title.trim(),retrievedAt:value.retrievedAt,text:value.text});
}

/** Bind a model-selected range to a host-owned snapshot, never to a model-supplied URL or quote. */
export function createWebCitation(snapshot:WebSnapshot,range:{start:number;end:number}):WebCitation{
 if(!Number.isSafeInteger(range.start)||!Number.isSafeInteger(range.end)||range.start<0||range.end<=range.start||range.end-range.start>MAX_QUOTE_CHARS||range.end>snapshot.text.length)throw Error('Invalid Web citation range');
 const quote=snapshot.text.slice(range.start,range.end);
 if(!quote.trim())throw Error('Invalid Web citation range');
 return Object.freeze({kind:'web',snapshotId:snapshot.id,sessionId:snapshot.sessionId,provider:snapshot.provider,url:snapshot.url,title:snapshot.title,retrievedAt:snapshot.retrievedAt,start:range.start,end:range.end,quote});
}

/** Revalidate exact quote, URL and retrieval identity against a still-live session snapshot. */
export function validateWebCitation(value:unknown,snapshots:readonly WebSnapshot[]):value is WebCitation{
 if(!record(value)||Object.keys(value).some(key=>!['kind','snapshotId','sessionId','provider','url','title','retrievedAt','start','end','quote'].includes(key))||
  value.kind!=='web'||typeof value.snapshotId!=='string'||typeof value.sessionId!=='string'||value.provider!=='RustXNG'||
  !safeWebUrl(value.url)||typeof value.title!=='string'||value.title.length>240||!validTimestamp(value.retrievedAt)||
  !Number.isSafeInteger(value.start)||Number(value.start)<0||!Number.isSafeInteger(value.end)||Number(value.end)<=Number(value.start)||
  Number(value.end)-Number(value.start)>MAX_QUOTE_CHARS||typeof value.quote!=='string'||!value.quote.trim()||value.quote.length!==Number(value.end)-Number(value.start))return false;
 const snapshot=snapshots.find(candidate=>candidate.id===value.snapshotId&&candidate.sessionId===value.sessionId);
 return !!snapshot&&snapshot.provider===value.provider&&snapshot.url===value.url&&snapshot.title===value.title&&snapshot.retrievedAt===value.retrievedAt&&snapshot.text.slice(Number(value.start),Number(value.end))===value.quote;
}

/** Resolve only host-offered labels; the model cannot mint URLs, text or offsets. */
export function bindWebCitationLabels(labels:unknown,offered:readonly {label:string;citation:WebCitation}[],snapshots:readonly WebSnapshot[]):WebCitation[]{
 if(!Array.isArray(labels)||labels.some(label=>typeof label!=='string')||new Set(labels).size!==labels.length||
  new Set(offered.map(item=>item.label)).size!==offered.length||offered.some(item=>!/^S(?:[1-9]|[1-5][0-9]|6[0-4])$/.test(item.label)||!validateWebCitation(item.citation,snapshots)))throw Error('Invalid Web source labels');
 const selected=labels.map(label=>offered.find(item=>item.label===label));
 if(selected.some(item=>!item))throw Error('Invalid Web source labels');
 return selected.map(item=>item!.citation);
}

function validMemorySource(value:unknown):value is SourceRef{
 if(!record(value)||typeof value.noteId!=='string'||!value.noteId||value.noteId.length>160||!Number.isSafeInteger(value.revision)||Number(value.revision)<1||!Number.isSafeInteger(value.start)||Number(value.start)<0||!Number.isSafeInteger(value.end)||Number(value.end)<Number(value.start)||typeof value.quote!=='string'||Number(value.end)-Number(value.start)!==value.quote.length||!value.quote.length||value.quote.length>MAX_MEMORY_QUOTE_CHARS)return false;
 return (value.title===undefined||typeof value.title==='string'&&value.title.length<=240)&&(value.citedQuote===undefined||typeof value.citedQuote==='string'&&value.citedQuote.length<=MAX_QUOTE_CHARS)&&(value.groundingEligible===undefined||typeof value.groundingEligible==='boolean');
}

/** Bind the shared answer labels to either an already-verified Memory ref or a live Web snapshot citation. */
export function bindMixedEvidenceLabels(labels:unknown,memory:readonly {label:string;source:SourceRef}[],web:readonly {label:string;citation:WebCitation}[],snapshots:readonly WebSnapshot[]):BoundAnswerEvidence[]{
 const offered=[...memory.map(item=>({label:item.label,kind:'memory' as const,source:item.source})),...web.map(item=>({label:item.label,kind:'web' as const,source:item.citation}))];
 if(!Array.isArray(labels)||labels.some(label=>typeof label!=='string')||new Set(labels).size!==labels.length||
  new Set(offered.map(item=>item.label)).size!==offered.length||offered.some(item=>!/^S(?:[1-9]|[1-5][0-9]|6[0-4])$/.test(item.label)||(item.kind==='memory'?!validMemorySource(item.source):!validateWebCitation(item.source,snapshots))))throw Error('Invalid answer evidence labels');
 const selected=labels.map(label=>offered.find(item=>item.label===label));
 if(selected.some(item=>!item))throw Error('Invalid answer evidence labels');
 return selected.map(item=>item!.kind==='memory'?{kind:'memory',source:item!.source as SourceRef}:{kind:'web',source:item!.source as WebCitation});
}
