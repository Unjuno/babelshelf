import type {NoteView} from './knowledge-store.ts';
import type {ExecutionView} from './useTasks.ts';
import {taskRunView,validateRunCalculation} from './task-records.ts';

/** Point at the actual answer field in the current, verified execution record. */
export function calculationExecutionSource(note:NoteView|undefined,run:ExecutionView){
 if(!note||note.recordType!=='execution'||note.id!==run.id||note.version!==run.version||!run.calculation)return null;
 try{const actual=taskRunView({ui:{recordType:'execution'},revisions:[{version:note.version,body:note.body}]});validateRunCalculation(actual);if(!actual.calculation||actual.answer!==run.answer||actual.taskId!==run.taskId||actual.taskRevision!==run.taskRevision||JSON.stringify(actual.calculation)!==JSON.stringify(run.calculation))return null;}catch{return null;}
 const quote='"answer": '+JSON.stringify(run.answer),start=note.body.indexOf(quote);
 if(start<0||note.body.indexOf(quote,start+quote.length)!==-1)return null;
 return {noteId:note.id,revision:note.version,start,end:start+quote.length,quote};
}

/** Use a readable answer only for the exact verified calculation citation. */
export function calculationCitationAnswer(record:any,revision:any,ref:{noteId:string;revision:number;start:number;end:number;quote:string}){
 if(record?.ui?.recordType!=='execution'||record.id!==ref.noteId||revision?.version!==ref.revision)return undefined;
 try{
  const data=taskRunView({ui:{recordType:'execution'},revisions:[revision]});validateRunCalculation(data);
  const quote='"answer": '+JSON.stringify(data.answer);
  if(data.calculation&&ref.quote===quote&&revision.body.slice(ref.start,ref.end)===quote)return data.answer;
 }catch{}
 return undefined;
}
