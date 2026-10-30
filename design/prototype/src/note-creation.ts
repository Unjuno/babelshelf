import type {DialogueCopy} from './dialogue-copy.ts';
import type {SavedSourceRef} from './note-provenance.ts';
import type {NoteView} from './knowledge-store.ts';
import {completeTurn,type Dialogue} from './conversation.ts';
import {boundedPrefix} from './utf8-text.ts';

export function newNoteSourceRef(note:{id:string;path:string;body:string}){
 const quote=boundedPrefix(note.body,700);
 return {noteId:note.id,revision:1,start:0,end:quote.length,quote,title:note.path};
}

export function discardPendingNoteReview(dialogue:Dialogue,turnId:string):Dialogue{
 if(dialogue.turns.find(turn=>turn.id===turnId)?.status!=='Review new note')return dialogue;
 return completeTurn(dialogue,turnId,{status:'Draft discarded'});
}

export type NewNoteContent={body:string;kind:'original'|'generated';sources:SavedSourceRef[];dialogueCopy?:DialogueCopy;dialogueCopyCoverage?:'partial'};

/** Construct the shared revision-one view used by every app-owned note creator. */
export function createNewNoteView(input:NewNoteContent & {id?:string;path:string}):NoteView{
 if(typeof input.path!=='string'||!input.path.trim()||typeof input.body!=='string'||!['original','generated'].includes(input.kind)||!Array.isArray(input.sources))throw Error('Invalid new note');
 const id=input.id??crypto.randomUUID();
 if(typeof id!=='string'||!id.trim())throw Error('Invalid new note ID');
 return {
  id,path:input.path,body:input.body,version:1,history:[],kind:input.kind,
  sources:structuredClone(input.sources),
  ...(input.dialogueCopy?{dialogueCopy:structuredClone(input.dialogueCopy)}:{}),
  ...(input.dialogueCopyCoverage?{dialogueCopyCoverage:input.dialogueCopyCoverage}:{}),
 };
}
