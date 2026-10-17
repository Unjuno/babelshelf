import test from 'node:test';import assert from 'node:assert/strict';
import {startActivity,finishActivity,activityStatus} from '../src/harness-activity.ts';
import {processingKey,processingUpdate,validateProcessing} from '../src/processing-history.ts';
import {makeStateBackup,parseStateBackup,stateHash} from '../src/backup-state.ts';
test('media receipt cannot be completed twice, relabeled or replaced by a different operation/input',()=>{
 const a=startActivity('pdf.read',{source:{name:'test.pdf',bytes:4}}),running=processingUpdate(undefined,a),done=finishActivity(a,{output:{pages:3,reviewRequired:true}});assert.equal(activityStatus(running.activity,false),'Incomplete');assert.equal(processingUpdate(running,done).activity.status,'succeeded');assert.throws(()=>processingUpdate(undefined,done),/start/);assert.throws(()=>processingUpdate(processingUpdate(running,done),done),/finished/);assert.throws(()=>processingUpdate(running,{...done,input:{source:'changed'}}),/identity/);assert.throws(()=>processingUpdate(undefined,startActivity('memory.search',{})),/operation/);assert.throws(()=>validateProcessing('wrong-key',running),/receipt/);
});
test('media attempts preserve exact failed/stopped/results through state backup and reject rehashed forged identities',async()=>{
 const success=finishActivity(startActivity('pdf.read',{source:{name:'日本語.pdf',bytes:42}}),{output:{pages:2,characters:13,textSha256:'a'.repeat(64),reviewRequired:true}}),failed=finishActivity(startActivity('speech.transcribe',{source:{name:'silent.webm'},language:'ja'}),{error:Error('Unable to decode audio data')}),stopped=finishActivity(startActivity('pdf.read',{source:{name:'long.pdf'}}),{error:Error('Stopped')});
 const state={notes:[],settings:[],runs:[success,failed,stopped].map(a=>({key:processingKey(a.id),value:{schema:1,type:'media-processing',activity:a}}))};const pack=await makeStateBackup(state),parsed=await parseStateBackup(JSON.stringify(pack));assert.deepEqual(parsed.runs,state.runs);
 for(const change of [p=>p.payload.runs[0].value.activity.tool='shell.exec',p=>p.payload.runs[0].value.activity.tool='knowledge.answer',p=>p.payload.runs[0].key='unreserved',p=>p.payload.runs[0].value.type='other']){const bad=structuredClone(pack);change(bad);bad.sha256=stateHash(bad.payload);await assert.rejects(parseStateBackup(JSON.stringify(bad)),/operation|receipt/);}
});

test('cancelled decoder failure is Stopped, interruption stays incomplete, and failed receipt start prevents media work',async()=>{
 const {recordProcessingOperation}=await import('../src/processing-history.ts');let cancelled=false;const records=[];await assert.rejects(recordProcessingOperation('pdf.read',{},async()=>{cancelled=true;throw Error('Worker was destroyed');},async a=>records.push(a),r=>r,()=>cancelled),/Stopped/);assert.equal(records[1].status,'stopped');assert.equal(records[1].error.code,'stopped');let called=false;await assert.rejects(recordProcessingOperation('speech.transcribe',{},async()=>{called=true;},async()=>{throw Error('storage unavailable');},()=>null,()=>false),/storage/);assert.equal(called,false);
});
