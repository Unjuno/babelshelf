import test from 'node:test';
import assert from 'node:assert/strict';
import {projectAgentToolResult,agentEvidenceFromCalls} from '../src/agent-evidence.ts';

test('tool projections keep exact bounded excerpts and canonical source identity',()=>{
 const searchable={noteId:'note-1',revision:4,start:10,end:1110,quote:'x'.repeat(1100),title:'Notes/a.md',privateField:'drop'};
 const search=projectAgentToolResult('memory.search',[searchable]);assert.deepEqual(search,[{noteId:'note-1',revision:4,start:10,end:510,quote:'x'.repeat(500),title:'Notes/a.md'}]);
 const read=projectAgentToolResult('memory.read',[{id:'note-2',path:'Notes/b.md',version:3,body:'y'.repeat(2500)}]);assert.deepEqual(read,[{noteId:'note-2',path:'Notes/b.md',revision:3,excerpt:'y'.repeat(2000),partial:true}]);
 assert.throws(()=>projectAgentToolResult('mcp.fetch',[]),/not available/);
});

test('answer evidence is reconstructed only from exact bounded registered read/search results',()=>{
 const calls=[
  {tool:'memory.search',arguments:{query:'a'},result:[{noteId:'n1',revision:2,start:5,end:10,quote:'quote',title:'Notes/a.md'},{noteId:'fake',revision:0,start:1,end:0,quote:'bad'}]},
  {tool:'memory.read',arguments:{query:'Notes/b.md'},result:[{noteId:'n2',path:'Notes/b.md',revision:4,excerpt:'source text'}]},
  {tool:'filesystem.read',arguments:{path:'x'},result:[{noteId:'n3',revision:1,start:0,end:4,quote:'nope'}]},
 ];
 assert.deepEqual(agentEvidenceFromCalls(calls),[
  {noteId:'n1',revision:2,start:5,end:10,quote:'quote',title:'Notes/a.md'},
  {noteId:'n2',revision:4,start:0,end:11,quote:'source text',title:'Notes/b.md'},
 ]);
});
