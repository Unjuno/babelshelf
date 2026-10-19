import test from 'node:test';
import assert from 'node:assert/strict';
import {appendDiagnosticLog,clearDiagnosticLogs,readDiagnosticLogs,validateDiagnosticLogs} from '../src/diagnostic-logs.ts';
function storage(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
test('diagnostic log retains bounded technical failure metadata without prompt or file content',()=>{
 const db=storage(),entry=appendDiagnosticLog(db,{tool:'model.load',status:'failed',code:'operation_failed',message:'Could not open C:\\Users\\Jun\\private.txt https://example.test/path'},'id','2026-01-01T00:00:00.000Z');
 assert.deepEqual(readDiagnosticLogs(db),[entry]);assert.doesNotMatch(JSON.stringify(entry),/Users|private\.txt|example\.test/);assert.equal(entry.message,'Could not open [path] [url]');
});
test('diagnostic logs cap at 100 entries and clear locally',()=>{
 const db=storage();for(let i=0;i<104;i++)appendDiagnosticLog(db,{tool:'speech.transcribe',status:'failed',code:'operation_failed',message:'failed'},'id-'+i,'2026-01-01T00:00:00.000Z');
 assert.equal(readDiagnosticLogs(db).length,100);assert.equal(readDiagnosticLogs(db)[0].id,'id-4');clearDiagnosticLogs(db);assert.deepEqual(readDiagnosticLogs(db),[]);
});
test('diagnostic log reader rejects malformed records',()=>assert.throws(()=>validateDiagnosticLogs([{schema:1,id:'x',at:'y',tool:'t',status:'success',code:'x',message:'x'}]),/Invalid/));
