import test from 'node:test';import assert from 'node:assert/strict';
import {nextLocalOccurrence} from '../src/schedule-time.ts';
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
