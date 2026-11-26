import test from 'node:test';import assert from 'node:assert/strict';
import {currentScheduleExecution,scheduleStatus,scheduleRunAction} from '../src/task-status.ts';
import {taskDefinition} from '../src/task-records.ts';
const task={id:'task',repeat:'once',time:'09:00',date:'2099-01-01',days:[],monthDay:1,interval:1,unit:'days',timezone:'Asia/Tokyo',enabled:false,notify:true,prompt:'Read local data',nextAt:'2099-01-01T00:00:00.000Z'};
const run=(status,startedAt='2099-01-01T00:00:00.000Z')=>({taskId:task.id,definition:taskDefinition(task),dueAt:task.nextAt,status,startedAt});
test('retained running occurrence stays visible after local owner disappears and offers a check, not a fresh run',()=>{
 assert.equal(scheduleStatus(task,[run('running')],null,'Asia/Tokyo'),'Running · check execution');
 assert.equal(scheduleStatus(task,[run('running')],task.id,'Asia/Tokyo'),'Running');
 assert.equal(scheduleRunAction(run('running')),'Check execution');
 for(const status of ['failed','missed','stopped','interrupted']){assert.equal(scheduleStatus(task,[run(status)],null,'Asia/Tokyo'),status[0].toUpperCase()+status.slice(1)+' · Paused');assert.equal(scheduleStatus({...task,enabled:true},[run(status)],null,'Asia/Tokyo'),status[0].toUpperCase()+status.slice(1));assert.equal(scheduleRunAction(run(status)),'Retry');}
});
test('schedule status keeps definition, occurrence, review and timezone boundaries',()=>{
 assert.equal(scheduleStatus(task,[{...run('running'),definition:'old'}],null,'Asia/Tokyo'),'Paused');
 assert.equal(scheduleStatus(task,[{...run('running'),dueAt:'2098-01-01T00:00:00.000Z'}],null,'Asia/Tokyo'),'Paused');
 assert.equal(scheduleStatus({...task,requiresReview:true},[run('running')],task.id,'Asia/Tokyo'),'Review schedule');
 assert.equal(scheduleStatus(task,[run('running')],null,'UTC'),'Timezone changed');
 assert.equal(scheduleStatus({...task,nextAt:null},[run('running')],null,'Asia/Tokyo'),'Completed');
 assert.equal(scheduleStatus(task,[],task.id,'Asia/Tokyo'),'Running');assert.equal(scheduleRunAction(undefined),'Run now');
});
test('a completed one-off reports failed or stopped manual reruns and offers Retry',()=>{
 const manual={...run('stopped'),dueAt:'2099-02-01T00:00:00.000Z',manualRerun:true},completed={...task,nextAt:null};
 assert.equal(currentScheduleExecution(completed,[manual]),manual);
 assert.equal(scheduleStatus(completed,[manual],null,'Asia/Tokyo'),'Stopped · Manual run');
 assert.equal(scheduleRunAction(manual),'Retry');
 assert.equal(scheduleStatus(completed,[{...manual,status:'failed'}],null,'Asia/Tokyo'),'Failed · Manual run');
 assert.equal(scheduleStatus(completed,[{...manual,status:'succeeded'}],null,'Asia/Tokyo'),'Completed');
 assert.equal(currentScheduleExecution(completed,[{...manual,status:'succeeded'}]),undefined,'a completed manual run still allows a separate explicit Run now');
});
test('a completed one-off uses the newest manual attempt even when records are unordered',()=>{
 const completed={...task,nextAt:null},older={...run('failed','2099-01-01T00:00:00.000Z'),dueAt:'2099-02-01T00:00:00.000Z',manualRerun:true},newer={...older,status:'stopped',startedAt:'2099-03-01T00:00:00.000Z'};
 assert.equal(currentScheduleExecution(completed,[newer,older]),newer);
 assert.equal(currentScheduleExecution(completed,[older,newer]),newer);
 assert.equal(scheduleStatus(completed,[older,newer],null,'Asia/Tokyo'),'Stopped · Manual run');
});

test('a running manual rerun owned elsewhere offers a status check without claiming interruption',()=>{
 const manual={...run('running'),dueAt:'2099-02-01T00:00:00.000Z',manualRerun:true},completed={...task,nextAt:null};
 assert.equal(scheduleStatus(completed,[manual],null,'Asia/Tokyo'),'Running · check execution · Manual run');
 assert.equal(scheduleStatus(completed,[manual],task.id,'Asia/Tokyo'),'Running');
 assert.equal(scheduleRunAction(manual),'Check execution');
});
