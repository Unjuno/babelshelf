import test from 'node:test';
import assert from 'node:assert/strict';
import {draftCustomToolPackage} from '../src/custom-tool-draft.ts';

const starterSchema={type:'object',required:['query'],additionalProperties:false,properties:{query:{type:'string',minLength:1,maxLength:2000}}};
const inner={id:'user.meeting-summary',title:'Meeting summary',instructions:'Find meeting notes and summarize their saved content.',inputSchema:starterSchema,code:'({ input }) => ({ query: input.query })',capabilities:[]};
function engine(response=JSON.stringify({answer:JSON.stringify(inner)}),overrides={}){
 const calls=[];
 return {calls,manifest:{contextTokens:4096},count:async(messages,format)=>{calls.push(['count',messages,format]);return {prompt_tokens:100};},generate:async(messages,maxTokens,format)=>{calls.push(['generate',messages,maxTokens,format]);return {text:response};},...overrides};
}

test('tool drafting reserves output from the selected context for a longer multilingual package',async()=>{
 const content={...inner,instructions:'日付を入力し、元の値を保持して形式を整える。'.repeat(80)};
 const local=engine(undefined,{count:async()=>({prompt_tokens:1200}),generate:async(messages,maxTokens,format)=>{
  assert.equal(format,'dialogue-answer');assert.ok(maxTokens>800,'A package must not be limited to the old short-answer budget');
  assert.ok(maxTokens+1200+160<=4096,'Counted prompt and template margin must fit');
  return {text:JSON.stringify({answer:JSON.stringify(content)})};
 }});
 const draft=await draftCustomToolPackage(local,'Create a date formatting tool with Japanese instructions');
 assert.equal(draft.instructions,content.instructions);
});

test('draft uses only the loaded local text engine and returns reviewed inert source files',async()=>{
 const local=engine();let inspected=0;
 const draft=await draftCustomToolPackage(local,'Summarize a local meeting note');
 assert.equal(draft.id,inner.id);assert.equal(draft.title,inner.title);assert.equal(draft.code,inner.code);
 assert.deepEqual(draft.capabilities,[]);assert.deepEqual(draft.inputSchema,starterSchema);assert.equal(draft.files[0].path,'Tools/user.meeting-summary/SKILL.md');assert.equal(draft.files[1].body,inner.code);
 assert.equal(local.calls.length,2);assert.equal(local.calls[0][2],'dialogue-answer');assert.ok(local.calls[1][2]>800&&local.calls[1][2]+100+160<=4096);assert.equal(local.calls[1][3],'dialogue-answer');
 assert.equal(inspected,0);
});

test('draft accepts only registered local calculator capability declarations',async()=>{
 const content={...inner,code:'({input,capabilities}) => capabilities.calculate(input.query)',capabilities:['math.calculate']};
 const local=engine(undefined,{generate:async()=>({text:JSON.stringify({answer:JSON.stringify(content)})})});
 const draft=await draftCustomToolPackage(local,'Create a local unit conversion helper using arithmetic');
 assert.deepEqual(draft.capabilities,['math.calculate']);
 assert.match(draft.files[0].body,/math\.calculate/);
});

test('draft can request bounded read-only Memory browsing when the workflow needs folder navigation',async()=>{
 const content={...inner,code:'({input,capabilities}) => capabilities.memoryList(input.query,0,10)',capabilities:['memory.list']};
 const local=engine(undefined,{generate:async()=>({text:JSON.stringify({answer:JSON.stringify(content)})})});
 const draft=await draftCustomToolPackage(local,'Browse immediate files in the requested Memory folder');
 assert.deepEqual(draft.capabilities,['memory.list']);
 assert.match(draft.files[0].body,/memory\.list/);
 assert.match(draft.files[1].body,/memoryList/);
});

test('draft supports validated structured arguments instead of a fixed query string',async()=>{
 const content={...inner,inputSchema:{type:'object',required:['expression','decimals'],additionalProperties:false,properties:{expression:{type:'string',minLength:1,maxLength:160},decimals:{type:'integer',minimum:0,maximum:6}}},code:'({input,capabilities})=>({result:capabilities.calculate(input.expression),decimals:input.decimals})',capabilities:['math.calculate']};
 const local=engine(undefined,{generate:async()=>({text:JSON.stringify({answer:JSON.stringify(content)})})});
 const draft=await draftCustomToolPackage(local,'Calculate a value with a selected number of decimals');
 assert.deepEqual(draft.inputSchema,content.inputSchema);assert.deepEqual(draft.files[0].body.includes('"decimals"'),true);
 const invalid=engine(undefined,{generate:async()=>({text:JSON.stringify({answer:JSON.stringify({...content,inputSchema:{...content.inputSchema,additionalProperties:true}})})})});
 await assert.rejects(draftCustomToolPackage(invalid,'Create a tool'),/Invalid tool draft/);
});

test('refuses an empty idea, context overflow, malformed envelope and invalid tool draft without retrying',async()=>{
 const normal=engine();await assert.rejects(draftCustomToolPackage(normal,'  '),/Describe the tool/);assert.equal(normal.calls.length,0);
 const overflow=engine(undefined,{count:async()=>({prompt_tokens:4000})});await assert.rejects(draftCustomToolPackage(overflow,'make a tool'),/context limit/);
 const invalid=engine(JSON.stringify({answer:JSON.stringify({...inner,id:'../../escape'})}));await assert.rejects(draftCustomToolPackage(invalid,'make a tool'),/Invalid tool draft/);assert.equal(invalid.calls.length,2);
 const malformed=engine('{"answer":"not json"}');await assert.rejects(draftCustomToolPackage(malformed,'make a tool'),/Invalid tool draft/);
});
