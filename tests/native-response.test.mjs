import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeResponseTools,nativeResponseText} from '../dist/native-response.js';
const spec={name:'babelshelf_answer',parameters:{type:'object',properties:{answer:{type:'string'}},required:['answer'],additionalProperties:false}};
const call={id:'call_test',type:'function',function:{name:spec.name,arguments:{answer:'A source-grounded answer'}}};
const raw=()=>({finish_reason:'tool_calls',message:{role:'assistant',content:'',tool_calls:[structuredClone(call)]}});
test('a single expected typed response becomes JSON without executing anything',()=>{
 assert.equal(nativeResponseTools(spec)[0].function.name,spec.name);assert.deepEqual(JSON.parse(nativeResponseText(raw(),spec,[call])),call.function.arguments);
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
