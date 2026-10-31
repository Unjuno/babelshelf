// Audit data only. A receipt never authorizes execution, replay, writes or network.
import {PlannerOutputError} from './planner-error.ts';
import {builtinTools,builtinToolIds} from './tools/builtin-tools.ts';

// Non-tool lifecycle operations remain explicit. Executable built-ins derive
// their IDs and labels from the same catalog used by the actual registry.
const lifecycleActivityLabels={
 'tools.search':'Find tool','tools.read-skill':'Read tool guide',
 'decision.prepare':'Prepare decision model','decision.load':'Load decision model','decision.unload':'Unload decision model','decision.classify':'Decide',
 'image.read':'Read image','image.describe':'Describe image','ocr.prepare':'Prepare image reader','vision.prepare':'Prepare vision model',
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
const codes=['stopped','source_changed','context_limit','result_too_large','not_prepared','invalid_model_output','not_found','operation_failed','planner_protocol','agent_protocol','invalid_tool_input','tool_execution','model_runtime','persistence_failure'];
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
 constructor(){super('Activity record unavailable');this.name='ActivityPersistenceError';}
}
async function persistActivity(persist:(activity:Activity)=>Promise<void>,activity:Activity){try{await persist(structuredClone(activity));}catch{throw new ActivityPersistenceError();}}
export function finishActivity(a:Activity,result:{output?:unknown;error?:unknown}):Activity{validateActivity([a]);if(a.status!=='running')throw Error('Activity already finished');let next:Activity;if('error' in result){const error=failure(result.error);next={...a,finishedAt:new Date().toISOString(),status:error.code==='stopped'?'stopped':'failed',error,...(result.output!==undefined?{output:payload(result.output)}:{})};}else next={...a,finishedAt:new Date().toISOString(),status:'succeeded',output:payload(result.output??null)};validateActivity([next]);return structuredClone(next);}
export async function recordOperation<T>(tool:ActivityTool,input:unknown,work:()=>Promise<T>,persist:(activity:Activity)=>Promise<void>,project:(result:T)=>unknown=result=>result??null,failureOf:(result:T)=>unknown=()=>undefined,failureProject:(error:unknown)=>unknown=()=>undefined):Promise<T>{
 const started=startActivity(tool,input);await persistActivity(persist,started);let result:T;
 try{result=await work();}catch(error){try{
  const diagnostic=['dialogue.plan','dialogue.subject'].includes(tool)&&error instanceof PlannerOutputError?error.diagnostic:undefined;
  const projected=failureProject(error);
  const output=diagnostic&&projected&&typeof projected==='object'&&!Array.isArray(projected)?{...diagnostic,...projected}:projected??diagnostic;
  await persistActivity(persist,finishActivity(started,{error,...(output!==undefined?{output}:{})}));
 }catch{throw new ActivityPersistenceError();}throw error;}
 let output:unknown,reported:unknown;
 try{output=project(result);reported=failureOf(result);}catch(error){try{await persistActivity(persist,finishActivity(started,{error}));}catch{throw new ActivityPersistenceError();}throw error;}
 // A final persistence failure must not run the tool again or invent a tool failure.
 try{await persistActivity(persist,finishActivity(started,{output,...(reported!==undefined?{error:reported}:{})}));}catch{throw new ActivityPersistenceError();}return result;
}
export function createTurnActivityTracer(ports:{check:()=>void;readActivities:()=>Activity[]|undefined;persistActivities:(activities:Activity[])=>Promise<void>;persistActivity?:(activity:Activity)=>Promise<void>;onFailureRecorded:()=>void;diagnosticsEnabled:boolean;writeDiagnostic:(event:{tool:ActivityTool;status:'failed'|'stopped';code:string;message:string})=>void}){
 return function trace<T>(tool:ActivityTool,input:unknown,work:()=>Promise<T>,project:(result:T)=>unknown=result=>result??null,failureOf:(result:T)=>unknown=()=>undefined,failureProject:(error:unknown)=>unknown=()=>undefined){
  return recordOperation(tool,input,async()=>{ports.check();const result=await work();ports.check();return result;},async activity=>{
   if(ports.persistActivity)await ports.persistActivity(activity);
   else{const previous=ports.readActivities();if(!previous)throw Error('Input unavailable');await ports.persistActivities(updateActivity(previous,activity));}
   if(activity.status==='failed'||activity.status==='stopped'){
    ports.onFailureRecorded();if(ports.diagnosticsEnabled)try{ports.writeDiagnostic({tool:activity.tool,status:activity.status,code:activity.error?.code??activity.status,message:activity.error?.message??activity.status});}catch{/* Diagnostics must never change the operation result. */}
   }
  },project,failureOf,failureProject);
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
