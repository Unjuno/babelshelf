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

test('conflicting quotations for the same original version and range are rejected',()=>{
 const call=quote=>({tool:'memory.search',arguments:{query:'note'},result:[{noteId:'note',revision:1,start:0,end:3,quote}]});
 assert.throws(()=>agentEvidenceFromCalls([call('one'),call('two')]),/Source.*conflict/);
 assert.equal(agentEvidenceFromCalls([call('one'),call('one')]).length,1);
 const crowded=Array.from({length:64},(_,i)=>({tool:'memory.search',arguments:{query:String(i)},result:[{noteId:'note',revision:1,start:i*3,end:i*3+3,quote:'one'}]}));
 const beyond={tool:'memory.search',arguments:{query:'beyond'},result:[{noteId:'note',revision:1,start:192,end:195,quote:'one'}]};
 assert.throws(()=>agentEvidenceFromCalls([...crowded,beyond,{...beyond,result:[{...beyond.result[0],quote:'two'}]}]),/Source.*conflict/);
});
