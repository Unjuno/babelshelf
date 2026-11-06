import test from 'node:test';
import assert from 'node:assert/strict';
import {createNote,reviseNote} from '../../../dist/core.js';
import {noteSourceMetadata} from '../src/note-provenance.ts';
import {run} from '../src/tools/memory.sources/tool.ts';
import {projectAgentToolResult,agentEvidenceFromCalls,agentToolInfoFromCalls} from '../src/agent-evidence.ts';

test('source tool navigates exact revisions without promoting stale text to evidence',async()=>{
 const original=createNote({path:'Notes/a.md',body:'Original text'}),ref={noteId:original.id,revision:1,start:0,end:13,quote:'Original text'},summary=createNote({path:'Notes/summary.md',body:'A summary',kind:'generated',sources:[ref]});
 const changed=reviseNote(original,{body:'Updated text'},1),host={check(){},sources:async(id,revision)=>noteSourceMetadata([changed,summary],id,revision)};
 const report=await run({id:summary.id,revision:1},host);
 assert.equal(report.items[0].status,'changed');assert.equal(report.items[0].revision,1);assert.equal(report.items[0].currentRevision,2);assert.ok(!JSON.stringify(report).includes('Original text'));
 await assert.rejects(run({id:summary.id,revision:2},host),/changed|unavailable/i);
 const call={tool:'memory.sources',arguments:{id:summary.id,revision:1},result:report};
 assert.deepEqual(projectAgentToolResult(call.tool,report),report);assert.deepEqual(agentEvidenceFromCalls([call]),[]);assert.equal(agentToolInfoFromCalls([call]).length,1);
 assert.throws(()=>projectAgentToolResult(call.tool,{...report,items:[{...report.items[0],quote:'forged'}]}),/invalid/i);
});

test('source pages reject a changed original instead of mixing snapshots',async()=>{
 const original=createNote({path:'Notes/a.md',body:'Original text'}),ref={noteId:original.id,revision:1,start:0,end:13,quote:'Original text'},summary=createNote({path:'Notes/summary.md',body:'Summary',kind:'generated',sources:Array.from({length:13},()=>ref)});
 let records=[original,summary];const host={check(){},sources:async(id,revision)=>noteSourceMetadata(records,id,revision)};
 const first=await run({id:summary.id,revision:1},host);assert.equal(first.nextOffset,12);
 const small=await run({id:summary.id,revision:1,limit:1},host);assert.equal(small.items.length,1);assert.equal(small.nextOffset,1);assert.deepEqual(projectAgentToolResult('memory.sources',small),small);
 const smallNext=await run({id:summary.id,revision:1,offset:1,limit:1,snapshot:small.snapshot},host);assert.equal(smallNext.items.length,1);assert.equal(smallNext.nextOffset,2);
 const next=await run({id:summary.id,revision:1,offset:12,snapshot:first.snapshot},host);assert.equal(next.items.length,1);
 records=[reviseNote(original,{body:'Changed text'},1),summary];
 await assert.rejects(run({id:summary.id,revision:1,offset:12,snapshot:first.snapshot},host),/changed/i);
});
