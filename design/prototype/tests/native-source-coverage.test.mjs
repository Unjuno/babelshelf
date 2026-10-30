import test from 'node:test';
import assert from 'node:assert/strict';
import {agentEvidenceFromCalls} from '../src/agent-evidence.ts';

test('native evidence never silently drops an entire observed source',()=>{
 const row=(id,start,quote)=>({tool:'memory.read',arguments:{query:id},result:[{noteId:id,path:`Notes/${id}.md`,revision:1,start,excerpt:quote,partial:true,totalChars:10000}]});
 const crowd=Array.from({length:64},(_,i)=>row('first',i*10,`range${i}`));
 const selected=agentEvidenceFromCalls([...crowd,row('second',0,'second source')]);
 assert.ok(selected.some(ref=>ref.noteId==='first'));assert.ok(selected.some(ref=>ref.noteId==='second'));
 const tooMany=Array.from({length:65},(_,i)=>row(`note-${i}`,0,`source ${i}`));
 assert.throws(()=>agentEvidenceFromCalls(tooMany),/Context limit.*sources/);
});
