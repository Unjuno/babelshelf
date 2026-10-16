import test from 'node:test';import assert from 'node:assert/strict';
import {nextLocalOccurrence} from '../src/schedule-time.ts';
test('weekly selection uses the chosen weekday and rolls to next week after its time',()=>{
 const now=new Date(2026,9,19,10,0),next=nextLocalOccurrence('weekly','09:00',1,now);
 assert.equal(next.getDate(),26);assert.equal(next.getDay(),1);assert.equal(next.getHours(),9);
 assert.equal(nextLocalOccurrence('daily','11:00',1,now).getDate(),19);
 assert.equal(nextLocalOccurrence('daily','09:00',1,now).getDate(),20);
 assert.throws(()=>nextLocalOccurrence('weekly','25:00',1,now));
});
