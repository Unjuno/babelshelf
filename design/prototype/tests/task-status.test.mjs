import test from 'node:test';import assert from 'node:assert/strict';
import {scheduleStatus,scheduleRunAction} from '../src/task-status.ts';
import {taskDefinition} from '../src/task-records.ts';
const task={id:'task',repeat:'once',time:'09:00',date:'2099-01-01',days:[],monthDay:1,interval:1,unit:'days',timezone:'Asia/Tokyo',enabled:false,notify:true,prompt:'Read local data',nextAt:'2099-01-01T00:00:00.000Z'};
const run=status=>({taskId:task.id,definition:taskDefinition(task),dueAt:task.nextAt,status});
test('retained running occurrence stays visible after local owner disappears and offers a check, not a fresh run',()=>{
 assert.equal(scheduleStatus(task,[run('running')],null,'Asia/Tokyo'),'Running');
 assert.equal(scheduleRunAction(run('running')),'Check execution');
 for(const status of ['failed','missed','stopped','interrupted']){assert.equal(scheduleStatus(task,[run(status)],null,'Asia/Tokyo'),status[0].toUpperCase()+status.slice(1));assert.equal(scheduleRunAction(run(status)),'Retry');}
});
test('schedule status keeps definition, occurrence, review and timezone boundaries',()=>{
 assert.equal(scheduleStatus(task,[{...run('running'),definition:'old'}],null,'Asia/Tokyo'),'Paused');
 assert.equal(scheduleStatus(task,[{...run('running'),dueAt:'2098-01-01T00:00:00.000Z'}],null,'Asia/Tokyo'),'Paused');
 assert.equal(scheduleStatus({...task,requiresReview:true},[run('running')],task.id,'Asia/Tokyo'),'Review restored task');
 assert.equal(scheduleStatus(task,[run('running')],null,'UTC'),'Timezone changed');
 assert.equal(scheduleStatus({...task,nextAt:null},[run('running')],null,'Asia/Tokyo'),'Completed');
 assert.equal(scheduleStatus(task,[],task.id,'Asia/Tokyo'),'Running');assert.equal(scheduleRunAction(undefined),'Run now');
});
