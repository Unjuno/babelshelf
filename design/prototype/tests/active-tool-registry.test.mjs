import test from 'node:test';
import assert from 'node:assert/strict';
import {buildActiveToolRegistry} from '../src/active-tool-registry.ts';
import {customToolRegistration} from '../src/custom-tool-adapter.ts';

const pkg=[
 {path:'Tools/user.lookup/SKILL.md',body:'---\n{"id":"user.lookup","version":1,"title":"Lookup","inputSchema":{"type":"object","required":["query"],"additionalProperties":false,"properties":{"query":{"type":"string","minLength":1,"maxLength":80}}},"capabilities":["memory.search"]}\n---\nSearch notes.'},
 {path:'Tools/user.lookup/tool.js',body:'({input,capabilities})=>capabilities.memorySearch(input.query)'}
];
const host={check(){},search:async q=>[{id:'n1',path:'Notes/'+q+'.md',version:1,body:'original'}],resolve:async()=>[]};
const builtinSearch={definition:{id:'memory.search',version:1,effect:'read',network:'none'},entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search local notes.'},{path:'Tools/memory.search/tool.ts',body:'source'}],run:async(args,h)=>h.search(args.query)};

test('only packages explicitly selected by the profile enter the active registry',async()=>{
 const built=await buildActiveToolRegistry([...pkg],['memory.search'],[builtinSearch]);
 assert.deepEqual(built.capabilities.map(tool=>tool.id),['memory.search']);
 await assert.rejects(built.registry.identity('user.lookup'),/not registered/);
});

test('a disabled built-in cannot be identified or executed through the active registry',async()=>{
 let calls=0;
 const disabled={definition:{id:'math.calculate',version:1,effect:'read',network:'none'},entry:'Tools/math.calculate/tool.ts',sources:[{path:'Tools/math.calculate/SKILL.md',body:'Calculate.'},{path:'Tools/math.calculate/tool.ts',body:'source'}],run:async()=>{calls++;return []}};
 const built=await buildActiveToolRegistry([],['memory.search'],[builtinSearch,disabled]);
 assert.deepEqual(built.registry.capabilities().map(tool=>tool.id),['memory.search']);
 await assert.rejects(built.registry.identity('math.calculate'),/not registered/);
 await assert.rejects(built.registry.run('math.calculate',{expression:'1+1'},host),/not registered/);
 assert.equal(calls,0);
});

test('a selected package is checked, registered, and runnable through the profile registry',async()=>{
 const built=await buildActiveToolRegistry([...pkg],['user.lookup'],[],async value=>customToolRegistration(value,async options=>options.host.search(options.input.query)));
 assert.deepEqual(built.capabilities.map(tool=>tool.id),['user.lookup']);
 assert.deepEqual(built.capabilities[0].inputSchema,{type:'object',required:['query'],additionalProperties:false,properties:{query:{type:'string',minLength:1,maxLength:80}}});
 assert.deepEqual(await built.registry.run('user.lookup',{query:'meeting'},host),[{id:'n1',path:'Notes/meeting.md',version:1,body:'original'}]);
});

test('an incomplete or tampered package selected by a profile fails closed',async()=>{
 await assert.rejects(buildActiveToolRegistry([pkg[0]],['user.lookup']),/incomplete/);
 await assert.rejects(buildActiveToolRegistry([...pkg],['user.lookup'],[],async value=>customToolRegistration({...value,code:'({input})=>input'},async()=>null)),/identity changed/);
});

test('untrusted non-package Memory paths never become executable registrations',async()=>{
 const built=await buildActiveToolRegistry([{path:'Notes/user.lookup/tool.js',body:'throw 1'},{path:'Tools/user.lookup/extra.js',body:'throw 2'}],['memory.search'],[builtinSearch]);
 assert.deepEqual(built.capabilities.map(tool=>tool.id),['memory.search']);
});

test('broken unselected packages do not prevent the selected tools from loading',async()=>{
 const broken=[{path:'Tools/user.broken/SKILL.md',body:'invalid'},{path:'Tools/user.broken/SKILL.md',body:'duplicate'},{path:'Tools/user.broken/tool.js',body:null}];
 const built=await buildActiveToolRegistry([...pkg,...broken],['memory.search'],[builtinSearch]);
 assert.deepEqual(await built.registry.run('memory.search',{query:'meeting'},host),[{id:'n1',path:'Notes/meeting.md',version:1,body:'original'}]);
 await assert.rejects(buildActiveToolRegistry([...pkg,...broken],['user.broken']),/Duplicate|Invalid/);
});
