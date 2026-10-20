import {videoTimingCoverage} from './speech-transcript.ts';
import {validHarnessTarget} from './harness-actions.ts';
import {requestNamesEarlierDialogue,requestNamesWorkingFile,type Dialogue,type SourceRef} from './conversation.ts';
import {namedSavedSubject,namesExplicitSavedKnowledge} from './saved-knowledge-reference.ts';
// @ts-expect-error Shared canonical core is JavaScript.
import {latest,buildIndex,searchNotes,chunks} from '../../../dist/core.js';
// @ts-expect-error Shared canonical path contract is JavaScript.
import {notePath} from '../../../dist/files.js';
export type WorkingFile={noteId:string;revision:number};
export function validateWorkingFile(value:unknown):WorkingFile{
 const pin=value as WorkingFile;
 if(!pin||typeof pin!=='object'||Array.isArray(pin)||Object.keys(pin).sort().join(',')!=='noteId,revision'||typeof pin.noteId!=='string'||!pin.noteId||!Number.isSafeInteger(pin.revision)||pin.revision<1)throw Error('Working file invalid');return pin;
}
export function validateWorkingFileLink(records:any[],pin:WorkingFile){validateWorkingFile(pin);if(!records.some(n=>n.id===pin.noteId&&n.revisions?.some((v:any)=>v.version===pin.revision)))throw Error('Working file original unavailable');}
export function withWorkingFile(state:Dialogue,pin:WorkingFile):Dialogue{
 validateWorkingFile(pin);if(state.currentFile?.noteId===pin.noteId&&state.currentFile?.revision===pin.revision)return state;
 return {...state,revision:state.revision+1,currentFile:{...pin}};
}
export function workingFileNote(records:any[],pin:WorkingFile){
 validateWorkingFileLink(records,pin);const note=records.find(n=>n.id===pin.noteId);
 if(note.state!=='active'||latest(note).version!==pin.revision)throw Error('Working file changed · reopen the file');return structuredClone(note);
}
export function workingFileMetadata(note:any){const v=latest(note);return {id:note.id,path:notePath(note),version:v.version,excerpt:v.body.slice(0,700)};}
export function workingFileCoverage(note:any){
 const prefix='Selected excerpts of the explicitly opened file; ';
 return prefix+(note.ocrText?'stored OCR text only; scene not processed':note.pdfText?'stored extracted PDF text only; page coverage may be partial':note.transcription?(note.transcription.sourceTrack==='video-audio'?'stored video audio transcript only; frames not processed; '+videoTimingCoverage(note.transcription,latest(note).body,latest(note).version):'stored audio transcript only; timing estimated'):note.originalAsset?'stored text projection only; binary content not decoded here':'stored text');
}
export function workingFileEvidence(records:any[],pin:WorkingFile,question:string):(SourceRef&{coverage:string})[]{
 const note=workingFileNote(records,pin),version=latest(note);
 if(!buildIndex(records).docs.some((d:any)=>d.n.id===note.id))throw Error('Working file is not eligible evidence');
 // Eligibility is checked against the full canonical graph. A temporary text-only
 // projection ranks excerpts, never changes stored kind/sources or grants authority.
 const {mediaSource,...textProjection}=note;
 const ranked=searchNotes([{...textProjection,kind:'original',sources:[]}],question,4).filter((hit:any)=>hit.noteId===pin.noteId);
 const leading=chunks(version.body).slice(0,1).map((c:any)=>({noteId:note.id,revision:pin.revision,title:version.title,...c}));
 const refs=[...ranked,...leading].filter((r,i,a)=>a.findIndex(v=>v.start===r.start&&v.end===r.end)===i).map(r=>({...r,coverage:workingFileCoverage(note)}));
 if(!refs.length)throw Error('Working file text unavailable');return refs;
}
// Only the literal user-command parser calls this adapter. Model proposals never do.
export function scopeLiteralRequest<T extends {action:string}>(request:T|null,currentInputs=false):T|null{
 if(!request)return null;
 if(request.action==='read')return {...request,target:'path'};
 if(request.action==='search'||!currentInputs&&['answer','summary'].includes(request.action))return {...request,target:'knowledge'};
 return request;
}
export function bindWorkingFileRequest<T extends {action:string;query:string;target?:string}>(request:T,pin:WorkingFile|undefined,currentInputs=false):{request:T;binding:'explicit'|'default-working-file'|undefined}{
 if(request.target==='file')return {request,binding:'explicit'};
 if(currentInputs||!pin||request.target!==undefined||!validHarnessTarget(request.action,'file'))return {request,binding:undefined};
 validateWorkingFile(pin);
 if(Object.keys(request).some(k=>!['action','query'].includes(k)))throw Error('Invalid default file target');
 return {request:{...request,target:'file'},binding:'default-working-file'};
}
/** Explicit references to the currently opened file must use its pinned revision as evidence. */
export function bindExplicitCurrentFileQuestion<T extends {action:string;query:string;target?:string}>(request:T,question:string,pin:WorkingFile|undefined,currentInputs=false):T{
 if(currentInputs||!pin||!['answer','summary','search','read'].includes(request.action))return request;
 if(request.target==='knowledge'&&(namesExplicitSavedKnowledge(question)||namedSavedSubject(question)))return request;
 if(!requestNamesWorkingFile(question)||requestNamesEarlierDialogue(question))return request;
 // An already explicit read-only intent needs no second model classification.
 // Bind its query to the human request rather than model-supplied context text.
 const action=request.target==='file'&&['answer','summary'].includes(request.action)?request.action:'read';
 return {...request,action,target:'file',query:question};
}
export function createFileFocusQueue(read:()=>Dialogue,write:(state:Dialogue)=>Promise<void>){
 let tail=Promise.resolve();return {
  select(value:WorkingFile){const pin={...validateWorkingFile(value)};tail=tail.then(async()=>{const state=read(),next=withWorkingFile(state,pin);if(next!==state)await write(next);});return tail;},
  settled:()=>tail
 };
}
