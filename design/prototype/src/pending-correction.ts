import {applyCorrection,correctionOperationRaw,verifyHistoricalCorrection,type CorrectionProposal} from './note-corrections.ts';
// @ts-expect-error Shared canonical validation is JavaScript.
import {checkNotes} from '../../../dist/core.js';
// @ts-expect-error Shared paths are JavaScript.
import {notePath} from '../../../dist/files.js';

export const PENDING_CORRECTION_STATE='pending-correction';
export const PENDING_CORRECTION_KEY='ui-v1-'+PENDING_CORRECTION_STATE;
export class PendingCorrectionConflictError extends Error{constructor(){super('Saved review changed · reopen it');this.name='PendingCorrectionConflictError';}}
export type PendingCorrection={schema:1;type:'pending-correction';createdAt:string;proposal:CorrectionProposal;turnId?:string};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(value:object,keys:string[])=>Object.keys(value).sort().join(',')===keys.sort().join(',');

/** Inert portable proposal validation. Current eligibility/CAS is checked separately. */
export function validatePendingCorrection(value:unknown):PendingCorrection{
 const row=value as PendingCorrection;
 if(!row||typeof row!=='object'||Array.isArray(row)||!exact(row,['schema','type','createdAt','proposal',...(row.turnId!==undefined?['turnId']:[])])||row.schema!==1||row.type!=='pending-correction'||typeof row.createdAt!=='string'||!Number.isFinite(Date.parse(row.createdAt))||new Date(row.createdAt).toISOString()!==row.createdAt||row.turnId!==undefined&&(typeof row.turnId!=='string'||!row.turnId||row.turnId.length>256))throw Error('Invalid saved review');
 if(new TextEncoder().encode(JSON.stringify(row)).length>2_000_000)throw Error('Saved review exceeds limit');
 const p=row.proposal;
 if(!p||typeof p!=='object'||Array.isArray(p)||!exact(p,['schema','id','request','path','expected','before','after','operation',...(p.dependencies!==undefined?['dependencies']:[])])||p.schema!==1||typeof p.id!=='string'||!p.id||p.id.length>128||typeof p.before!=='string'||typeof p.after!=='string'||typeof p.path!=='string'||!p.expected||p.dependencies!==undefined&&(!Array.isArray(p.dependencies)||p.dependencies.length>256))throw Error('Invalid saved review');
 // A snapshot can cite other canonical notes. Validate its shape without turning
 // a partial snapshot into an independent source graph or changing stored bytes.
 const snapshots=[p.expected,...(p.dependencies??[])];
 if(snapshots.some(note=>!Array.isArray(note.sources)||note.sources.some((ref:any)=>!ref||typeof ref.noteId!=='string'||!Number.isInteger(ref.revision)||ref.revision<1||!Number.isInteger(ref.start)||!Number.isInteger(ref.end)||ref.start<0||ref.end<=ref.start||typeof ref.quote!=='string'||ref.quote.length!==ref.end-ref.start)))throw Error('Invalid saved review sources');
 checkNotes(snapshots.map(note=>({...note,sources:[]})));
 if(p.path!==notePath(p.expected)||p.before!==p.expected.revisions.at(-1).body)throw Error('Invalid saved review');
 const result=verifyHistoricalCorrection(p.expected,p.request,correctionOperationRaw(p.operation,p.after));
 if(result.after!==p.after||!equal(result.operation,p.operation))throw Error('Invalid saved review');
 return row;
}

export function makePendingCorrection(proposal:CorrectionProposal,turnId?:string):PendingCorrection{
 return structuredClone(validatePendingCorrection({schema:1,type:'pending-correction',createdAt:new Date().toISOString(),proposal,...(turnId!==undefined?{turnId}:{})}));
}

/** A read-only dry validation; never persists a revision, receipt or approval. */
export function pendingCorrectionProblem(value:PendingCorrection,records:any[]):string{
 try{const row=validatePendingCorrection(value);applyCorrection(records,row.proposal);return '';}
 catch(error){return (error as Error).message||'Saved review unavailable';}
}
