import type {AgentToolResult} from './agent-loop.ts';
import type {SourceRef} from './conversation.ts';

// Model-facing tool payloads are deliberately smaller than the canonical tool
// result and preserve source offsets only for exact original substrings.
export function projectAgentToolResult(tool:string,result:unknown):unknown{
 if(!Array.isArray(result))throw Error('Invalid local tool result');
 if(tool==='memory.search')return result.slice(0,5).flatMap((item:any)=>{
  if(!item||typeof item.noteId!=='string'||!Number.isSafeInteger(item.revision)||!Number.isSafeInteger(item.start)||typeof item.quote!=='string'||item.start<0||item.revision<1||item.end-item.start!==item.quote.length)return [];
  const quote=item.quote.slice(0,500);return [{noteId:item.noteId,revision:item.revision,start:item.start,end:item.start+quote.length,quote,...(typeof item.title==='string'?{title:item.title}:{})}];
 });
 if(tool==='memory.read')return result.slice(0,3).flatMap((item:any)=>{
  if(!item||typeof item.id!=='string'||typeof item.path!=='string'||!Number.isSafeInteger(item.version)||item.version<1||typeof item.body!=='string')return [];
  const excerpt=item.body.slice(0,2000);return [{noteId:item.id,path:item.path,revision:item.version,excerpt,partial:excerpt.length<item.body.length}];
 });
 throw Error('Tool is not available to the read-only answer loop');
}

export function agentEvidenceFromCalls(calls:readonly AgentToolResult[]):SourceRef[]{
 const refs:SourceRef[]=[];
 for(const call of calls){
  if(!Array.isArray(call.result))continue;
  if(call.tool==='memory.search')for(const item of call.result as any[]){
   if(item&&typeof item.noteId==='string'&&Number.isSafeInteger(item.revision)&&Number.isSafeInteger(item.start)&&Number.isSafeInteger(item.end)&&item.end>=item.start&&typeof item.quote==='string'&&item.end-item.start===item.quote.length)refs.push({noteId:item.noteId,revision:item.revision,start:item.start,end:item.end,quote:item.quote,...(typeof item.title==='string'?{title:item.title}:{})});
  }
  else if(call.tool==='memory.read')for(const item of call.result as any[]){
   if(item&&typeof item.noteId==='string'&&typeof item.path==='string'&&Number.isSafeInteger(item.revision)&&item.revision>0&&typeof item.excerpt==='string'&&item.excerpt.length)refs.push({noteId:item.noteId,revision:item.revision,start:0,end:item.excerpt.length,quote:item.excerpt,title:item.path});
  }
 }
 return refs.filter((ref,index,all)=>all.findIndex(candidate=>candidate.noteId===ref.noteId&&candidate.revision===ref.revision&&candidate.start===ref.start&&candidate.end===ref.end)===index);
}
