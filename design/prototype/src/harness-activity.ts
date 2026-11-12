// Audit data only. A receipt never authorizes execution, replay, writes or network.
import {PlannerOutputError} from './planner-error.ts';
// @ts-expect-error Shared baseline is JavaScript.
import {parseJSON} from '../../../dist/core.js';
import {validHarnessAction} from './harness-actions.ts';
import {builtinTools,builtinToolIds} from './tools/builtin-tools.ts';
import {makeDecimalReceipt,validateDecimalReceipt} from './tools/math.calculate/decimal-receipt.ts';

// Retain only protocol categories, never model-authored strings or key names.
function queryFailureShape(error:PlannerOutputError){
 if(error.diagnostic.reason!=='query'||error.diagnostic.truncated)return {};
 try{
  const value=parseJSON(error.diagnostic.raw);
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const query=value.query;
  return {queryShape:{action:validHarnessAction(value.action)?value.action:'unknown',target:['file','path','knowledge','inputs','current','history'].includes(value.target)?value.target:'other',type:query===undefined?'missing':query===null?'null':Array.isArray(query)?'array':typeof query,...(typeof query==='string'?{empty:!query.trim(),overLimit:query.length>2000}:{})}};
 }catch{return {};}
}

// Non-tool lifecycle operations remain explicit. Executable built-ins derive
// their IDs and labels from the same catalog used by the actual registry.
const lifecycleActivityLabels={
 'tools.search':'Find tool','tools.read-skill':'Read tool guide',
 'decision.prepare':'Prepare decision model','decision.load':'Load decision model','decision.unload':'Unload decision model','decision.classify':'Decide',
 'image.read':'Read image','image.describe':'Describe image','ocr.prepare':'Prepare image reader','vision.prepare':'Prepare vision model','search.prepare':'Prepare Search model',
 'runtime.prepare':'Prepare local runtime','model.prepare':'Prepare text model','model.unload':'Unload model','model.test':'Test model generation',
 'speech.prepare':'Prepare speech model','pdf.read':'Read PDF','speech.transcribe':'Transcribe','model.load':'Load model',
 'dialogue.plan':'Select action','dialogue.subject':'Resolve speaker','dialogue.compact':'Context','dialogue.read':'Read earlier message',
 'text.transform':'Text operation','text.inspect':'Process original','memory.propose_correction':'Review changes','schedule.propose':'Review schedule','knowledge.answer':'Answer',
} as const;
export const activityTools=Object.freeze([...builtinToolIds,...Object.keys(lifecycleActivityLabels) as (keyof typeof lifecycleActivityLabels)[]]);
export type ActivityTool=typeof activityTools[number]|`user.${string}`;
export const MAX_ACTIVITY_EVENTS_PER_TURN=128;
export const RESERVED_AGENT_COMPLETION_EVENTS=4;
// The no-paging compatibility route must account for the planner receipt and
// the tool receipt for each attempted call. Each operation stores a start and
// finish event; a one-call/one-plan sequence therefore costs four events.
// Reserve the at-most-three typed planner repairs separately from completion.
export const ACTIVITY_EVENTS_PER_AGENT_TOOL=4;
export const RESERVED_AGENT_REPAIR_EVENTS=6;
/** Bound tool work by the actual per-turn receipt capacity, not a separate hidden loop ceiling. */
export function activityBoundedToolBudget(recordedEvents:number,configured:number|null){
 if(!Number.isSafeInteger(recordedEvents)||recordedEvents<0||recordedEvents>MAX_ACTIVITY_EVENTS_PER_TURN||configured!==null&&(!Number.isSafeInteger(configured)||configured<0))throw Error('Invalid activity budget');
 const remaining=MAX_ACTIVITY_EVENTS_PER_TURN-recordedEvents;
 // One plan plus one tool operation cost four receipts in the worst case.
 // Keep room for a final plan/answer and all three distinct bounded repairs.
 const storageBudget=Math.max(0,Math.floor((remaining-RESERVED_AGENT_COMPLETION_EVENTS-RESERVED_AGENT_REPAIR_EVENTS)/ACTIVITY_EVENTS_PER_AGENT_TOOL));
 return configured===null?storageBudget:Math.min(configured,storageBudget);
}
export type Json=null|boolean|number|string|Json[]|{[key:string]:Json};
export type Activity={schema:1;id:string;tool:ActivityTool;input:Json;startedAt:string;status:'running'|'succeeded'|'failed'|'stopped';finishedAt?:string;output?:Json;error?:{code:string;message:string}};
const codes=['stopped','source_changed','context_limit','generation_budget_exhausted','result_too_large','not_prepared','invalid_model_output','not_found','operation_failed','planner_protocol','agent_protocol','invalid_tool_input','tool_execution','model_runtime','persistence_failure'];
const validTool=(tool:unknown):tool is ActivityTool=>typeof tool==='string'&&(activityTools.includes(tool as typeof activityTools[number])||/^user\.[a-z][a-z0-9-]{0,47}$/.test(tool));
function payload(value:unknown):Json{
 const walk=(v:any,depth:number,seen:Set<any>):void=>{if(depth>20)throw Error('Activity payload depth limit');if(v===null||typeof v==='string'||typeof v==='boolean')return;if(typeof v==='number'&&Number.isFinite(v))return;if(!v||typeof v!=='object'||!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null||seen.has(v))throw Error('Activity payload must be portable JSON');const next=new Set([...seen,v]);for(const item of Object.values(v))walk(item,depth+1,next);};
 walk(value,0,new Set());const raw=JSON.stringify(value);if(new TextEncoder().encode(raw).length>300000)throw Error('Activity payload limit');return JSON.parse(raw);
}
const validTime=(at:unknown)=>typeof at==='string'&&Number.isFinite(Date.parse(at));
export function validateActivity(value:unknown):asserts value is Activity[]{
 if(!Array.isArray(value)||value.length>MAX_ACTIVITY_EVENTS_PER_TURN)throw Error('Activity list limit');const ids=new Set();
 for(const a of value){if(!a||a.schema!==1||typeof a.id!=='string'||!a.id||a.id.length>100||ids.has(a.id))throw Error('Invalid or duplicate activity');ids.add(a.id);if(!validTool(a.tool))throw Error('Unknown activity operation');if(!validTime(a.startedAt)||a.finishedAt!==undefined&&!validTime(a.finishedAt))throw Error('Invalid activity time');payload(a.input);
 if(a.status==='running'){if(a.finishedAt!==undefined||a.output!==undefined||a.error!==undefined)throw Error('Invalid running activity result');}
 else if(a.status==='succeeded'){if(!a.finishedAt||a.error!==undefined||a.output===undefined)throw Error('Missing activity output');payload(a.output);}
 else if(a.status==='failed'||a.status==='stopped'){if(!a.finishedAt||!a.error||!codes.includes(a.error.code)||typeof a.error.message!=='string'||!a.error.message||a.error.message.length>2000||a.status==='stopped'&&a.error.code!=='stopped')throw Error('Invalid activity error');if(a.output!==undefined)payload(a.output);}
 else throw Error('Invalid activity status');}
}
export function startActivity(tool:ActivityTool,input:unknown):Activity{const a:Activity={schema:1,id:crypto.randomUUID(),tool,input:payload(input),startedAt:new Date().toISOString(),status:'running'};validateActivity([a]);return a;}
function failure(error:unknown){const message=(error instanceof Error?error.message:String(error)).slice(0,2000)||'Operation failed';const reported=(error as {code?:unknown}|null)?.code;const code=message==='Stopped'?'stopped':typeof reported==='string'&&codes.includes(reported)?reported:/Source changed|Version conflict|Conversation changed/i.test(message)?'source_changed':/context limit/i.test(message)?'context_limit':/not prepared|not loaded|not configured/i.test(message)?'not_prepared':/JSON|citation|Invalid (?:model|answer|text operation|schedule proposal|schedule clarification)/i.test(message)?'invalid_model_output':/not found|unavailable/i.test(message)?'not_found':'operation_failed';return {code,message};}
export class ActivityPersistenceError extends Error {
 readonly code='persistence_failure';
 constructor(error?:unknown){
  const quotaMessage='Not enough browser storage · free space and try again';
  const quota=error instanceof DOMException&&error.name==='QuotaExceededError'||error instanceof ActivityPersistenceError&&error.message===quotaMessage;
  super(quota?quotaMessage:'Activity record unavailable');this.name='ActivityPersistenceError';
 }
}
async function persistActivity(persist:(activity:Activity)=>Promise<void>,activity:Activity){try{await persist(structuredClone(activity));}catch(error){throw new ActivityPersistenceError(error);}}
export function finishActivity(a:Activity,result:{output?:unknown;error?:unknown}):Activity{validateActivity([a]);if(a.status!=='running')throw Error('Activity already finished');let next:Activity;if('error' in result){const error=failure(result.error);next={...a,finishedAt:new Date().toISOString(),status:error.code==='stopped'?'stopped':'failed',error,...(result.output!==undefined?{output:payload(result.output)}:{})};}else next={...a,finishedAt:new Date().toISOString(),status:'succeeded',output:payload(result.output??null)};validateActivity([next]);return structuredClone(next);}
export async function recordOperation<T>(tool:ActivityTool,input:unknown,work:()=>Promise<T>,persist:(activity:Activity)=>Promise<void>,project:(result:T)=>unknown=result=>result??null,failureOf:(result:T)=>unknown=()=>undefined,failureProject:(error:unknown)=>unknown=()=>undefined,onStarted?:(tool:ActivityTool)=>void):Promise<T>{
 const started=startActivity(tool,input);await persistActivity(persist,started);try{onStarted?.(tool);}catch{/* Live status must not change execution. */}let result:T;
 try{result=await work();}catch(error){try{
  // Invalid model output can echo prompts, source text or private note content.
  // Keep the raw value only on the transient error used by in-turn repair;
  // durable Activity receipts retain content-free metadata only.
  const diagnostic=['dialogue.plan','dialogue.subject'].includes(tool)&&error instanceof PlannerOutputError?{reason:error.diagnostic.reason,rawBytes:new TextEncoder().encode(error.diagnostic.raw).byteLength,truncated:error.diagnostic.truncated,...queryFailureShape(error)}:undefined;
  const projected=failureProject(error);
  const output=diagnostic&&projected&&typeof projected==='object'&&!Array.isArray(projected)?{...diagnostic,...projected}:projected??diagnostic;
  await persistActivity(persist,finishActivity(started,{error,...(output!==undefined?{output}:{})}));
 }catch(persistenceError){throw new ActivityPersistenceError(persistenceError);}throw error;}
 let output:unknown,reported:unknown;
 try{output=project(result);reported=failureOf(result);}catch(error){try{await persistActivity(persist,finishActivity(started,{error}));}catch(persistenceError){throw new ActivityPersistenceError(persistenceError);}throw error;}
 // A final persistence failure must not run the tool again or invent a tool failure.
 try{await persistActivity(persist,finishActivity(started,{output,...(reported!==undefined?{error:reported}:{})}));}catch(error){throw new ActivityPersistenceError(error);}return result;
}
export function createTurnActivityTracer(ports:{check:()=>void;readActivities:()=>Activity[]|undefined;persistActivities:(activities:Activity[])=>Promise<void>;persistActivity?:(activity:Activity)=>Promise<void>;onFailureRecorded:()=>void;onStepStarted?:(tool:ActivityTool)=>void;onStepCompleted?:()=>void;diagnosticsEnabled:boolean;writeDiagnostic:(event:{tool:ActivityTool;status:'failed'|'stopped';code:string;message:string})=>void}){
 // Turn receipts are durable, user-visible diagnostics. Keep useful shape and
 // measurements, but never persist arbitrary prompt, query, source or answer
 // strings passed through operation inputs and results.
 const safeStringKeys=new Set(['kind','model','engine','backend','revision','runtime','package','entry','action','target','mode','stage','status','reason','execution','binding','choice','precision','quantization','sourceType','format','scope','completion','budgetReason','noteId']);
 const safeValue=(value:unknown,key=''):Json=>{
  if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value as Json;
  if(typeof value==='string'){
   if(safeStringKeys.has(key)&&value.length<=160&&/^[\p{L}\p{N} ._:/-]*$/u.test(value))return value;
   return {textBytes:new TextEncoder().encode(value).byteLength};
  }
  if(Array.isArray(value))return value.map(item=>safeValue(item));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([child,item])=>[child,safeValue(item,child)]));
  return null;
 };
 const safeFailureMessage=(code:string)=>({stopped:'Stopped',source_changed:'Source changed',context_limit:'Context limit reached',generation_budget_exhausted:'Generation budget exhausted',result_too_large:'Result too large',not_prepared:'Not prepared',invalid_model_output:'Invalid model output',not_found:'Not found',operation_failed:'Operation failed',planner_protocol:'Planner response invalid',agent_protocol:'Agent response invalid',invalid_tool_input:'Tool input invalid',tool_execution:'Tool failed',model_runtime:'Model runtime failed',persistence_failure:'Activity record unavailable'} as Record<string,string>)[code]??'Operation failed';
 const safeActivity=(activity:Activity):Activity=>{
  const input=safeValue(activity.input) as Json,rawOutput=activity.output;
  // Keep only calculator expressions accepted by its closed arithmetic parser.
  // The offline calculation receipt UI and verified follow-up both read this
  // exact field; arbitrary text still becomes a byte-count summary.
  if(activity.tool==='math.calculate'&&activity.input&&typeof activity.input==='object'&&!Array.isArray(activity.input)){
   const expression=(activity.input as Record<string,unknown>).expression;
   if(typeof expression==='string'&&expression.length<=200)try{if(makeDecimalReceipt(expression).expression===expression)(input as Record<string,Json>).expression=expression;}catch{/* Unrecognized expression content remains omitted. */}
  }
  // Calculation continuation binds to this exact, validated local receipt.
  // Preserve its numeric expression contract; all other free text is reduced
  // to byte counts for diagnostics.
  let output=rawOutput===undefined?undefined:safeValue(rawOutput) as Json;
  if(activity.tool==='math.calculate'&&activity.status==='succeeded'&&Array.isArray(rawOutput)){
   try{output=rawOutput.map(item=>validateDecimalReceipt(item) as unknown as Json);}catch{/* Invalid receipts are never privileged. */}
  }
  return {...activity,input,...(output!==undefined?{output}:{}),...(activity.error?{error:{code:activity.error.code,message:safeFailureMessage(activity.error.code)}}:{})};
 };
 return function trace<T>(tool:ActivityTool,input:unknown,work:()=>Promise<T>,project:(result:T)=>unknown=result=>result??null,failureOf:(result:T)=>unknown=()=>undefined,failureProject:(error:unknown)=>unknown=()=>undefined){
  return recordOperation(tool,input,async()=>{ports.check();const result=await work();ports.check();return result;},async activity=>{
   const persisted=safeActivity(activity);
   if(ports.persistActivity)await ports.persistActivity(persisted);
   else{const previous=ports.readActivities();if(!previous)throw Error('Input unavailable');await ports.persistActivities(updateActivity(previous,persisted));}
   if(activity.status==='succeeded')try{ports.onStepCompleted?.();}catch{/* Progress display cannot change a committed activity result. */}
   if(activity.status==='failed'||activity.status==='stopped'){
    ports.onFailureRecorded();if(ports.diagnosticsEnabled)try{ports.writeDiagnostic({tool:activity.tool,status:activity.status,code:persisted.error?.code??activity.status,message:persisted.error?.message??activity.status});}catch{/* Diagnostics must never change the operation result. */}
   }
  },project,failureOf,failureProject,ports.onStepStarted);
 };
}
/** Preserve old inline receipts and append overflow in separately persisted pages. */
export async function persistTurnActivity(ports:{turnId:string;readActivities:()=>Activity[]|undefined;readStored:()=>import('./conversation.ts').Dialogue|undefined;persistInline:(activities:Activity[])=>Promise<void>;persistPaged:(turnId:string,activity:Activity,expected:import('./conversation.ts').Dialogue)=>Promise<void>},activity:Activity){
 const inline=ports.readActivities();if(!inline)throw Error('Input unavailable');
 if(inline.some(item=>item.id===activity.id)||inline.length<MAX_ACTIVITY_EVENTS_PER_TURN){await ports.persistInline(updateActivity(inline,activity));return false;}
 const expected=ports.readStored();if(!expected)throw Error('Input unavailable');await ports.persistPaged(ports.turnId,activity,expected);return true;
}
export function activityLabel(tool:ActivityTool){return builtinTools.find(entry=>entry.tool.definition.id===tool)?.activityLabel??(lifecycleActivityLabels as Record<string,string>)[tool]??tool;}
export function updateActivity(list:Activity[],next:Activity):Activity[]{
 validateActivity(list);validateActivity([next]);const old=list.find(a=>a.id===next.id);
 if(!old){if(next.status!=='running')throw Error('Activity start unavailable');const added=[...list,structuredClone(next)];validateActivity(added);return added;}
 if(old.status!=='running')throw Error('Activity already finished');if(next.status==='running'||old.tool!==next.tool||old.startedAt!==next.startedAt||JSON.stringify(old.input)!==JSON.stringify(next.input))throw Error('Activity identity changed');return list.map(a=>a.id===next.id?structuredClone(next):a);
}
export function activityStatus(a:Activity,active=false){return a.status==='running'?(active?'Running':'Incomplete'):a.status==='succeeded'?'Done':a.status==='stopped'?'Stopped':'Failed';}
