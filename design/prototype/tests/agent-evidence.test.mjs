import test from 'node:test';
import assert from 'node:assert/strict';
import {projectAgentToolResult,agentEvidenceFromCalls,agentCalculationsFromCalls} from '../src/agent-evidence.ts';

test('tool projections keep exact bounded excerpts and canonical source identity',()=>{
 const searchable={noteId:'note-1',revision:4,start:10,end:1110,quote:'x'.repeat(1100),title:'Notes/a.md',privateField:'drop'};
 const search=projectAgentToolResult('memory.search',[searchable]);assert.deepEqual(search,[{noteId:'note-1',revision:4,start:10,end:510,quote:'x'.repeat(500),title:'Notes/a.md'}]);
 const read=projectAgentToolResult('memory.read',[{id:'note-2',path:'Notes/b.md',version:3,body:'y'.repeat(2500)}]);assert.deepEqual(read,[{noteId:'note-2',path:'Notes/b.md',revision:3,excerpt:'y'.repeat(2000),partial:true}]);
 assert.throws(()=>projectAgentToolResult('mcp.fetch',[]),/not available/);
});

test('agent calculations retain only exact local arithmetic and never become source citations',()=>{
 const call={tool:'math.calculate',arguments:{expression:'(1200 + 800) / 4'},result:[{expression:'(1200 + 800) / 4',result:500,precision:'IEEE-754 binary64',privateField:'drop'}]};
 assert.deepEqual(projectAgentToolResult(call.tool,call.result),[{expression:call.arguments.expression,result:500,precision:'IEEE-754 binary64'}]);
 assert.deepEqual(agentCalculationsFromCalls([call]),[{expression:call.arguments.expression,result:500,precision:'IEEE-754 binary64'}]);
 assert.deepEqual(agentEvidenceFromCalls([call]),[]);
 assert.throws(()=>projectAgentToolResult(call.tool,[{...call.result[0],result:501}]),/Invalid calculation result/);
 assert.throws(()=>agentCalculationsFromCalls([{...call,arguments:{expression:'different'}}]),/expression changed/);
 assert.throws(()=>projectAgentToolResult(call.tool,[{...call.result[0],expression:'1+'.repeat(101)+'1'}]),/Invalid calculation result/);
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
