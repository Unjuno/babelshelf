import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCustomToolPackage,inspectImportedCustomToolFiles,createCustomToolPackageFiles,CUSTOM_TOOL_STARTER_CODE} from '../src/custom-tool-package.ts';

const metadata={id:'user.date-format',version:1,title:'Date format',inputSchema:{type:'object',required:['value'],additionalProperties:false,properties:{value:{type:'string',minLength:1,maxLength:100}}},capabilities:['memory.read']};
const records=[
 {path:'Tools/user.date-format/SKILL.md',body:'---\n'+JSON.stringify(metadata)+'\n---\n\nFormat one date value.\n'},
 {path:'Tools/user.date-format/tool.js',body:'async ({input, capabilities}) => ({formatted: input.value})'},
];

test('inspection returns a bounded inert package with exact code and SKILL identity without running it',async()=>{
 const pkg=await inspectCustomToolPackage(records);
 assert.equal(pkg.id,'user.date-format');assert.equal(pkg.title,'Date format');assert.equal(pkg.entry,'Tools/user.date-format/tool.js');assert.equal(pkg.capabilities[0],'memory.read');assert.equal(pkg.code,records[1].body);assert.equal(pkg.skill,'Format one date value.\n');assert.match(pkg.sha256,/^[a-f0-9]{64}$/);
});

test('package creation produces one valid disabled source pair without evaluating its code',async()=>{
 const files=createCustomToolPackageFiles({id:'user.lookup',title:'Lookup',instructions:'Search local notes for the query.',code:'({input,capabilities})=>capabilities.memorySearch(input.query)',capabilities:['memory.search']});
 assert.deepEqual(files.map(file=>file.path),['Tools/user.lookup/SKILL.md','Tools/user.lookup/tool.js']);
 const value=await inspectCustomToolPackage(files);assert.equal(value.capabilities[0],'memory.search');assert.equal(value.code,'({input,capabilities})=>capabilities.memorySearch(input.query)');assert.ok(CUSTOM_TOOL_STARTER_CODE.length>0);
 assert.throws(()=>createCustomToolPackageFiles({id:'user.lookup/../x',title:'Bad',instructions:'Use it',code:'()=>1',capabilities:[]}),/Invalid/);
 assert.throws(()=>createCustomToolPackageFiles({id:'user.lookup',title:'Bad',instructions:'Use it',code:'()=>1',capabilities:['network.fetch']}),/Invalid/);
});

test('package creation stores an editable closed input schema with multiple typed fields',async()=>{
 const inputSchema={type:'object',required:['expression','precision','strict'],additionalProperties:false,properties:{expression:{type:'string',minLength:1,maxLength:240,description:'Arithmetic expression'},precision:{type:'integer',minimum:0,maximum:8},strict:{type:'boolean'}}};
 const files=createCustomToolPackageFiles({id:'user.precise-calc',title:'Precise calculation',instructions:'Calculate an expression with the requested precision.',code:'({input,capabilities})=>({value:capabilities.calculate(input.expression),precision:input.precision,strict:input.strict})',capabilities:['math.calculate'],inputSchema});
 const pkg=await inspectCustomToolPackage(files);
 assert.deepEqual(pkg.inputSchema,inputSchema);
 const metadata=JSON.parse(files[0].body.split('---\n')[1].split('\n---')[0]);assert.deepEqual(metadata.inputSchema,inputSchema);
 assert.throws(()=>createCustomToolPackageFiles({id:'user.bad-schema',title:'Bad schema',instructions:'Use it',code:'({input})=>input',capabilities:[],inputSchema:{...inputSchema,additionalProperties:true}}),/Invalid tool input schema/);
});

test('custom packages may declare the registered local calculator without gaining other access',async()=>{
 const files=createCustomToolPackageFiles({id:'user.convert',title:'Convert',instructions:'Calculate the requested expression.',code:'({input,capabilities})=>capabilities.calculate(input.expression)',capabilities:['math.calculate']});
 const pkg=await inspectCustomToolPackage(files);
 assert.deepEqual(pkg.capabilities,['math.calculate']);
 assert.throws(()=>createCustomToolPackageFiles({id:'user.convert',title:'Bad',instructions:'Use it',code:'()=>1',capabilities:['filesystem.read']}),/Invalid/);
});

test('inspection refuses capability escalation, ambiguous packages and malformed schemas',async()=>{
 const change=(mutate)=>{const copy=structuredClone(records);mutate(copy);return copy;};
 for(const bad of [
  change(r=>r[0].body='---\n'+JSON.stringify({...metadata,network:'https'})+'\n---\nUse it.'),
  change(r=>r[0].body='---\n'+JSON.stringify({...metadata,capabilities:['memory.write']})+'\n---\nUse it.'),
  change(r=>r[0].body='---\n'+JSON.stringify({...metadata,inputSchema:{type:'object',properties:{value:{type:'string',pattern:'^.*$'}}}})+'\n---\nUse it.'),
  [...records,records[1]],
 ])await assert.rejects(inspectCustomToolPackage(bad));
});

test('inspection applies stable package identity and size bounds',async()=>{
 const first=await inspectCustomToolPackage(records),second=await inspectCustomToolPackage([...records].reverse());
 assert.equal(first.sha256,second.sha256);
 await assert.rejects(inspectCustomToolPackage(records.map(r=>({...r,body:r.path.endsWith('tool.js')?'x'.repeat(100_001):r.body}))),/size|large/i);
 await assert.rejects(inspectCustomToolPackage(records.map(r=>({...r,path:r.path.replace('user.date-format','../../escape')}))));
});

test('imports one local SKILL.md and tool.js pair as inert normalized Memory files',async()=>{
 const skill='---\n{"id":"user.weather","version":1,"title":"Weather lookup","inputSchema":{"type":"object","required":["query"],"additionalProperties":false,"properties":{"query":{"type":"string","minLength":1,"maxLength":80}}},"capabilities":["memory.search"]}\n---\n\nSearch local weather notes.\n';
 const code='({input,capabilities}) => capabilities.memorySearch(input.query)';
 const imported=await inspectImportedCustomToolFiles([{name:'SKILL.md',body:skill},{name:'tool.js',body:code}]);
 assert.equal(imported.id,'user.weather');assert.equal(imported.sha256.length,64);
 assert.deepEqual(imported.files,[{path:'Tools/user.weather/SKILL.md',body:skill},{path:'Tools/user.weather/tool.js',body:code}]);
});

test('refuses ambiguous, extra, malformed, or oversized imported tool files',async()=>{
 const skill='---\n'+JSON.stringify({...metadata,id:'user.weather',title:'Weather',capabilities:[]})+'\n---\n\nUse it.\n';
 const code='({input})=>input.value';
 await assert.rejects(inspectImportedCustomToolFiles([{name:'SKILL.md',body:skill},{name:'SKILL.md',body:skill}]),/one SKILL\.md and one tool\.js/);
 await assert.rejects(inspectImportedCustomToolFiles([{name:'SKILL.md',body:skill},{name:'tool.js',body:code},{name:'extra.txt',body:'x'}]),/exactly two/);
 await assert.rejects(inspectImportedCustomToolFiles([{name:'SKILL.md',body:skill.replace('user.weather','bad.id')},{name:'tool.js',body:code}]),/metadata|package/i);
 await assert.rejects(inspectImportedCustomToolFiles([{name:'SKILL.md',body:'x'.repeat(12_001)},{name:'tool.js',body:code}]),/too large/i);
 await assert.rejects(inspectImportedCustomToolFiles([{name:'SKILL.md',body:skill},{name:'tool.js',body:'x'.repeat(32_001)}]),/too large/i);
});
