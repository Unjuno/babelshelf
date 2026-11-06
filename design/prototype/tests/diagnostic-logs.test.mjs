import test from 'node:test';
import assert from 'node:assert/strict';
import {appendDiagnosticLog,clearDiagnosticLogs,readDiagnosticLogs,validateDiagnosticLogs} from '../src/diagnostic-logs.ts';
function storage(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
test('diagnostic log retains bounded technical failure metadata without prompt or file content',()=>{
 const db=storage(),entry=appendDiagnosticLog(db,{tool:'model.load',status:'failed',code:'operation_failed',message:'Could not open C:\\Users\\Jun\\private.txt https://example.test/path'},'id','2026-01-01T00:00:00.000Z');
 assert.deepEqual(readDiagnosticLogs(db),[entry]);assert.doesNotMatch(JSON.stringify(entry),/Users|private\.txt|example\.test/);assert.equal(entry.message,'The local operation failed.');
});
test('diagnostic logs discard an exception that embeds a private note excerpt',()=>{
 const db=storage(),entry=appendDiagnosticLog(db,{tool:'dialogue.plan',status:'failed',code:'operation_failed',message:'Planner could not process PRIVATE_NOTE_SENTINEL: my access code is 7319'},'private','2026-01-01T00:00:00.000Z');
 assert.equal(entry.message,'The local operation failed.');assert.doesNotMatch(JSON.stringify(readDiagnosticLogs(db)),/PRIVATE_NOTE_SENTINEL|access code|7319/);
});
test('legacy diagnostic records are redacted before they can be shown or handed to a model',()=>{
 const db=storage();db.setItem('babelshelf.diagnostic-logs.v1',JSON.stringify([{schema:1,id:'old',at:'2026-01-01T00:00:00.000Z',tool:'dialogue.plan',status:'failed',code:'operation_failed',message:'PRIVATE_NOTE_SENTINEL old exception content'}]));
 const logs=readDiagnosticLogs(db);assert.equal(logs[0].message,'The local operation failed.');assert.doesNotMatch(JSON.stringify(logs),/PRIVATE_NOTE_SENTINEL|old exception content/);assert.doesNotMatch(db.getItem('babelshelf.diagnostic-logs.v1'),/PRIVATE_NOTE_SENTINEL|old exception content/);
});
test('diagnostic logs cap at 100 entries and clear locally',()=>{
 const db=storage();for(let i=0;i<104;i++)appendDiagnosticLog(db,{tool:'speech.transcribe',status:'failed',code:'operation_failed',message:'failed'},'id-'+i,'2026-01-01T00:00:00.000Z');
 assert.equal(readDiagnosticLogs(db).length,100);assert.equal(readDiagnosticLogs(db)[0].id,'id-4');clearDiagnosticLogs(db);assert.deepEqual(readDiagnosticLogs(db),[]);
});
test('diagnostic log reader rejects malformed records',()=>assert.throws(()=>validateDiagnosticLogs([{schema:1,id:'x',at:'y',tool:'t',status:'success',code:'x',message:'x'}]),/Invalid/));
