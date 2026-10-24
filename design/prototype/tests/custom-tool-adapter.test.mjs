import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCustomToolPackage} from '../src/custom-tool-package.ts';
import {customToolRegistration,validateCustomToolArguments} from '../src/custom-tool-adapter.ts';
import {createToolRegistry} from '../src/tools/tool-registry.ts';

const files=()=>[
 {path:'Tools/user.lookup/SKILL.md',body:'---\n{"id":"user.lookup","version":1,"title":"Lookup","inputSchema":{"type":"object","required":["query"],"additionalProperties":false,"properties":{"query":{"type":"string","minLength":1,"maxLength":80}}},"capabilities":["memory.search"]}\n---\nSearch local notes.'},
 {path:'Tools/user.lookup/tool.js',body:'({input,capabilities})=>capabilities.memorySearch(input.query)'}
];

test('custom arguments are bounded by the package schema before execution',async()=>{
 const pkg=await inspectCustomToolPackage(files());
 assert.deepEqual(validateCustomToolArguments(pkg,{query:'meeting'}),{query:'meeting'});
 for(const bad of [{},{query:''},{query:'x'.repeat(81)},{query:'ok',extra:true},null])assert.throws(()=>validateCustomToolArguments(pkg,bad));
});

test('custom package adapts into the immutable registry and receives only declared host capabilities',async()=>{
 const pkg=await inspectCustomToolPackage(files()),observed=[];
 const registration=await customToolRegistration(pkg,async options=>{observed.push(options);return await options.host.search(options.input.query);});
 const registry=createToolRegistry([registration]);
 const notes=[{id:'n1',path:'Notes/meeting.md',version:2,body:'Monday at 10'}];
 assert.equal((await registry.identity(pkg.id)).packageSha256.length,64);
 assert.deepEqual(await registry.run(pkg.id,{query:'meeting'},{check(){},search:async q=>{assert.equal(q,'meeting');return notes;},resolve:async()=>{throw Error('must not receive undeclared read');}}),notes);
 assert.deepEqual(observed[0].capabilities,['memory.search']);
 assert.equal(observed[0].host.read,undefined);
});

test('a custom package can call only its declared registered local calculator',async()=>{
 const sources=files().map(file=>({...file,body:file.path.endsWith('SKILL.md')?file.body.replace('memory.search','math.calculate').replace('Search local notes.','Calculate the requested expression.'):'({input,capabilities})=>capabilities.calculate(input.query)'}));
 const pkg=await inspectCustomToolPackage(sources),registration=await customToolRegistration(pkg,async options=>{
  assert.deepEqual(options.capabilities,['math.calculate']);
  assert.equal(options.host.search,undefined);assert.equal(options.host.read,undefined);
  return options.host.calculate(options.input.query);
 });
 assert.equal(await registration.run({query:'6 * 7'},{check(){},search:async()=>[],resolve:async()=>[]}),42);
});

test('a user package cannot elevate package policy beyond local read-only capabilities',async()=>{
 const pkg=await inspectCustomToolPackage(files());
 const widened={...pkg,capabilities:['network.fetch']};
 await assert.rejects(customToolRegistration(widened),/Invalid custom tool package/);
 const registration=await customToolRegistration(pkg,async()=>({ok:true}));
 assert.equal(registration.definition.readOnly,true);assert.equal(registration.definition.network,'none');
});
