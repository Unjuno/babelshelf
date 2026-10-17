// Audit data only. A receipt never authorizes execution, replay, writes or network.
import {PlannerOutputError} from './planner-error.ts';
export const activityTools=['decision.prepare','decision.load','decision.unload','decision.classify','image.read','ocr.prepare','model.prepare','model.unload','speech.prepare','pdf.read','speech.transcribe','model.load','memory.search','memory.read','dialogue.plan','dialogue.compact','dialogue.read','text.transform','memory.propose_correction','knowledge.answer'] as const;
export type ActivityTool=typeof activityTools[number];
export type Json=null|boolean|number|string|Json[]|{[key:string]:Json};
export type Activity={schema:1;id:string;tool:ActivityTool;input:Json;startedAt:string;status:'running'|'succeeded'|'failed'|'stopped';finishedAt?:string;output?:Json;error?:{code:string;message:string}};
const codes=['stopped','source_changed','context_limit','not_prepared','invalid_model_output','not_found','operation_failed'];
function payload(value:unknown):Json{
 const walk=(v:any,depth:number,seen:Set<any>):void=>{if(depth>20)throw Error('Activity payload depth limit');if(v===null||typeof v==='string'||typeof v==='boolean')return;if(typeof v==='number'&&Number.isFinite(v))return;if(!v||typeof v!=='object'||!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null||seen.has(v))throw Error('Activity payload must be portable JSON');const next=new Set([...seen,v]);for(const item of Object.values(v))walk(item,depth+1,next);};
 walk(value,0,new Set());const raw=JSON.stringify(value);if(new TextEncoder().encode(raw).length>300000)throw Error('Activity payload limit');return JSON.parse(raw);
}
const validTime=(at:unknown)=>typeof at==='string'&&Number.isFinite(Date.parse(at));
export function validateActivity(value:unknown):asserts value is Activity[]{
 if(!Array.isArray(value)||value.length>128)throw Error('Activity list limit');const ids=new Set();
 for(const a of value){if(!a||a.schema!==1||typeof a.id!=='string'||!a.id||a.id.length>100||ids.has(a.id))throw Error('Invalid or duplicate activity');ids.add(a.id);if(!activityTools.includes(a.tool))throw Error('Unknown activity operation');if(!validTime(a.startedAt)||a.finishedAt!==undefined&&!validTime(a.finishedAt))throw Error('Invalid activity time');payload(a.input);
 if(a.status==='running'){if(a.finishedAt!==undefined||a.output!==undefined||a.error!==undefined)throw Error('Invalid running activity result');}
 else if(a.status==='succeeded'){if(!a.finishedAt||a.error!==undefined||a.output===undefined)throw Error('Missing activity output');payload(a.output);}
 else if(a.status==='failed'||a.status==='stopped'){if(!a.finishedAt||!a.error||!codes.includes(a.error.code)||typeof a.error.message!=='string'||!a.error.message||a.error.message.length>2000||a.status==='stopped'&&a.error.code!=='stopped')throw Error('Invalid activity error');if(a.output!==undefined)payload(a.output);}
 else throw Error('Invalid activity status');}
}
export function startActivity(tool:ActivityTool,input:unknown):Activity{const a:Activity={schema:1,id:crypto.randomUUID(),tool,input:payload(input),startedAt:new Date().toISOString(),status:'running'};validateActivity([a]);return a;}
function failure(error:unknown){const message=(error instanceof Error?error.message:String(error)).slice(0,2000)||'Operation failed';const code=message==='Stopped'?'stopped':/Source changed|Version conflict|Conversation changed/i.test(message)?'source_changed':/context limit/i.test(message)?'context_limit':/not prepared|not loaded|not configured/i.test(message)?'not_prepared':/JSON|citation|Invalid (?:model|answer|text operation)/i.test(message)?'invalid_model_output':/not found|unavailable/i.test(message)?'not_found':'operation_failed';return {code,message};}
export function finishActivity(a:Activity,result:{output?:unknown;error?:unknown}):Activity{validateActivity([a]);if(a.status!=='running')throw Error('Activity already finished');let next:Activity;if('error' in result){const error=failure(result.error);next={...a,finishedAt:new Date().toISOString(),status:error.code==='stopped'?'stopped':'failed',error,...(result.output!==undefined?{output:payload(result.output)}:{})};}else next={...a,finishedAt:new Date().toISOString(),status:'succeeded',output:payload(result.output??null)};validateActivity([next]);return structuredClone(next);}
export async function recordOperation<T>(tool:ActivityTool,input:unknown,work:()=>Promise<T>,persist:(activity:Activity)=>Promise<void>,project:(result:T)=>unknown=result=>result??null,failureOf:(result:T)=>unknown=()=>undefined):Promise<T>{
 const started=startActivity(tool,input);await persist(structuredClone(started));let result:T;
 try{result=await work();}catch(error){try{await persist(finishActivity(started,{error,...(tool==='dialogue.plan'&&error instanceof PlannerOutputError?{output:error.diagnostic}:{})}));}catch{throw Error('Operation failed · activity record unavailable');}throw error;}
 // A final record failure must not run the tool again or invent a tool failure.
 try{const reported=failureOf(result);await persist(finishActivity(started,{output:project(result),...(reported!==undefined?{error:reported}:{})}));}catch{throw Error('Operation completed · activity record unavailable');}return result;
}
export function activityLabel(tool:ActivityTool){return {'decision.prepare':'Prepare decision model','decision.load':'Load decision model','decision.unload':'Unload decision model','decision.classify':'Decide','image.read':'Read image','ocr.prepare':'Prepare image reader','model.prepare':'Prepare text model','model.unload':'Unload model','speech.prepare':'Prepare speech model','pdf.read':'Read PDF','speech.transcribe':'Transcribe','model.load':'Load model','memory.search':'Search','memory.read':'Read file','dialogue.plan':'Select action','dialogue.compact':'Context','dialogue.read':'Read earlier message','text.transform':'Text operation','memory.propose_correction':'Review changes','knowledge.answer':'Answer'}[tool];}
export function updateActivity(list:Activity[],next:Activity):Activity[]{
 validateActivity(list);validateActivity([next]);const old=list.find(a=>a.id===next.id);
 if(!old){if(next.status!=='running')throw Error('Activity start unavailable');const added=[...list,structuredClone(next)];validateActivity(added);return added;}
 if(old.status!=='running')throw Error('Activity already finished');if(next.status==='running'||old.tool!==next.tool||old.startedAt!==next.startedAt||JSON.stringify(old.input)!==JSON.stringify(next.input))throw Error('Activity identity changed');return list.map(a=>a.id===next.id?structuredClone(next):a);
}
export function activityStatus(a:Activity,active=false){return a.status==='running'?(active?'Running':'Incomplete'):a.status==='succeeded'?'Done':a.status==='stopped'?'Stopped':'Failed';}
