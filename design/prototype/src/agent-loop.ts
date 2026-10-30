// The application owns tool availability and cancellation. The default loop
// has no arbitrary per-turn call ceiling; an optional profile limit is a user
// preference, while context capacity and cancellation remain hard boundaries.
import {AgentToolResultTooLargeError} from './agent-tool-errors.ts';
import {MAX_CONFIGURED_AGENT_TOOLS} from './agent-limits.ts';
export {AgentToolResultTooLargeError} from './agent-tool-errors.ts';
export {MAX_CONFIGURED_AGENT_TOOLS} from './agent-limits.ts';
export const MAX_AGENT_RESULT_CHARS=8_000;
export {builtinToolIds as SAFE_AGENT_TOOL_IDS} from './tools/builtin-tools.ts';

export type AgentToolEffect='read'|'review'|'external';
export type AgentToolCapability={id:string;effect:AgentToolEffect;network:'none'|'explicit-online';usage?:string;inputSchema?:Readonly<Record<string,unknown>>};
export type AgentToolCall={kind:'tool';tool:string;arguments:Record<string,unknown>;assistantContent?:string};
export type AgentToolBatch={kind:'tools';calls:AgentToolCall[];assistantContent?:string};
export type AgentPlan<Final> = AgentToolCall|AgentToolBatch|{kind:'final';value:Final};
export type AgentToolResult={tool:string;arguments:Record<string,unknown>;result:unknown;batchId?:string;assistantContent?:string};
export type AgentToolAttempt=AgentToolResult&{error?:{code:'invalid_tool_input'|'tool_execution'|'search_snapshot_changed'|'result_too_large'|'no_progress_loop'|'batch_not_executed'}};
export class AgentSearchSnapshotChangedError extends Error {constructor(){super('Search changed · restart');this.name='AgentSearchSnapshotChangedError';}}

/** Only the trusted pre-execution schema check may issue this recoverable error. */
export class AgentToolInputError extends Error {
 readonly code='invalid_tool_input';
 constructor(){super('Tool arguments do not match the declared schema.');this.name='AgentToolInputError';}
}

/** Stable receipt category for a rejected or malformed model-selected tool plan. */
export class AgentProtocolError extends Error {
 readonly code='agent_protocol';
 constructor(message:string){super(message);this.name='AgentProtocolError';}
}

/** Stable receipt category for an exception raised while an approved adapter runs. */
export class AgentToolExecutionError extends Error {
 readonly code='tool_execution';
 constructor(tool:string,_cause:unknown){super('A registered local tool could not complete its operation.');this.name='AgentToolExecutionError';this.tool=tool;}
 readonly tool:string;
}

/** The current model context cannot fit the existing request and tool history. */
export class AgentContextCapacityError extends Error {
 constructor(){super('Input exceeds context capacity');this.name='AgentContextCapacityError';}
}
export class AgentSourceCapacityError extends AgentContextCapacityError {
 constructor(){super();this.message='Context limit · fewer sources';this.name='AgentSourceCapacityError';}
}

function exactKeys(value:Record<string,unknown>,expected:string[]){
 const actual=Object.keys(value).sort(),wanted=[...expected].sort();
 return actual.length===wanted.length&&actual.every((key,index)=>key===wanted[index]);
}
function validRecord(value:unknown):value is Record<string,unknown>{
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
}
function stableJson(value:unknown):string{
 if(Array.isArray(value))return `[${value.map(stableJson).join(',')}]`;
 if(validRecord(value))return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
 return JSON.stringify(value);
}
function sameCall(left:AgentToolCall,right:AgentToolCall){
 try{return left.tool===right.tool&&stableJson(left.arguments)===stableJson(right.arguments);}catch{return false;}
}
function sameSuccessfulOutcome(call:AgentToolCall,result:unknown,item:AgentToolAttempt){
 if(item.error||!sameCall(call,{kind:'tool',tool:item.tool,arguments:item.arguments}))return false;
 // Distinct queries can legitimately have identical or empty results. Only
 // an unchanged call with an unchanged outcome is evidence of repetition.
 try{return stableJson(item.result)===stableJson(result);}catch{return false;}
}
function snapshotBoundedResult(result:unknown,maxChars=MAX_AGENT_RESULT_CHARS):unknown{
 let serialized:string;
 try{serialized=JSON.stringify(result);}catch{throw new AgentProtocolError('Tool result is not serializable');}
 if(typeof serialized!=='string')throw new AgentProtocolError('Tool result is not serializable');
 if(serialized.length>maxChars)throw new AgentToolResultTooLargeError();
 return JSON.parse(serialized);
}
// A later failed continuation proves the earlier pages of that same search
// snapshot are stale. Keep all attempts for audit, but never use them as
// answer evidence or to justify a partial-budget answer.
function usableHistory(history:readonly AgentToolAttempt[]):AgentToolAttempt[]{
 const stale=new Set(history.filter(item=>item.tool==='memory.search'&&item.error?.code==='search_snapshot_changed'&&typeof item.arguments.query==='string'&&typeof item.arguments.snapshot==='string').map(item=>JSON.stringify([item.arguments.query,item.arguments.snapshot])));
 // A failed continuation cannot prove that earlier source metadata remains
 // current. Keep attempts for audit, but do not offer them as answer data.
 const staleSources=new Set(history.filter(item=>item.tool==='memory.sources'&&item.error?.code==='tool_execution'&&typeof item.arguments.id==='string'&&typeof item.arguments.snapshot==='string').map(item=>JSON.stringify([item.arguments.id,item.arguments.revision,item.arguments.snapshot])));
 // A failed revision-checked continuation makes earlier ranges for that
 // record unsafe. Later fresh reads remain usable, including the same version
 // after a transient failure. The audited attempts themselves remain intact.
 const failedReads=history.flatMap((item,index)=>item.tool==='memory.read'&&item.error?.code==='tool_execution'&&typeof item.arguments.query==='string'&&Number.isSafeInteger(item.arguments.expectedRevision)?[{index,query:item.arguments.query,revision:item.arguments.expectedRevision}]:[]);
 const matchesRead=(row:Record<string,unknown>,query:string)=>row.noteId===query||row.path===query||typeof row.path==='string'&&row.path.split('/').at(-1)===query;
 const resolvedFailures=failedReads.map(failure=>({...failure,ids:new Set(history.slice(0,failure.index).flatMap(item=>item.tool==='memory.read'&&!item.error&&Array.isArray(item.result)?item.result.filter(row=>validRecord(row)&&row.revision===failure.revision&&matchesRead(row,failure.query)&&typeof row.noteId==='string').map(row=>row.noteId as string):[]))}));
 return history.filter((item,index)=>{const rows=Array.isArray(item.result)?item.result:validRecord(item.result)&&Array.isArray(item.result.hits)?item.result.hits:[];if(!item.error&&(item.tool==='memory.read'||item.tool==='memory.search')&&rows.some(row=>validRecord(row)&&resolvedFailures.some(failure=>index<failure.index&&(matchesRead(row,failure.query)||typeof row.noteId==='string'&&failure.ids.has(row.noteId))&&row.revision===failure.revision)))return false;if(item.error||!validRecord(item.result)||typeof item.result.snapshot!=='string')return true;if(item.tool==='memory.search')return !stale.has(JSON.stringify([item.arguments.query,item.result.snapshot]));if(item.tool==='memory.sources')return !staleSources.has(JSON.stringify([item.arguments.id,item.arguments.revision,item.result.snapshot]));return true;});
}
function plannerHistory(history:readonly AgentToolAttempt[]):AgentToolAttempt[]{
 const usable=new Set(usableHistory(history));
 return history.map(item=>usable.has(item)?item:{...item,result:null,error:{code:item.tool==='memory.search'?'search_snapshot_changed':'tool_execution'}});
}

/** Run a bounded sequence of registered tools, then return the model's final plan.
 * Tool output is handed back as data; it must be labelled untrusted by the caller.
 */
export async function runReadOnlyAgentLoop<Final>(input:{
 allowedTools:readonly AgentToolCapability[];
 maxToolCalls?:number|null;
 maxResultChars?:number;
 plan:(history:readonly AgentToolAttempt[])=>Promise<AgentPlan<Final>>;
 onBudgetExhausted?:(history:readonly AgentToolAttempt[])=>Promise<Final>|Final;
 execute:(call:AgentToolCall,attemptIndex:number)=>Promise<unknown>;
 check:()=>void;
}):Promise<{final:Final;calls:readonly AgentToolResult[];attempts:readonly AgentToolAttempt[];budgetExhausted?:boolean;budgetCause?:'context'|'source-capacity'|'tool-limit'}>{
 // This loop currently executes read-only local tools. Other effects have
 // explicit types but cannot enter this executor until their review/network
 // adapters enforce their commit/connection boundaries.
 if(!Array.isArray(input.allowedTools)||new Set(input.allowedTools.map(tool=>tool.id)).size!==input.allowedTools.length||input.allowedTools.some(tool=>!tool||typeof tool.id!=='string'||!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(tool.id)||tool.effect!=='read'||tool.network!=='none'))throw new AgentProtocolError('Invalid agent tool allowlist');
 const maxToolCalls=input.maxToolCalls??null,maxResultChars=input.maxResultChars??MAX_AGENT_RESULT_CHARS;
 if(maxToolCalls!==null&&(!Number.isSafeInteger(maxToolCalls)||maxToolCalls<0)||!Number.isSafeInteger(maxResultChars)||maxResultChars<256||maxResultChars>MAX_AGENT_RESULT_CHARS)throw new AgentProtocolError('Invalid agent profile budget');
 const allowed=new Set(input.allowedTools.map(tool=>tool.id)),history:AgentToolAttempt[]=[];
 for(;;){
  input.check();
  // A planner must not be able to change evidence from an earlier step.
  let plan:AgentPlan<Final>;
  try{plan=await input.plan(structuredClone(plannerHistory(history)));}
  catch(error){
   input.check();
   if(!(error instanceof AgentContextCapacityError)||!history.length||!input.onBudgetExhausted)throw error;
   const final=await input.onBudgetExhausted(structuredClone(usableHistory(history)));input.check();
   return {final,calls:usableHistory(history).filter(item=>!item.error),attempts:history,budgetExhausted:true,budgetCause:error instanceof AgentSourceCapacityError?'source-capacity':'context'};
  }
  input.check();
  if(!validRecord(plan)||typeof plan.kind!=='string')throw new AgentProtocolError('Invalid agent plan');
  if(plan.kind==='final'){
   if(!exactKeys(plan,['kind','value']))throw new AgentProtocolError('Invalid agent final plan');
   return {final:plan.value as Final,calls:usableHistory(history).filter(item=>!item.error),attempts:history};
  }
  let calls:AgentToolCall[];
  const contentIsValid=(value:unknown)=>value===undefined||typeof value==='string'&&value.length<=32768;
  const toolKeys=(value:Record<string,unknown>)=>Object.keys(value).filter(key=>key!=='assistantContent').sort();
  if(plan.kind==='tool'&&toolKeys(plan).join(',')==='arguments,kind,tool'&&contentIsValid(plan.assistantContent))calls=[plan as unknown as AgentToolCall];
  else if(plan.kind==='tools'&&toolKeys(plan).join(',')==='calls,kind'&&contentIsValid(plan.assistantContent)&&Array.isArray(plan.calls)&&plan.calls.length>=2&&plan.calls.every(call=>validRecord(call)&&exactKeys(call,['kind','tool','arguments'])&&call.kind==='tool'&&typeof call.tool==='string'&&allowed.has(call.tool)&&validRecord(call.arguments)))calls=plan.calls.map(call=>({...call,...(plan.assistantContent?{assistantContent:plan.assistantContent}:{})}));
  else throw new AgentProtocolError('Tool is not registered or call is invalid');
  if(calls.some(call=>call.kind!=='tool'||typeof call.tool!=='string'||!allowed.has(call.tool)||!validRecord(call.arguments)||!contentIsValid(call.assistantContent)))throw new AgentProtocolError('Tool is not registered or call is invalid');
  if(maxToolCalls!==null&&history.length+calls.length>maxToolCalls){
   if(input.onBudgetExhausted){
    const final=await input.onBudgetExhausted(structuredClone(usableHistory(history)));input.check();
    return {final,calls:usableHistory(history).filter(item=>!item.error),attempts:history,budgetExhausted:true,budgetCause:'tool-limit'};
   }
   throw new AgentProtocolError('Agent tool call limit reached');
  }
  const batchId=calls.length>1?`batch-${history.length+1}`:undefined;
  let abortedBatchAt:number|undefined;
  for(let callIndex=0;callIndex<calls.length;callIndex++){
   const proposed=calls[callIndex];
   const recordedTool=proposed.tool,recordedArguments=structuredClone(proposed.arguments);
   const call:AgentToolCall={kind:'tool',tool:recordedTool,arguments:structuredClone(recordedArguments),...(proposed.assistantContent?{assistantContent:proposed.assistantContent}:{})};
   // Skipped batch members are protocol placeholders, not failed executions.
   // Look through them so useful unrun work can be retried, while a trailing
   // placeholder cannot hide a no-progress signal for the guarded call.
   let previousIndex=history.length-1;
   while(previousIndex>=0&&history[previousIndex].error?.code==='batch_not_executed')previousIndex--;
   const previous=history[previousIndex];
   if(previous?.error&&sameCall(call,{kind:'tool',tool:previous.tool,arguments:previous.arguments})){
    // Give the planner one explicit recovery step after it ignored a typed
    // failure. Do not execute the failed operation again; if the planner
    // ignores this signal too, stop instead of spinning forever.
    if(previous.error.code==='no_progress_loop')throw new AgentProtocolError('Agent repeated the same failed tool call without changing its arguments');
    history.push({tool:recordedTool,arguments:recordedArguments,result:null,error:{code:'no_progress_loop'},...(call.assistantContent?{assistantContent:call.assistantContent}:{}),...(batchId?{batchId}:{})});
    abortedBatchAt=callIndex;
    break;
   }
   input.check();
   try{
    const result=await input.execute(call,history.length);
    input.check();
    const boundedResult=snapshotBoundedResult(result,maxResultChars);
    // Repeating an unchanged call and outcome is a common small-model loop.
    // Allow two observations, then give the planner one explicit recovery signal.
    // A changed result or arguments can represent useful progress.
    const repeatedOutcomes=usableHistory(history).slice(-16).filter(item=>sameSuccessfulOutcome(call,boundedResult,item)).length;
    if(repeatedOutcomes>=2){
     history.push({tool:recordedTool,arguments:recordedArguments,result:null,error:{code:'no_progress_loop'},...(call.assistantContent?{assistantContent:call.assistantContent}:{}),...(batchId?{batchId}:{})});
     abortedBatchAt=callIndex;
     break;
    }
    history.push({tool:recordedTool,arguments:recordedArguments,result:boundedResult,...(call.assistantContent?{assistantContent:call.assistantContent}:{}),...(batchId?{batchId}:{})});
   }catch(error){
    input.check();
    // The overflowing operation did not commit a usable result. Keep only
    // earlier completed observations; the host has recorded this failure.
    if(error instanceof AgentSourceCapacityError&&history.length&&input.onBudgetExhausted){
     const final=await input.onBudgetExhausted(structuredClone(usableHistory(history)));input.check();
     return {final,calls:usableHistory(history).filter(item=>!item.error),attempts:history,budgetExhausted:true,budgetCause:'source-capacity'};
    }
    const code=error instanceof AgentToolInputError?'invalid_tool_input':error instanceof AgentSearchSnapshotChangedError?'search_snapshot_changed':error instanceof AgentToolExecutionError?'tool_execution':error instanceof AgentToolResultTooLargeError?'result_too_large':null;
    if(!code)throw error;
    history.push({tool:recordedTool,arguments:recordedArguments,result:null,error:{code},...(call.assistantContent?{assistantContent:call.assistantContent}:{}),...(batchId?{batchId}:{})});
   }
  }
  // A model-proposed batch is one assistant tool-call message. If a loop guard
  // stops it partway through, return one explicit non-execution result for each
  // remaining call so native tool-call/result history stays well-formed.
  if(abortedBatchAt!==undefined)for(const proposed of calls.slice(abortedBatchAt+1))history.push({tool:proposed.tool,arguments:structuredClone(proposed.arguments),result:null,error:{code:'batch_not_executed'},...(proposed.assistantContent?{assistantContent:proposed.assistantContent}:{}),...(batchId?{batchId}:{})});
 }
}
