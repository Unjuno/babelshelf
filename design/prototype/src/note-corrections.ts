// Model output is a proposal, never a write capability. All patches target exact bytes.
// @ts-expect-error Shared baseline is JavaScript.
import {latest,reviseNote,checkNotes} from '../../../dist/core.js';
// @ts-expect-error Shared baseline is JavaScript.
import {notePath} from '../../../dist/files.js';
// @ts-expect-error Shared incremental hash is JavaScript.
import {SHA256} from '../../../dist/sha256.js';
import {applyTextTransform,textTransformMessages,type TextToolReceipt} from './text-transform.ts';
import type {ChatEngine} from './conversation';

type Canonical=any;
type Operation=Pick<TextToolReceipt,'name'|'arguments'|'result'>;
export type CorrectionProposal={schema:1;id:string;request:string;path:string;expected:Canonical;before:string;after:string;operation:Operation};
export type CorrectionReceipt={schema:1;type:'note-correction';id:string;request:string;noteId:string;path:string;beforeVersion:number;afterVersion:number;afterHash:string;operation:Operation;appliedAt:string;status:'applied'|'undone';undoneAt?:string;undoVersion?:number};
const recordHash=(note:Canonical)=>new SHA256().update(new TextEncoder().encode(JSON.stringify(note))).hex();
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function editable(note:Canonical){
 if(!note||note.state!=='active')throw Error('Correction target unavailable');
 if(note.ui?.protected||note.ui?.managed||note.ui?.recordType||/^(Settings|Tools|Schedule|Notifications)\//i.test(notePath(note)))throw Error('Correction target protected or unsupported');
 if(latest(note).body.length>30000)throw Error('Correction exceeds limit · original retained');
}
function selection(note:Canonical){return {turnId:note.id,turnIndex:0,speaker:'document',quote:latest(note).body,start:0,end:latest(note).body.length};}
function operationResult(note:Canonical,raw:string){
 const result=applyTextTransform(raw,selection(note));if(!result.answer||!result.toolCalls?.length)throw Error(result.status??'Invalid correction');
 const {name,arguments:args,result:outcome}=result.toolCalls[0];return {after:result.answer,operation:{name,arguments:args,result:outcome}};
}
export function prepareCorrection(note:Canonical,request:string,raw:string):CorrectionProposal{
 editable(note);if(typeof request!=='string'||!request.trim()||request.length>30000)throw Error('Invalid correction request');
 const result=operationResult(note,raw);return {schema:1,id:crypto.randomUUID(),request,path:notePath(note),expected:structuredClone(note),before:latest(note).body,...result};
}
export function resolveCorrectionTarget(records:Canonical[],query:string){
 const active=records.filter(n=>n.state==='active'),exact=active.filter(n=>n.id===query||notePath(n)===query),matches=exact.length?exact:active.filter(n=>notePath(n).split('/').at(-1)===query);
 if(matches.length>1)throw Error('Ambiguous file · specify the full path');if(!matches.length)throw Error('No matching file · specify the full path');editable(matches[0]);return matches[0];
}
export function applyCorrection(records:Canonical[],proposal:CorrectionProposal){
 if(proposal?.schema!==1||typeof proposal.id!=='string'||!proposal.id||typeof proposal.request!=='string'||!proposal.request.trim()||!proposal.operation)throw Error('Invalid correction proposal');
 const old=records.find(n=>n.id===proposal.expected?.id);editable(old);
 if(!equal(old,proposal.expected))throw Error('Version conflict · regenerate the proposal');
 const op=proposal.operation,action=op.name==='text.replace'?'replace':op.name==='text.split_lines'?'split_lines':null;
 if(!action)throw Error('Invalid correction operation');const actual=operationResult(old,JSON.stringify({action,...op.arguments}));
 if(proposal.path!==notePath(old)||proposal.before!==latest(old).body||proposal.after!==actual.after||!equal(proposal.operation,actual.operation))throw Error('Invalid correction proposal');
 const note=reviseNote(old,{body:actual.after},latest(old).version);checkNotes(records.map(n=>n.id===note.id?note:n));
 const receipt:CorrectionReceipt={schema:1,type:'note-correction',id:proposal.id,request:proposal.request,noteId:note.id,path:notePath(note),beforeVersion:latest(old).version,afterVersion:latest(note).version,afterHash:recordHash(note),operation:actual.operation,appliedAt:new Date().toISOString(),status:'applied'};
 return {note,receipt};
}
export function undoCorrection(records:Canonical[],receipt:CorrectionReceipt){
 if(receipt?.schema!==1||receipt.type!=='note-correction'||receipt.status!=='applied')throw Error('Correction already undone or unavailable');
 const old=records.find(n=>n.id===receipt.noteId);editable(old);
 if(!Number.isInteger(receipt.beforeVersion)||receipt.beforeVersion<1||receipt.afterVersion!==receipt.beforeVersion+1||latest(old).version!==receipt.afterVersion||recordHash(old)!==receipt.afterHash)throw Error('Version conflict · cannot undo after another change');
 const note=reviseNote(old,{body:old.revisions[receipt.beforeVersion-1].body},latest(old).version);checkNotes(records.map(n=>n.id===note.id?note:n));
 return {note,receipt:{...receipt,status:'undone' as const,undoneAt:new Date().toISOString(),undoVersion:latest(note).version}};
}
export async function proposeCorrection(engine:ChatEngine,request:string,note:Canonical,check=()=>{}){
 editable(note);check();const messages=textTransformMessages(request,selection(note));
 if((await engine.count(messages)).prompt_tokens+256>engine.manifest.contextTokens)throw Error('Input exceeds context limit · original retained');check();
 const result=await engine.generate(messages,256);check();if(result.stopped)throw Error('Stopped');return prepareCorrection(note,request,result.text);
}

export function canUndoCorrection(receipt:CorrectionReceipt,visible?:{id:string;version:number}){return !!visible&&receipt.noteId===visible.id&&receipt.status==='applied'&&visible.version===receipt.afterVersion;}
export async function loadCorrectionHistory(read:()=>Promise<CorrectionReceipt[]>,id:string,isCurrent:()=>boolean){const receipts=await read();return isCurrent()?receipts.filter(r=>r.noteId===id):null;}
export async function runReviewedCorrection(commit:()=>Promise<CorrectionReceipt>,refresh:()=>Promise<void>){
 const receipt=await commit();try{await refresh();return {receipt,refreshError:null};}catch(error){return {receipt,refreshError:error as Error};}
}
