import test from 'node:test';
import assert from 'node:assert/strict';
import {testCustomTool,toolTestSources} from '../src/custom-tool-test.ts';
import {createCustomToolPackageFiles} from '../src/custom-tool-package.ts';

const files=()=>createCustomToolPackageFiles({id:'user.count',title:'Count',instructions:'Count characters.',code:'({input})=>input.query.length',capabilities:[]}).map((file,index)=>({...file,id:'file-'+index,version:1}));
test('tool trial rejects stale versions before runtime verification and exposes no write port',async()=>{
 const sources=files();let verified=0,read=0;
 await assert.rejects(testCustomTool({sources,input:'{"query":"abc"}',loadSources:async()=>sources.map(source=>({...source,version:2})),ensureRuntime:async()=>{verified++;},host:{check(){},search:async()=>{read++;return [];},resolve:async()=>{read++;return [];}}}),/Tool files changed/);
 assert.equal(verified,0);assert.equal(read,0);
});
test('tool trial rechecks sources after runtime readiness and stops before execution',async()=>{
 const sources=files(),controller=new AbortController();let ready=false;
 const options={sources,input:'{"query":"abc"}',loadSources:async()=>ready?sources.map(source=>({...source,version:2})):sources,ensureRuntime:async()=>{ready=true;},host:{check(){if(controller.signal.aborted)throw Error('Stopped');},search:async()=>[],resolve:async()=>[],signal:controller.signal}};
 await assert.rejects(testCustomTool(options),/Tool files changed/);
 ready=false;options.ensureRuntime=async()=>controller.abort();
 await assert.rejects(testCustomTool(options),/Stopped/);
});
test('tool trial validates JSON and schema without reading Memory or preparing assets',async()=>{
 let reads=0,prepared=0;const options={sources:files(),loadSources:async()=>{reads++;return files();},ensureRuntime:async()=>{prepared++;},host:{check(){},search:async()=>[],resolve:async()=>[]}};
 for(const input of ['not json','{"query":5}','{"query":"abc","extra":true}'])await assert.rejects(testCustomTool({...options,input}),/JSON|invalid|schema/);
 assert.equal(reads,0);assert.equal(prepared,0);
 assert.deepEqual(toolTestSources([...files(),{id:'other',path:'Home/private.md',body:'PRIVATE',version:1}],'user.count').map(source=>source.path),['Tools/user.count/SKILL.md','Tools/user.count/tool.js']);
});
