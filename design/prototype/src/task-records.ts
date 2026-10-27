// Typed application records stored as ordinary versioned Markdown notes.
// @ts-expect-error Shared baseline core is JavaScript.
import {createNote,reviseNote,latest,validateRefs,validateGroundingRefs,checkNotes} from '../../../dist/core.js';
import {nextScheduleOccurrence,localDate,type ScheduleRule} from './schedule-time.ts';

export type Task=ScheduleRule&{timezone:string;enabled:boolean;notify:boolean;prompt:string};
export type RunStatus='running'|'succeeded'|'failed'|'stopped'|'missed'|'interrupted'|'skipped';
export type RunData={taskId:string;taskRevision:number;definition:string;dueAt:string;attempt:number;owner:string;leaseUntil:string;status:RunStatus;startedAt:string;finishedAt?:string;prompt:string;answer?:string;error?:string;sources?:any[];model?:{id:string;revision?:string;runtime:string}};
export type NoticeData={taskId:string;taskRevision:number;runId:string;runRevision?:number;attempt?:number;title:string;body:string;createdAt:string;read:boolean};
const fields=['repeat','time','days','date','monthDay','interval','unit','timezone','enabled','notify','prompt'];
const asDate=(value:string)=>{const date=new Date(value);if(!Number.isFinite(+date))throw Error('Invalid date');return date;};
function exactKeys(value:any,keys:string[]){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==[...keys].sort().join('|'))throw Error('Unknown or missing task fields');}
export function validateTask(value:Task):Task{
 exactKeys(value,fields);
 if(typeof value.prompt!=='string'||!value.prompt.trim()||value.prompt.length>30000||typeof value.enabled!=='boolean'||typeof value.notify!=='boolean'||typeof value.timezone!=='string')throw Error('Invalid task');
 if(typeof value.repeat!=='string'||typeof value.time!=='string'||typeof value.date!=='string'||!Number.isInteger(value.monthDay)||value.monthDay<1||value.monthDay>31||!Number.isInteger(value.interval)||value.interval<1||value.interval>365||!['days','weeks'].includes(value.unit))throw Error('Invalid task fields');
 try{new Intl.DateTimeFormat('en',{timeZone:value.timezone});}catch{throw Error('Invalid timezone');}
 if(!Array.isArray(value.days)||value.days.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(value.days).size!==value.days.length)throw Error('Invalid weekdays');
 // Validate even past one-off definitions without silently moving the date.
 const reference=value.repeat==='once'?new Date(value.date+'T00:00:00'):new Date(2026,0,1);
 if(value.repeat==='once')reference.setDate(reference.getDate()-1);
 nextScheduleOccurrence(value,reference);return value;
}
export function formatTask(task:Task){validateTask(task);const {prompt,...metadata}=task;return '# Scheduled prompt\n\n```json\n'+JSON.stringify(metadata,null,2)+'\n```\n\n## Prompt\n'+prompt;}
export function parseTask(body:string):Task{
 const match=body.match(/^# Scheduled prompt\n\n```json\n([\s\S]*?)\n```\n\n## Prompt\n([\s\S]*)$/);
 if(!match)throw Error('Invalid scheduled prompt format');return validateTask({...JSON.parse(match[1]),prompt:match[2]});
}
export function taskDefinition(task:Task){return JSON.stringify(Object.fromEntries(fields.filter(k=>!['enabled','notify'].includes(k)).sort().map(k=>[k,task[k as keyof Task]])));}
export function taskNextAt(task:Task,now=new Date()):Date{
 if(task.repeat==='once')return nextScheduleOccurrence(task,new Date(new Date(task.date+'T00:00:00').getTime()-86400000));
 return nextScheduleOccurrence(task,now);
}
export function createTaskNote(records:any[],task:Task,id:string=crypto.randomUUID(),now=new Date()){
 if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw Error('Invalid schedule identity');
 if(records.some(n=>n.id===id))throw Error('Schedule already saved · reopen it');
 const note={...createNote({path:'Schedule/'+localDate(now)+'-'+id+'.md',title:task.prompt.trim().split('\n')[0].slice(0,72),body:formatTask(task)}),id,ui:{recordType:'schedule'}};checkNotes([...records,note]);return note;
}
export function reviseTaskNote(old:any,task:Task,now=new Date()){
 if(!old||old.state!=='active'||old.ui?.recordType!=='schedule'||old.ui?.protected||old.ui?.managed)throw Error('Schedule target protected or unavailable');
 const note=reviseNote(old,{body:formatTask(task)},latest(old).version);
 if(note.ui.requiresReview)delete note.taskCursor;note.ui={...note.ui,requiresReview:false};
 const definition=taskDefinition(task);if(!note.taskCursor||note.taskCursor.definition!==definition)note.taskCursor={definition,nextAt:taskNextAt(task,now).toISOString()};
 return note;
}
function typedRecord(type:string,path:string,body:string){return {...createNote({path,title:path.split('/').at(-1),body}),ui:{recordType:type}};}
function runBody(value:RunData){return '# Execution\n\n```json\n'+JSON.stringify(value,null,2)+'\n```\n';}
export function taskRunView(note:any):RunData{
 if(note.ui?.recordType!=='execution')throw Error('Not an execution record');const m=latest(note).body.match(/^# Execution\n\n```json\n([\s\S]*)\n```\n$/);if(!m)throw Error('Invalid execution');return JSON.parse(m[1]);
}
export function skipTaskRun(records:any[],taskId:string,owner:string,now=new Date()){
 const task=records.find(n=>n.id===taskId&&n.state==='active');if(!task||task.ui?.recordType!=='schedule'||task.ui.requiresReview)throw Error('Review schedule first');
 const definition=parseTask(latest(task).body),cursor=task.taskCursor;if(definition.timezone!==Intl.DateTimeFormat().resolvedOptions().timeZone)throw Error('Timezone changed · review schedule');if(!cursor?.nextAt||cursor.definition!==taskDefinition(definition))throw Error('No pending occurrence');
 const old=records.find(n=>n.ui?.recordType==='execution'&&(()=>{const data=taskRunView(n);return data.taskId===task.id&&data.definition===cursor.definition&&data.dueAt===cursor.nextAt;})());
 if(old&&taskRunView(old).status==='running')throw Error('Stop execution before skipping');
 if(old&&old.state!=='active')throw Error('Execution is in Trash · restore it first');
 const data:RunData=old?{...taskRunView(old),status:'skipped',finishedAt:now.toISOString(),error:'Skipped by user'}:{taskId,taskRevision:latest(task).version,definition:cursor.definition,dueAt:cursor.nextAt,attempt:0,owner,leaseUntil:now.toISOString(),status:'skipped',startedAt:now.toISOString(),finishedAt:now.toISOString(),prompt:definition.prompt,error:'Skipped by user'};
 const run=old?reviseNote(old,{body:runBody(data)},latest(old).version):typedRecord('execution','Schedule/Runs/'+localDate(now)+'-'+crypto.randomUUID()+'.md',runBody(data));
 const nextAt=definition.repeat==='once'?null:nextScheduleOccurrence(definition,new Date(Math.max(+now,+asDate(cursor.nextAt)))).toISOString();
 return {task:{...task,taskCursor:{...cursor,nextAt}},run};
}
export function noticeBody(value:NoticeData){return '# Notification\n\n```json\n'+JSON.stringify(value,null,2)+'\n```\n';}
export function noticeView(note:any):NoticeData{
 if(note.ui?.recordType!=='notification')throw Error('Not a notification');const m=latest(note).body.match(/^# Notification\n\n```json\n([\s\S]*)\n```\n$/);if(!m)throw Error('Invalid notification');return JSON.parse(m[1]);
}
export function taskNotice(task:any,run:any){const data=taskRunView(run),original=task.revisions?.find((r:any)=>r.version===data.taskRevision);if(task.id!==data.taskId||!original)throw Error('Notification task revision unavailable');const definition=parseTask(original.body);if(!definition.notify||!parseTask(latest(task).body).notify)return null;
 const title=data.status[0].toUpperCase()+data.status.slice(1)+' · '+definition.prompt.trim().split('\n')[0].slice(0,64);
 const value:NoticeData={taskId:task.id,taskRevision:data.taskRevision,runId:run.id,runRevision:latest(run).version,attempt:data.attempt,title,body:data.answer??data.error??'Execution needs attention',createdAt:new Date().toISOString(),read:false};
 return typedRecord('notification','Notifications/'+localDate()+'-'+crypto.randomUUID()+'.md',noticeBody(value));
}
export function claimTaskRun(records:any[],taskId:string,owner:string,now=new Date(),options:{retry?:boolean;manual?:boolean}={}){
 const task=records.find(n=>n.id===taskId&&n.state==='active');if(!task||task.ui?.recordType!=='schedule')throw Error('Task is not registered');if(task.ui.requiresReview)throw Error('Review schedule first');
 const definition=parseTask(latest(task).body);if(!definition.enabled&&!options.manual)throw Error('Task is disabled');
 if(definition.timezone!==Intl.DateTimeFormat().resolvedOptions().timeZone)throw Error('Timezone changed · review schedule');
 const signature=taskDefinition(definition),cursor=task.taskCursor;if(!cursor||cursor.definition!==signature||!cursor.nextAt)throw Error('Task has no pending occurrence');
 const due=asDate(cursor.nextAt);if(due>now&&!options.manual)throw Error('Task is not due');
 const old=records.find(n=>n.ui?.recordType==='execution'&&(()=>{const r=taskRunView(n);return r.taskId===taskId&&r.definition===signature&&r.dueAt===cursor.nextAt;})());
 if(old){
  if(old.state!=='active')throw Error('Execution is in Trash · restore it first');
  const data=taskRunView(old);
  if(data.status==='running'){
   const until=old.runLease?.owner===data.owner?old.runLease.until:data.leaseUntil;
   if(asDate(until)>now)throw Error('Occurrence already running');
   const interrupted={...data,status:'interrupted' as const,error:'Execution interrupted · retry explicitly',finishedAt:now.toISOString()};
   return {task,run:reviseNote(old,{body:runBody(interrupted)},latest(old).version),execute:false};
  }
  if(!options.retry||!['failed','stopped','missed','interrupted'].includes(data.status))throw Error('Occurrence already processed');
  const retried:RunData={...data,taskRevision:latest(task).version,owner,status:'running',attempt:data.attempt+1,startedAt:now.toISOString(),leaseUntil:new Date(+now+90000).toISOString()};
  delete retried.finishedAt;delete retried.answer;delete retried.error;delete retried.sources;delete retried.model;
  const run=reviseNote(old,{body:runBody(retried)},latest(old).version);delete run.runLease;
  return {task,run,execute:true};
 }
 const missed=!options.manual&&+now-+due>60000;
 const data:RunData={taskId,taskRevision:latest(task).version,definition:signature,dueAt:cursor.nextAt,attempt:missed?0:1,owner,leaseUntil:new Date(+now+90000).toISOString(),status:missed?'missed':'running',startedAt:now.toISOString(),prompt:definition.prompt,...(missed?{error:'Missed while app was unavailable · run or skip explicitly',finishedAt:now.toISOString()}:{})};
 return {task,run:typedRecord('execution','Schedule/Runs/'+localDate(now)+'-'+crypto.randomUUID()+'.md',runBody(data)),execute:!missed};
}
export function heartbeatRun(records:any[],runId:string,owner:string,now=new Date()){
 const old=records.find(n=>n.id===runId&&n.state==='active');if(!old)throw Error('Execution unavailable');const data=taskRunView(old),until=old.runLease?.owner===owner?old.runLease.until:data.leaseUntil;if(data.owner!==owner||data.status!=='running'||asDate(until)<now)throw Error('Execution owner expired');
 // The lease is transport metadata, not a content revision or a source change.
 return {...old,runLease:{owner,until:new Date(+now+90000).toISOString()}};
}
export function finishTaskRun(records:any[],runId:string,owner:string,result:{status:RunStatus;answer?:string;error?:string;sources?:any[];model?:RunData['model']},now=new Date()){
 const old=records.find(n=>n.id===runId&&n.state==='active');if(!old)throw Error('Execution unavailable');const data=taskRunView(old);
 if(data.owner!==owner||data.status!=='running')throw Error('Execution owner conflict');
 const lease=old.runLease?.owner===owner?old.runLease.until:data.leaseUntil;if(asDate(lease)<now)throw Error('Execution owner expired');
 if(!['succeeded','failed','stopped','skipped'].includes(result.status))throw Error('Invalid completion');
 if(result.status==='succeeded'&&(!result.answer?.trim()||!result.sources?.length||!validateGroundingRefs(records,result.sources).ok))throw Error('Source changed or missing result');
 const task=records.find(n=>n.id===data.taskId);if(!task)throw Error('Task unavailable');
 const completed={...data,...result,finishedAt:now.toISOString()};const run=reviseNote(old,{body:runBody(completed)},latest(old).version);delete run.runLease;
 const definition=parseTask(latest(task).body);let updated=task;
 if(['succeeded','skipped'].includes(result.status)&&task.taskCursor?.definition===data.definition&&task.taskCursor.nextAt===data.dueAt){
  if(definition.repeat!=='once'&&definition.timezone!==Intl.DateTimeFormat().resolvedOptions().timeZone){
   // Retain the completed run and its occurrence until the user reviews the
   // schedule; do not calculate the next occurrence in a different zone.
   updated={...task,ui:{...task.ui,requiresReview:true}};
  }else{
   const after=new Date(Math.max(+now,+asDate(data.dueAt))),nextAt=definition.repeat==='once'?null:nextScheduleOccurrence(definition,after).toISOString();
   updated={...task,taskCursor:{...task.taskCursor,nextAt}};
  }
 }
 return {task:updated,run};
}

export function validateNoticeLinks(records:any[],note:any){
 const notice=noticeView(note),task=records.find(n=>n.id===notice.taskId),run=records.find(n=>n.id===notice.runId);
 if(!task||!run||typeof notice.read!=='boolean'||typeof notice.createdAt!=='string')throw Error('Invalid notification target');
 if(notice.runRevision===undefined&&notice.attempt===undefined)return;
 if(!Number.isInteger(notice.runRevision)||notice.runRevision!<1||!Number.isInteger(notice.attempt)||notice.attempt!<0)throw Error('Invalid notification revision');
 const revision=run.revisions?.find((r:any)=>r.version===notice.runRevision);if(!revision)throw Error('Notification result revision unavailable');
 const data=taskRunView({...run,revisions:[revision]}),source=task.revisions?.find((r:any)=>r.version===notice.taskRevision);
 if(!source||data.status==='running'||data.taskId!==task.id||data.taskRevision!==notice.taskRevision||data.attempt!==notice.attempt||notice.body!==(data.answer??data.error??'Execution needs attention'))throw Error('Invalid notification result link');
 const definition=parseTask(source.body),title=data.status[0].toUpperCase()+data.status.slice(1)+' · '+definition.prompt.trim().split('\n')[0].slice(0,64);
 if(notice.title!==title||data.prompt!==definition.prompt||data.definition!==taskDefinition(definition))throw Error('Invalid notification task link');
}
