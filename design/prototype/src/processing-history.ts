import type {AssetTool} from './asset-activity.ts';
import {recordOperation,validateActivity,updateActivity,type Activity} from './harness-activity.ts';
// Audit receipts only: unsent media may never have been saved as a knowledge original.
export type ProcessingTool='image.read'|'pdf.read'|'speech.transcribe'|AssetTool;
export type ProcessingRecord={schema:1;type:'media-processing';activity:Activity};
export const processingKey=(id:string)=>'ui-v1-processing-'+id;
export function validateProcessing(key:string,value:any):asserts value is ProcessingRecord{
 if(value?.schema!==1||value.type!=='media-processing'||!value.activity||key!==processingKey(value.activity.id))throw Error('Invalid processing receipt');
 validateActivity([value.activity]);if(!['decision.prepare','decision.load','decision.unload','image.read','ocr.prepare','pdf.read','speech.transcribe','model.prepare','model.load','model.unload','speech.prepare'].includes(value.activity.tool))throw Error('Invalid processing operation');
}
export function processingUpdate(old:ProcessingRecord|undefined,next:Activity):ProcessingRecord{
 const value:ProcessingRecord={schema:1,type:'media-processing',activity:structuredClone(next)};validateProcessing(processingKey(next.id),value);
 if(old)validateProcessing(processingKey(next.id),old);updateActivity(old?[old.activity]:[],next);return value;
}
export function processingName(a:Activity){const input=a.input as any;return typeof input?.source?.name==='string'?input.source.name:typeof input?.source?.id==='string'?input.source.id:'Original';}
export function recordProcessingOperation<T>(tool:ProcessingTool,input:unknown,work:()=>Promise<T>,persist:(a:Activity)=>Promise<void>,project:(r:T)=>unknown,stopped:()=>boolean){
 return recordOperation(tool,input,async()=>{if(stopped())throw Error('Stopped');try{const result=await work();if(stopped())throw Error('Stopped');return result;}catch(e){if(stopped())throw Error('Stopped');throw e;}},persist,project);
}
