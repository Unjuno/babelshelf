import type {AgentToolResult} from './agent-loop.ts';
import type {SourceRef} from './conversation.ts';
import type {FileResult} from './file-discovery.ts';
import type {ToolHost} from './tools/tool-host.ts';
import {calculate} from './tools/math.calculate/tool.ts';
import {validateDecimalReceipt,type DecimalReceipt} from './tools/math.calculate/decimal-receipt.ts';

export type AgentCalculation={expression:string;result:number;precision:'IEEE-754 binary64'}|DecimalReceipt;
const maxObservedEvidenceRefs=12,maxObservedEvidenceChars=24_000;
function deliverableHostResult(value:unknown):boolean{try{return new TextEncoder().encode(JSON.stringify(value)).byteLength<=24_000;}catch{return false;}}
function validSourceRef(value:unknown):value is SourceRef{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const ref=value as Record<string,unknown>;
 return typeof ref.noteId==='string'&&ref.noteId.length>0&&ref.noteId.length<=160&&typeof ref.revision==='number'&&Number.isSafeInteger(ref.revision)&&ref.revision>0&&typeof ref.start==='number'&&Number.isSafeInteger(ref.start)&&ref.start>=0&&typeof ref.end==='number'&&Number.isSafeInteger(ref.end)&&ref.end>=ref.start&&typeof ref.quote==='string'&&ref.quote.length>0&&ref.end-ref.start===ref.quote.length&&ref.quote.length<=maxObservedEvidenceChars&&(ref.title===undefined||typeof ref.title==='string'&&ref.title.length<=240);
}
function uniqueBoundedRefs(refs:readonly SourceRef[]):SourceRef[]{
 const out:SourceRef[]=[],seen=new Set<string>();let chars=0;
 for(const ref of refs){const key=`${ref.noteId}:${ref.revision}:${ref.start}:${ref.end}`;if(seen.has(key)||out.length>=maxObservedEvidenceRefs||chars+ref.quote.length>maxObservedEvidenceChars)continue;seen.add(key);chars+=ref.quote.length;out.push(ref);}
 return out;
}
/** Convert exact results observed at the trusted host.search boundary into source refs. */
export function agentSearchEvidenceFromHost(results:unknown):SourceRef[]{
 if(!Array.isArray(results)||!deliverableHostResult(results))return [];
 return uniqueBoundedRefs(results.flatMap((item:any)=>{
  if(!item||typeof item.noteId!=='string'||!Number.isSafeInteger(item.revision)||!Number.isSafeInteger(item.start)||!Number.isSafeInteger(item.end)||typeof item.quote!=='string')return [];
  const ref={noteId:item.noteId,revision:item.revision,start:item.start,end:item.end,quote:item.quote,...(typeof item.title==='string'?{title:item.title}:{})};return validSourceRef(ref)?[ref]:[];
 }));
}
/** A custom tool may inspect full note bodies. Capture only bounded canonical records returned by host.resolve. */
export function agentReadEvidenceFromHost(records:unknown):SourceRef[]{
 if(!Array.isArray(records)||!deliverableHostResult(records))return [];
 return uniqueBoundedRefs(records.flatMap((item:any)=>{
  if(!item||typeof item.id!=='string'||typeof item.path!=='string'||!Number.isSafeInteger(item.version)||typeof item.body!=='string')return [];
  const ref={noteId:item.id,revision:item.version,start:0,end:item.body.length,quote:item.body,title:item.path};return validSourceRef(ref)?[ref]:[];
 }));
}
/** Observe only canonical host capability results while returning the same data to the isolated package. */
export function observeCustomToolHost(host:ToolHost,observe:(refs:SourceRef[])=>void):ToolHost{
 return {...host,
  async search(query,signal){const result=await host.search(query,signal);observe(agentSearchEvidenceFromHost(result));return result;},
  async resolve(query,signal){const result=await host.resolve(query,signal);observe(agentReadEvidenceFromHost(result));return result;},
 };
}
export function checkedCalculation(value:unknown):AgentCalculation{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid calculation result');
 const row=value as Record<string,unknown>;
 if(row.precision==='decimal')return validateDecimalReceipt(value);
 if(typeof row.expression!=='string'||row.expression.length>200||typeof row.result!=='number'||!Number.isFinite(row.result)||row.precision!=='IEEE-754 binary64'||calculate(row.expression)!==row.result)throw Error('Invalid calculation result');
 return {expression:row.expression,result:row.result,precision:'IEEE-754 binary64'};
}
export function agentCalculationsFromCalls(calls:readonly AgentToolResult[]):AgentCalculation[]{
 return calls.filter(call=>call.tool==='math.calculate').flatMap(call=>{
  if(!Array.isArray(call.result)||call.result.length!==1)throw Error('Invalid calculation result');
  const value=checkedCalculation(call.result[0]);
  if(call.arguments.expression!==value.expression)throw Error('Calculation expression changed');
  return [value];
 });
}

// Model-facing tool payloads are deliberately smaller than the canonical tool
// result and preserve source offsets only for exact original substrings.
export function projectAgentToolResult(tool:string,result:unknown):unknown{
 if(/^user\.[a-z][a-z0-9-]{0,47}$/.test(tool)){
  return JSON.parse(serializeCustomToolResult(result));
 }
 if(!Array.isArray(result))throw Error('Invalid local tool result');
 if(tool==='math.calculate'){
  if(result.length!==1)throw Error('Invalid calculation result');
  return [checkedCalculation(result[0])];
 }
 if(tool==='memory.search')return result.slice(0,5).flatMap<SourceRef|FileResult>((item:any)=>{
  if(item?.kind==='file'){
   if(typeof item.noteId!=='string'||!item.noteId||item.noteId.length>160||!Number.isSafeInteger(item.revision)||item.revision<1||typeof item.path!=='string'||!item.path||item.path.length>1024)return [];
   return [{kind:'file',noteId:item.noteId,revision:item.revision,path:item.path}];
  }
  if(!item||typeof item.noteId!=='string'||!Number.isSafeInteger(item.revision)||!Number.isSafeInteger(item.start)||typeof item.quote!=='string'||item.start<0||item.revision<1||item.end-item.start!==item.quote.length)return [];
  const quote=item.quote.slice(0,500);return [{noteId:item.noteId,revision:item.revision,start:item.start,end:item.start+quote.length,quote,...(typeof item.title==='string'?{title:item.title}:{})}];
 });
 if(tool==='memory.read')return result.slice(0,3).flatMap((item:any)=>{
  if(!item||typeof item.id!=='string'||typeof item.path!=='string'||!Number.isSafeInteger(item.version)||item.version<1||typeof item.body!=='string')return [];
  const excerpt=item.body.slice(0,2000);return [{noteId:item.id,path:item.path,revision:item.version,excerpt,partial:excerpt.length<item.body.length}];
 });
 throw Error('Tool is not available to the read-only answer loop');
}

function serializeCustomToolResult(result:unknown):string{
 let serialized:string|undefined;try{serialized=JSON.stringify(result);}catch{throw Error('Custom tool result is not JSON data');}
 if(typeof serialized!=='string')throw Error('Custom tool result is not JSON data');
 if(new TextEncoder().encode(serialized).byteLength>8_000)throw Error('Custom tool result exceeds the active context limit');
 return serialized;
}

/** Keep custom call arguments transient; receipts retain only package identity and payload size. */
export function projectAgentActivityInput(tool:string,args:unknown,identity:unknown):unknown{
 if(!/^user\.[a-z][a-z0-9-]{0,47}$/.test(tool)){
  if(!args||typeof args!=='object'||Array.isArray(args)||!identity||typeof identity!=='object'||Array.isArray(identity))throw Error('Invalid tool activity input');
  return {...args as Record<string,unknown>,...identity as Record<string,unknown>};
 }
 const argumentBytes=new TextEncoder().encode(serializeCustomToolResult(args)).byteLength;
 if(!identity||typeof identity!=='object'||Array.isArray(identity))throw Error('Invalid custom tool identity');
 const item=identity as Record<string,unknown>;
 if(item.package!==tool||!Number.isSafeInteger(item.packageVersion)||typeof item.packageSha256!=='string'||!/^([a-f0-9]{64})$/.test(item.packageSha256)||item.entry!==`Tools/${tool}/tool.js`)throw Error('Invalid custom tool identity');
 return {kind:'custom_tool_call',argumentBytes,package:tool,packageVersion:item.packageVersion,packageSha256:item.packageSha256,entry:item.entry};
}

/** Keep custom output transient for the agent; durable activity stores metadata only. */
export function projectAgentActivityResult(tool:string,result:unknown):unknown{
 if(/^user\.[a-z][a-z0-9-]{0,47}$/.test(tool)){
  const serialized=serializeCustomToolResult(result);
  return {kind:'custom_tool_result',resultBytes:new TextEncoder().encode(serialized).byteLength};
 }
 return projectAgentToolResult(tool,result);
}

export function agentEvidenceFromCalls(calls:readonly AgentToolResult[],hostObservedRefs:readonly SourceRef[]=[]):SourceRef[]{
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
 return uniqueBoundedRefs([...refs.filter(validSourceRef),...hostObservedRefs.filter(validSourceRef)]);
}
