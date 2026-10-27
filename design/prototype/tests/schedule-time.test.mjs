import test from 'node:test';import assert from 'node:assert/strict';
import {nextLocalOccurrence,nextDefaultScheduleDate} from '../src/schedule-time.ts';
test('new one-time schedule defaults to the next local 09:00',()=>{
 assert.equal(nextDefaultScheduleDate(new Date(2026,9,27,8,59)),'2026-10-27');
 assert.equal(nextDefaultScheduleDate(new Date(2026,9,27,9,0)),'2026-10-28');
 assert.equal(nextDefaultScheduleDate(new Date(2026,11,31,23,59)),'2027-01-01');
});
test('weekly selection uses the chosen weekday and rolls to next week after its time',()=>{
 const now=new Date(2026,9,19,10,0),next=nextLocalOccurrence('weekly','09:00',1,now);
 assert.equal(next.getDate(),26);assert.equal(next.getDay(),1);assert.equal(next.getHours(),9);
 assert.equal(nextLocalOccurrence('daily','11:00',1,now).getDate(),19);
 assert.equal(nextLocalOccurrence('daily','09:00',1,now).getDate(),20);
 assert.throws(()=>nextLocalOccurrence('weekly','25:00',1,now));
});

import {nextScheduleOccurrence,scheduleSummary} from '../src/schedule-time.ts';
const rule={repeat:'once',time:'09:00',date:'2026-10-20',days:[1,3],monthDay:31,interval:2,unit:'days'};
test('once rejects past and invalid calendar dates',()=>{
 const now=new Date(2026,9,19,12);
 assert.equal(nextScheduleOccurrence(rule,now).getDate(),20);
 assert.throws(()=>nextScheduleOccurrence({...rule,date:'2026-10-19'},now),/future/);
 assert.throws(()=>nextScheduleOccurrence({...rule,date:'2026-02-30'},now),/Invalid date/);
});
test('weekly finds the next selected weekday and requires a selection',()=>{
 const now=new Date(2026,9,19,12);
 assert.equal(nextScheduleOccurrence({...rule,repeat:'weekly'},now).getDay(),3);
 assert.throws(()=>nextScheduleOccurrence({...rule,repeat:'weekly',days:[]},now),/weekday/);
});
test('monthly skips missing month days, including leap year February',()=>{
 const next=nextScheduleOccurrence({...rule,repeat:'monthly'},new Date(2026,0,31,12));
 assert.equal(next.getMonth(),2);assert.equal(next.getDate(),31);
 assert.equal(nextScheduleOccurrence({...rule,repeat:'monthly',monthDay:29},new Date(2028,1,1)).getMonth(),1);
});
test('custom interval remains anchored to start date when edited after missed occurrences',()=>{
 const custom={...rule,repeat:'custom',date:'2026-10-01',interval:2,unit:'weeks'};
 assert.equal(nextScheduleOccurrence(custom,new Date(2026,9,17)).getDate(),29);
 assert.match(scheduleSummary(custom),/2 weeks/);
 assert.throws(()=>nextScheduleOccurrence({...custom,interval:0}),/interval/);
});

test('custom recurrence returns to the requested wall time after a daylight-saving gap',async()=>{
 const {spawnSync}=await import('node:child_process');
 const script=`import {nextScheduleOccurrence} from './design/prototype/src/schedule-time.ts';
 const base={repeat:'custom',time:'02:30',date:'2026-03-08',days:[],monthDay:1,interval:1,unit:'days'};
 const values=[nextScheduleOccurrence(base,new Date('2026-03-08T04:00:00-04:00')),nextScheduleOccurrence({...base,date:'2026-03-07'},new Date('2026-03-08T04:00:00-04:00'))];
 console.log(JSON.stringify(values.map(d=>[d.getFullYear(),d.getMonth()+1,d.getDate(),d.getHours(),d.getMinutes()])));`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),env:{...process.env,TZ:'America/New_York'},encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);assert.deepEqual(JSON.parse(child.stdout),[[2026,3,9,2,30],[2026,3,9,2,30]]);
});
