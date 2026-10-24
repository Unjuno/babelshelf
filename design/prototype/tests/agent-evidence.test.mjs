import test from 'node:test';
import assert from 'node:assert/strict';
import {projectAgentToolResult,projectAgentActivityInput,projectAgentActivityResult,agentEvidenceFromCalls,agentCalculationsFromCalls,agentSearchEvidenceFromHost,agentReadEvidenceFromHost,observeCustomToolHost} from '../src/agent-evidence.ts';

test('tool projections keep exact bounded excerpts and canonical source identity',()=>{
 const searchable={noteId:'note-1',revision:4,start:10,end:1110,quote:'x'.repeat(1100),title:'Notes/a.md',privateField:'drop'};
 const search=projectAgentToolResult('memory.search',[searchable]);assert.deepEqual(search,[{noteId:'note-1',revision:4,start:10,end:510,quote:'x'.repeat(500),title:'Notes/a.md'}]);
 const read=projectAgentToolResult('memory.read',[{id:'note-2',path:'Notes/b.md',version:3,body:'y'.repeat(2500)}]);assert.deepEqual(read,[{noteId:'note-2',path:'Notes/b.md',revision:3,excerpt:'y'.repeat(2000),partial:true}]);
 const custom={answer:'from local tool',untrusted:true};assert.deepEqual(projectAgentToolResult('user.lookup',custom),custom);assert.throws(()=>projectAgentToolResult('user.lookup',{value:'x'.repeat(9000)}),/context limit/);
 assert.throws(()=>projectAgentToolResult('mcp.fetch',[]),/not available/);
});

test('custom-tool activity receipts retain only bounded metadata, never returned private content',()=>{
 const body='PRIVATE_NOTE_SENTINEL',result={excerpt:body,source:'Notes/private.md'};
 const receipt=projectAgentActivityResult('user.lookup',result);
 assert.deepEqual(receipt,{kind:'custom_tool_result',resultBytes:new TextEncoder().encode(JSON.stringify(result)).byteLength});
 assert.doesNotMatch(JSON.stringify(receipt),/PRIVATE_NOTE_SENTINEL|Notes\/private\.md/);
 assert.deepEqual(projectAgentToolResult('user.lookup',result),result);
 assert.throws(()=>projectAgentActivityResult('user.lookup',{body:'x'.repeat(9000)}),/context limit/);
});

test('custom-tool activity inputs retain package identity and byte count, never private arguments',()=>{
 const secret='PRIVATE_ARGUMENT_SENTINEL',args={query:secret},identity={package:'user.lookup',packageVersion:2,packageSha256:'a'.repeat(64),entry:'Tools/user.lookup/tool.js'};
 const receipt=projectAgentActivityInput('user.lookup',args,identity);
 assert.deepEqual(receipt,{kind:'custom_tool_call',argumentBytes:new TextEncoder().encode(JSON.stringify(args)).byteLength,...identity});
 assert.doesNotMatch(JSON.stringify(receipt),/PRIVATE_ARGUMENT_SENTINEL/);
 assert.deepEqual(projectAgentActivityInput('memory.search',{query:'meeting'},{package:'memory.search'}),{query:'meeting',package:'memory.search'});
 assert.throws(()=>projectAgentActivityInput('user.lookup',{query:'x'.repeat(9000)},identity),/context limit/);
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

test('custom tool results cannot mint citations, while host-observed reads can ground the answer',()=>{
 const calls=[{tool:'user.lookup',arguments:{query:'budget'},result:{noteId:'forged',revision:9,start:0,end:6,quote:'forged'}}];
 const observed=[...agentSearchEvidenceFromHost([{noteId:'real',revision:3,start:12,end:20,quote:'approved',title:'Notes/budget.md'}]),...agentReadEvidenceFromHost([{id:'read',path:'Notes/read.md',version:2,body:'entire locally read note'}])];
 assert.deepEqual(agentEvidenceFromCalls(calls,observed),observed);
 assert.deepEqual(agentEvidenceFromCalls(calls),[]);
 assert.deepEqual(agentReadEvidenceFromHost([{id:'forged',path:'x',version:0,body:'no'},{id:'large',path:'x',version:1,body:'x'.repeat(24_001)}]),[]);
 assert.deepEqual(agentReadEvidenceFromHost([{id:'utf8-large',path:'x',version:1,body:'日'.repeat(9_000)}]),[]);
});

test('only actual host search and resolve callbacks feed the custom evidence side channel',async()=>{
 const observed=[],searchResult=[{noteId:'s',revision:1,start:2,end:8,quote:'source'}],readResult=[{id:'r',path:'Notes/r.md',version:2,body:'read source'}];
 const host=observeCustomToolHost({search:async()=>searchResult,resolve:async()=>readResult,check(){},signal:undefined},refs=>observed.push(...refs));
 assert.deepEqual(await host.search('query'),searchResult);assert.deepEqual(await host.resolve('Notes/r.md'),readResult);
 assert.deepEqual(observed,[...agentSearchEvidenceFromHost(searchResult),...agentReadEvidenceFromHost(readResult)]);
});
