import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeResponseTools,nativeResponseText} from '../dist/native-response.js';
const spec={name:'babelshelf_answer',parameters:{type:'object',properties:{answer:{type:'string'}},required:['answer'],additionalProperties:false}};
const call={id:'call_test',type:'function',function:{name:spec.name,arguments:{answer:'A source-grounded answer'}}};
const raw=()=>({finish_reason:'tool_calls',message:{role:'assistant',content:'',tool_calls:[structuredClone(call)]}});

test('grounded native response keeps the exact bounded source-label schema',async()=>{
 const {nativeOutputRequest}=await import('../design/prototype/src/native-output-format.ts');
 const spec=nativeOutputRequest([],{type:'grounded-answer',sourceCount:2}).responseTool;
 assert.equal(nativeResponseTools(spec)[0].function.parameters.properties.sources.maxItems,2);
 const serialize=args=>{const call={type:'function',function:{name:spec.name,arguments:args}},reply={finish_reason:'tool_calls',message:{role:'assistant',content:'',tool_calls:[call]}};return nativeResponseText(reply,spec,[call]);};
 for(const args of [{status:'answered',answer:'Different locations.',sources:['S1','S2']},{status:'insufficient_evidence',answer:'No time stated.',sources:[]}])assert.equal(serialize(args),JSON.stringify(args));
 for(const sources of [['S3'],['S1','S1'],['S1','S2','S1'],[1],'S1'])assert.throws(()=>serialize({status:'answered',answer:'x',sources}),/Invalid model tool response/);
 assert.throws(()=>serialize({answer:'missing status',sources:[]}),/Invalid model tool response/);
 for(const sourceRule of [{type:'array'}, {...spec.parameters.properties.sources,maxItems:65},{...spec.parameters.properties.sources,items:{type:'string',enum:['untrusted-label']}}])assert.throws(()=>nativeResponseTools({...spec,parameters:{...spec.parameters,properties:{...spec.parameters.properties,sources:sourceRule}}}),/Invalid native response format/);
});
test('a single expected typed response becomes JSON without executing anything',()=>{
 assert.equal(nativeResponseTools(spec)[0].function.name,spec.name);assert.deepEqual(JSON.parse(nativeResponseText(raw(),spec,[call])),call.function.arguments);
});
test('native source recovery supports explicit missing evidence only in the opted-in schema',()=>{
 const opted={...spec,parameters:{...spec.parameters,properties:{...spec.parameters.properties,status:{type:'string',enum:['insufficient_evidence']}}}};
 const args={answer:'The excerpts do not state a time.',status:'insufficient_evidence'},call={type:'function',function:{name:spec.name,arguments:args}},reply={finish_reason:'tool_calls',message:{role:'assistant',content:'',tool_calls:[call]}};
 assert.equal(nativeResponseText(reply,opted,[call]),JSON.stringify(args));
 assert.throws(()=>nativeResponseText(reply,spec,[call]),/Invalid model tool response/);
 for(const status of [{type:'string'},{type:'string',enum:['saved']},{type:'integer',enum:[1]}])assert.throws(()=>nativeResponseTools({...opted,parameters:{...opted.parameters,properties:{...opted.parameters.properties,status}}}),/Invalid native response format/);
});
test('source-bound calculation transport validates its dedicated flat proposal schema',()=>{
 const spec={name:'babelshelf_calculation',parameters:{type:'object',properties:{operation:{type:'string',enum:['add','subtract','multiply','divide']},sourceOperandIndex:{type:'integer',enum:[0,1]},sourceIndex:{type:'integer',minimum:0,maximum:0},sourceQuote:{type:'string'},sourceUnit:{type:'string'},requestQuote:{type:'string'}},required:['operation','sourceOperandIndex','sourceIndex','sourceQuote','sourceUnit','requestQuote'],additionalProperties:false}},args={operation:'divide',sourceOperandIndex:0,sourceIndex:0,sourceQuote:'七リットル',sourceUnit:'リットル',requestQuote:'3'},call={type:'function',function:{name:spec.name,arguments:args}};
 assert.equal(nativeResponseTools(spec)[0].function.name,spec.name);assert.equal(nativeResponseText({finish_reason:'tool_calls',message:{role:'assistant',content:'',tool_calls:[call]}},spec,[call]),JSON.stringify(args));
 assert.throws(()=>nativeResponseTools({...spec,parameters:{...spec.parameters,properties:{...spec.parameters.properties,sourceIndex:{type:'integer',minimum:0,maximum:8}}}}),/Invalid native/);
});
for(const kind of ['duplicate','text','wrong-name','parser-error','budget','missing','extra-key','event-mismatch'])test('invalid native response remains a bounded failure: '+kind,()=>{
 const r=raw(),events=[structuredClone(call)];
 if(kind==='duplicate')r.message.tool_calls.push(structuredClone(call));
 if(kind==='text')r.message.content='Extra text';
 if(kind==='wrong-name')r.message.tool_calls[0].function.name='unexpected';
 if(kind==='parser-error')r.message.tool_calls[0].errors=['Missing argument'];
 if(kind==='budget')r.finish_reason='length';
 if(kind==='missing')r.message.tool_calls[0].function.arguments={};
 if(kind==='extra-key')r.message.tool_calls[0].function.arguments.other='not allowed';
 if(kind==='event-mismatch')events[0].function.arguments.answer='different';
 assert.throws(()=>nativeResponseText(r,spec,events),e=>e.diagnostic?.raw.length<=8192&&e.diagnostic.reason.startsWith('native:'));
});
test('arbitrary tool/schema definitions are not accepted as output transport',()=>{
 assert.throws(()=>nativeResponseTools({...spec,name:'delete-files'}),/response format/);
 assert.throws(()=>nativeResponseTools({...spec,parameters:{...spec.parameters,additionalProperties:true}}),/response format/);
});

test('scoped named action is mapped to one inert plan and enforces its own fields',()=>{
 const parameters={type:'object',properties:{action:{type:'string',enum:['search']},query:{type:'string'},target:{type:'string',enum:['knowledge','path']}},required:['action','query'],additionalProperties:false};
 const actions={search:{type:'object',properties:{query:{type:'string'},target:{type:'string',enum:['knowledge']}},required:['query'],additionalProperties:false}},s={name:'babelshelf_plan',parameters,actions};
 assert.equal(nativeResponseTools(s)[0].function.name,'search');
 const call={type:'function',function:{name:'search',arguments:{query:'meeting',target:'knowledge'}}},r={finish_reason:'tool_calls',message:{role:'assistant',content:'',tool_calls:[call]}};
 assert.deepEqual(JSON.parse(nativeResponseText(r,s,[call])),{action:'search',query:'meeting',target:'knowledge'});
 call.function.arguments.target='path';assert.throws(()=>nativeResponseText(r,s,[call]),e=>e.diagnostic.reason==='native:value');
 call.function.arguments={action:'edit',query:'meeting'};assert.throws(()=>nativeResponseText(r,s,[call]),e=>e.diagnostic.reason==='native:fields');
 call.function.name='edit';assert.throws(()=>nativeResponseText(r,s,[call]),e=>e.diagnostic.reason==='native:call');
});
