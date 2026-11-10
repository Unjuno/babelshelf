import test from 'node:test';
import assert from 'node:assert/strict';
import {createResolvedActions} from '../src/resolved-actions.ts';

const lexical=[
 {kind:'file',noteId:'source',revision:2,path:'Notes/source.md'},
 {kind:'passage',noteId:'lexical',revision:1,title:'Lexical result',path:'Notes/lexical.md',start:0,end:16,quote:'local word match',score:4},
];
function actions(semanticSearch){
 return createResolvedActions({
  store:{search:async()=>structuredClone(lexical)},engine:{},model:'text',question:'Find my saved notes about rare topic',check(){},trace:async(_tool,_input,work)=>work(),snapshot:async()=>[],
  registry:{identity:async()=>({version:1}),run:async(_id,args,host)=>host.search(args.query,host.signal)},
  ...(semanticSearch?{semanticSearch}:{}),
 });
}

test('selected semantic passages join canonical lexical results through the existing bounded result merger',async()=>{
 let receivedSignal;
 const semantic=[{kind:'passage',noteId:'source',revision:2,title:'Semantic source',path:'Notes/source.md',start:0,end:22,quote:'rare semantic evidence',score:0.91},{kind:'passage',noteId:'meaning',revision:4,title:'Meaning',path:'Notes/meaning.md',start:8,end:28,quote:'language independent',score:0.77}];
 const result=await actions(async(_query,signal)=>{receivedSignal=signal;return semantic;}).search('rare');
 assert.deepEqual(receivedSignal,undefined);
 assert.equal(result.kind,'search');
 assert.equal(result.results[0].noteId,'source');
 assert.equal(result.results[0].quote,'rare semantic evidence');
 assert.ok(result.results.some(item=>item.noteId==='lexical'));
 assert.equal(result.results.filter(item=>item.noteId==='source').length,1);
});

test('unloaded optional Search keeps deterministic Memory results unchanged',async()=>{
 const result=await actions(async()=>null).search('rare');
 assert.equal(result.kind,'search');
 assert.deepEqual(result.results,lexical.filter(item=>item.kind==='passage'));
 assert.deepEqual(result.files,lexical.filter(item=>item.kind==='file'));
});
