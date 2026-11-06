import test from 'node:test';
import assert from 'node:assert/strict';
import {calculationExecutionSource,calculationCitationAnswer} from '../src/execution-source.ts';
import {makeDecimalReceipt} from '../src/tools/math.calculate/decimal-receipt.ts';

test('calculation source points to the exact current execution answer',()=>{
 const run={id:'run',version:2,taskId:'task',taskRevision:1,status:'succeeded',prompt:'Calculate 12 + 10',answer:'12 + 10 = 22',sources:[],calculation:makeDecimalReceipt('12 + 10')};
 const note={id:run.id,version:run.version,recordType:'execution',body:'# Execution\n\n```json\n'+JSON.stringify(run,null,2)+'\n```\n'};
 const ref=calculationExecutionSource(note,run);assert.equal(note.body.slice(ref.start,ref.end),ref.quote);assert.match(ref.quote,/12 \+ 10 = 22/);
 const record={id:'run',ui:{recordType:'execution'}},revision={version:2,body:note.body};assert.equal(calculationCitationAnswer(record,revision,ref),'12 + 10 = 22');assert.equal(calculationCitationAnswer(record,revision,{...ref,start:ref.start+1}),undefined);
 assert.equal(calculationExecutionSource({...note,version:3},run),null);assert.equal(calculationExecutionSource({...note,body:note.body.replace('12 + 10 = 22','12 + 10 = 23')},run),null);
});
