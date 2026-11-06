import type {NoteView} from './knowledge-store.ts';
import type {NewNoteContent} from './note-creation.ts';

export const PENDING_NOTE_REVIEW_STATE='pending-note-review';
export const PENDING_NOTE_REVIEW_KEY='ui-v1-'+PENDING_NOTE_REVIEW_STATE;
export class PendingNoteReviewConflictError extends Error{
 constructor(message='Saved note review changed · reopen it'){super(message);this.name='PendingNoteReviewConflictError';}
}
export type PendingNoteDraft=NewNoteContent&{id:string;path:string};
export type PendingNoteReview={schema:1;type:'new-note-review';createdAt:string;turnId:string;note:PendingNoteDraft};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(value:object,keys:string[])=>Object.keys(value).sort().join(',')===keys.sort().join(',');

/** A pending capture is inert editor data. It cannot write a note until reviewed and saved. */
export function validatePendingNoteReview(value:unknown):PendingNoteReview{
 const row=value as PendingNoteReview;
 if(!row||typeof row!=='object'||Array.isArray(row)||!exact(row,['schema','type','createdAt','turnId','note'])||row.schema!==1||row.type!=='new-note-review'||typeof row.createdAt!=='string'||!Number.isFinite(Date.parse(row.createdAt))||new Date(row.createdAt).toISOString()!==row.createdAt||typeof row.turnId!=='string'||!row.turnId||row.turnId.length>256)throw Error('Invalid saved note review');
 const note=row.note as PendingNoteDraft;
 if(!note||typeof note!=='object'||Array.isArray(note)||!exact(note,['id','path','body','kind','sources',...(note.dialogueCopy!==undefined?['dialogueCopy']:[]),...(note.dialogueCopyCoverage!==undefined?['dialogueCopyCoverage']:[])])||typeof note.id!=='string'||!note.id||note.id.length>256||typeof note.path!=='string'||!note.path||note.path.length>1024||typeof note.body!=='string'||!['original','generated'].includes(note.kind)||!Array.isArray(note.sources)||note.sources.length>256||note.dialogueCopyCoverage!==undefined&&note.dialogueCopyCoverage!=='partial')throw Error('Invalid saved note review');
 for(const ref of note.sources){if(!ref||typeof ref!=='object'||typeof ref.noteId!=='string'||!ref.noteId||!Number.isSafeInteger(ref.revision)||ref.revision<1||!Number.isSafeInteger(ref.start)||!Number.isSafeInteger(ref.end)||ref.start<0||ref.end<=ref.start||typeof ref.quote!=='string'||ref.end-ref.start!==ref.quote.length||ref.citedQuote!==undefined&&typeof ref.citedQuote!=='string')throw Error('Invalid saved note sources');}
 if(note.dialogueCopy!==undefined){const copy=note.dialogueCopy as any;if(!copy||typeof copy!=='object'||typeof copy.turnId!=='string'||!copy.turnId||!Number.isSafeInteger(copy.turnIndex)||copy.turnIndex<0||!['user','assistant'].includes(copy.speaker))throw Error('Invalid saved note source');}
 const bytes=new TextEncoder().encode(JSON.stringify(row)).length;if(bytes>2_000_000)throw Error('Saved note review exceeds limit');
 return structuredClone(row);
}
export function makePendingNoteReview(note:PendingNoteDraft,turnId:string,createdAt=new Date().toISOString()):PendingNoteReview{
 return validatePendingNoteReview({schema:1,type:'new-note-review',createdAt,turnId,note});
}
export function pendingNoteReviewView(value:unknown):NoteView{
 const review=validatePendingNoteReview(value);
 return {id:review.note.id,path:review.note.path,body:review.note.body,version:1,history:[],kind:review.note.kind,sources:structuredClone(review.note.sources),...(review.note.dialogueCopy?{dialogueCopy:structuredClone(review.note.dialogueCopy)}:{}),...(review.note.dialogueCopyCoverage?{dialogueCopyCoverage:review.note.dialogueCopyCoverage}:{})};
}
export function samePendingNoteReview(a:unknown,b:unknown){return equal(a,b);}
