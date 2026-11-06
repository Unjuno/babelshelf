import {ocrTextNote,validateOcrText,type OcrText} from './ocr-text.ts';
import {pdfTextNote,validatePdfText,type PdfText} from './pdf-text.ts';
import {transcriptNote,validateTranscript,videoTimingCoverage,type Transcript} from './speech-transcript.ts';
import {visionTextNote,validateVisionText,type VisionText} from './vision-text.ts';
import {videoVisionCoverage} from './video-observations.ts';
import {originalKey,type OriginalAsset} from './original-assets.ts';
import type {Dialogue,SourceRef} from './conversation.ts';
import {requestsCrossSource} from './saved-knowledge-reference.ts';
// @ts-expect-error Shared canonical core is JavaScript.
import {searchableNoteIds,searchNotes,chunks,latest} from '../../../dist/core.js';
export type ReviewedText={kind:'ocr';id:string;value:OcrText}|{kind:'pdf';id:string;value:PdfText}|{kind:'speech';id:string;value:Transcript}|{kind:'vision';id:string;value:VisionText};
export type InputReadingRef={kind:'ocr'|'pdf'|'speech'|'vision';noteId:string;revision:1};
export type CurrentInputRef=InputReadingRef|{kind:'text'|'video-audio';noteId:string;revision:1};
export function inputReadingKind(note:any):InputReadingRef['kind']|undefined{
 const kinds=([['ocr','ocrText'],['pdf','pdfText'],['speech','transcription'],['vision','visionText']] as const).filter(([,field])=>note?.[field]);
 return !note?.originalAsset&&kinds.length===1?kinds[0][0]:undefined;
}
export function routeInputRequest<T extends {action:string}>(request:T,inputs:CurrentInputRef[],literal:boolean,question=''):T{return inputs.length&&!literal&&!requestsCrossSource(question)&&['read','search','chat'].includes(request.action)?{...request,action:'answer'}:request;}
export const readingRef=(r:ReviewedText):InputReadingRef=>({kind:r.kind,noteId:r.id,revision:1});
export const readingStatus=(r:ReviewedText,reviewed=true)=>{const state=reviewed?'reviewed':'extracted';return r.kind==='vision'?(r.value.scope==='sampled-video'?'Video observations generated · sampled frames':'Image observations generated')+(reviewed?' · reviewed':''):r.kind==='ocr'?'Image text '+state:r.kind==='pdf'?'PDF text '+state+' · '+r.value.pages.length+' / '+r.value.totalPages+' pages':(r.value.sourceTrack==='video-audio'?'Audio transcript '+state+' · frames not processed':'Transcript '+state);};
export function buildInputReadings(readings:ReviewedText[],runs:{key:string;value:any}[]){
 if(readings.length>16||new Set(readings.map(r=>r.id)).size!==readings.length)throw Error('Duplicate input reading');
 return readings.map(r=>{const asset=runs.find(v=>v.key===originalKey(r.value?.original?.id??''))?.value as OriginalAsset;
  if(!asset||!r.id||r.id===asset.id)throw Error('Input reading original unavailable');
  if(r.kind==='ocr')return ocrTextNote(r.id,asset,r.value);if(r.kind==='pdf')return pdfTextNote(r.id,asset,r.value);if(r.kind==='speech')return transcriptNote(r.id,asset,r.value);if(r.kind==='vision')return visionTextNote(r.id,asset,r.value);throw Error('Input reading unsupported');
 });
}
export function validateInputReadings(dialogue:Dialogue|undefined,notes:any[],runs:{key:string;value:any}[]){
 for(const turn of dialogue?.turns??[])for(const a of turn.attachments??[])if(a.reading!==undefined){
  const r=a.reading,n=notes.find(n=>n.id===r?.noteId),v=n?.revisions?.find((v:any)=>v.version===r.revision),asset=runs.find(v=>v.key===originalKey(a.asset?.id??''))?.value as OriginalAsset;
  if(!r||Object.keys(r).sort().join(',')!=='kind,noteId,revision'||!['ocr','pdf','speech','vision'].includes(r.kind)||r.revision!==1||!n||!v||!asset||!a.asset||a.voice||n.originalAsset||n.mediaSource?.id!==a.asset.id||n.mediaSource?.revision!==a.asset.revision||n.mediaSource?.sha256!==a.asset.sha256)throw Error('Input reading link invalid');
  const value=r.kind==='ocr'?n.ocrText:r.kind==='pdf'?n.pdfText:r.kind==='vision'?n.visionText:n.transcription;if(!value||inputReadingKind(n)!==r.kind||v.body!==value.text)throw Error('Input reading text unavailable');
  if(r.kind==='ocr')validateOcrText(value,asset);else if(r.kind==='pdf')validatePdfText(value,asset);else if(r.kind==='vision')validateVisionText(value,asset);else validateTranscript(value,asset);
 }
}
// Scope retrieval to the reviewed attachments, before unrelated history/search.
// One leading excerpt per file precedes additional matches from any one file.
export function readingEvidence(records:any[],refs:CurrentInputRef[],question:string):(SourceRef&{coverage:string})[]{
 if(!refs.length)return [];const eligible=searchableNoteIds(records);
 const primary:(SourceRef&{coverage:string})[]=[],extra:(SourceRef&{coverage:string})[]=[];
 for(const ref of refs){const n=records.find(n=>n.id===ref.noteId);
  if(ref.kind==='video-audio'){
   const value=n?.visionText,body=n&&latest(n).body,start=value?.audioStart,transcript=value?.audio?.value?.text;
   if(!n||!eligible.has(n.id)||latest(n).version!==ref.revision||value?.scope!=='sampled-video'||value.audio?.status!=='processed'||!Number.isSafeInteger(start)||start<0||typeof transcript!=='string'||!transcript.trim()||value.text!==body||body.slice(start)!==transcript)throw Error('Audio-only transcript unavailable');
   const pieces=chunks(transcript);if(!pieces.length)throw Error('Audio-only transcript unavailable');
   const hits=pieces.map((piece:any)=>({noteId:n.id,revision:ref.revision,title:latest(n).title,start:start+piece.start,end:start+piece.end,quote:piece.quote,coverage:'Video audio-only transcript; estimated timing; visual observations excluded'}));
   primary.push(hits[0]);extra.push(...hits.slice(1));continue;
  }
  if(!n||!eligible.has(n.id)||latest(n).version!==ref.revision||!(ref.kind==='text'?n.originalAsset&&n.attachmentText:ref.kind==='ocr'?n.ocrText:ref.kind==='pdf'?n.pdfText:ref.kind==='vision'?n.visionText:n.transcription))throw Error('Input source changed · retry');
  const scoped=[n,...records.filter(r=>r.id===n.mediaSource?.id).map(r=>({...r,revisions:r.revisions.map((v:any)=>({...v,body:''}))}))];
  // A hyphenated English compound in a question may be written as two words
  // in the source ("water-cache" / "water cache"). Keep the literal query,
  // and add a spelling variant only within this already-pinned attachment.
  const variants=[...new Set([question,question.replace(/([A-Za-z])[-‐‑–]([A-Za-z])/gu,'$1 $2')])],foundByRange=new Map<string,any>();
  for(const variant of variants)for(const hit of searchNotes(scoped,variant,4))if(hit.noteId===n.id){const key=`${hit.noteId}:${hit.start}:${hit.end}`,previous=foundByRange.get(key);if(!previous||(hit.score??0)>(previous.score??0))foundByRange.set(key,hit);}
  const found=[...foundByRange.values()].sort((a,b)=>(b.score??0)-(a.score??0)||a.start-b.start),fallback=chunks(latest(n).body).slice(0,1).map((c:any)=>({noteId:n.id,revision:ref.revision,title:latest(n).title,...c}));
  const coverage=ref.kind==='ocr'?'Recognized image text only; scene not processed':ref.kind==='pdf'?(n.pdfText.schema===2?'PDF text and recognized page text; OCR may contain errors; ':'PDF text layer; ')+n.pdfText.pages.length+'/'+n.pdfText.totalPages+' pages'+(n.pdfText.pages.some((p:any)=>!p.text.trim())?'; some pages have no extracted text':''):ref.kind==='speech'?(n.transcription.sourceTrack==='video-audio'?'Video audio-only transcript; frames not processed; '+videoTimingCoverage(n.transcription,latest(n).body,ref.revision):'Audio transcript; estimated segment timing'):'Original text';
  const sourceCoverage=ref.kind==='vision'?(n.visionText.scope==='sampled-video'?videoVisionCoverage(n.visionText):'Generated image observations; may be incorrect or speculative; single image only; not verified facts'):coverage;
  let hits=(found.length?found:fallback).map((hit:any)=>({...hit,coverage:sourceCoverage}));
  if(ref.kind==='vision'&&n.visionText.scope==='sampled-video'){
   // Coverage labels describe processing, not observed colors/events. Only
   // actual observation/transcript spans may be proposed as factual quotes.
   const video=n.visionText,ranges=video.frames.map((frame:any)=>({start:frame.start,end:frame.end,quote:frame.text,position:'Sampled frame at '+(frame.timestampUs/1e6).toFixed(3)+' s'}));
   if(video.audio.status==='processed')ranges.push(...chunks(video.audio.value.text).map((part:any)=>({...part,start:video.audioStart+part.start,end:video.audioStart+part.end,position:'Video audio transcript; estimated timing'})));
   hits=ranges.map((range:any,index:number)=>({...range,index,rank:found.findIndex((hit:any)=>range.start<hit.end&&range.end>hit.start)})).sort((a:any,b:any)=>(a.rank<0?Infinity:a.rank)-(b.rank<0?Infinity:b.rank)||a.index-b.index).slice(0,4).map(({start,end,quote,position}:any)=>({noteId:n.id,revision:ref.revision,title:latest(n).title,start,end,quote,coverage:sourceCoverage+'; '+position}));
  }
  if(!hits.length)throw Error('Input text unavailable');primary.push(hits[0]);extra.push(...hits.slice(1));
 }
 return [...primary,...extra].filter((r,i,a)=>a.findIndex(v=>v.noteId===r.noteId&&v.start===r.start&&v.end===r.end)===i);
}
