import test from 'node:test';
import assert from 'node:assert/strict';
import {openUniqueSavedMemory} from '../src/saved-memory-open.ts';

const note=(id='note-a',version=2)=>({id,path:'Inbox/meeting.md',body:'The meeting starts Tuesday at 14:30.',version});
const hit=(noteId='note-a',revision=2,extra={})=>({noteId,revision,title:'Meeting',start:0,end:36,quote:'The meeting starts Tuesday at 14:30.',...extra});

test('one unique current saved note opens from a search hit and returns exact source pins',async()=>{
 const events=[],result=await openUniqueSavedMemory({question:'Open my note about the meeting.',query:'meeting',search:async query=>{events.push('search:'+query);return [hit()];},snapshot:async()=>{events.push('snapshot');return [note()];},check:()=>events.push('check')});
 assert.equal(result.kind,'opened');assert.equal(result.note.id,'note-a');assert.equal(result.resolution.path,'Inbox/meeting.md');assert.equal(result.resolution.refs[0].noteId,'note-a');assert.equal(result.resolution.refs[0].revision,2);assert.equal(result.resolution.refs[0].quote,note().body);
 assert.deepEqual(events,['check','search:meeting','check','snapshot','check']);
});

test('multiple chunks from one note deduplicate to one safe open candidate',async()=>{
 const result=await openUniqueSavedMemory({question:'Open my note about the meeting.',query:'meeting',search:async()=>[hit('note-a',2,{start:0,end:6}),hit('note-a',2,{start:20,end:36})],snapshot:async()=>[note()]});
 assert.equal(result.kind,'opened');assert.equal(result.note.version,2);
});

test('zero or multiple note revisions remain results without reading a snapshot',async()=>{
 for(const results of [[],[hit('note-a',2),hit('note-b',1)]]){
  let snapshots=0;const result=await openUniqueSavedMemory({question:'Open my note about the meeting.',query:'meeting',search:async()=>results,snapshot:async()=>{snapshots++;return [note()];}});
  assert.equal(result.kind,'results');assert.deepEqual(result.results,results);assert.equal(snapshots,0);
 }
});

test('a changed or withdrawn candidate refuses to open instead of substituting the latest note',async()=>{
 for(const records of [[note('note-a',3)],[]])await assert.rejects(openUniqueSavedMemory({question:'Open my note about the meeting.',query:'meeting',search:async()=>[hit()],snapshot:async()=>records}),/changed|unavailable/i);
});

test('cancellation is checked before search, after search and after the revision snapshot',async()=>{
 for(const abortAt of [1,2,3]){
  let checks=0,snapshots=0;await assert.rejects(openUniqueSavedMemory({question:'Open my note about the meeting.',query:'meeting',search:async()=>[hit()],snapshot:async()=>{snapshots++;return [note()];},check:()=>{if(++checks===abortAt)throw Error('Stopped');}}),/Stopped/);
  assert.equal(snapshots,abortAt===3?1:0);
 }
});
