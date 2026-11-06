import test from 'node:test';
import assert from 'node:assert/strict';
import {createStructuredGrammar,createStructuredSchema} from '../src/structured-grammar.ts';
const enc=new TextEncoder();
function accepts(format,text){const grammar=createStructuredGrammar(format),state=grammar.advance(grammar.initial,enc.encode(text));return !!state&&grammar.complete(state);}

test('grounded output decides evidence status and can cite only offered labels',async()=>{
 const format={type:'grounded-answer',sourceCount:2},schema=createStructuredSchema(format);
 assert.deepEqual(schema.required,['status','answer','sources']);
 assert.deepEqual(schema.properties.sources.items.enum,['S1','S2']);
 assert.equal(schema.properties.sources.uniqueItems,true);
 for(const reply of [{status:'answered',answer:'The locations differ.',sources:['S1','S2']},{status:'insufficient_evidence',answer:'No time is stated.',sources:[]}])assert.equal(accepts(format,JSON.stringify(reply)),true);
 for(const reply of [{answer:'missing status',sources:['S1']},{status:'saved',answer:'not an output status',sources:[]},{status:'answered',answer:'unknown label',sources:['S3']},{status:'answered',answer:'too many',sources:['S1','S2','S1']}])assert.equal(accepts(format,JSON.stringify(reply)),false);
 assert.equal(accepts({type:'grounded-answer',sourceCount:0},JSON.stringify({status:'answered',answer:'Checked calculation',sources:[]})),true);
 for(const sourceCount of [-1,65,1.5]){assert.throws(()=>createStructuredSchema({type:'grounded-answer',sourceCount}),/schema/);assert.throws(()=>createStructuredGrammar({type:'grounded-answer',sourceCount}),/schema/);}
 const {nativeOutputRequest}=await import('../src/native-output-format.ts');
 const native=nativeOutputRequest([{role:'system',content:'Use the source labels.'}],format);
 assert.equal(native.responseTool.name,'babelshelf_grounded');assert.deepEqual(native.responseTool.parameters,schema);
});

test('source-excerpt recovery can report missing evidence without enabling it for tool-code generation',async()=>{
 const format={type:'dialogue-answer',allowInsufficientEvidence:true};
 const schema=createStructuredSchema(format);
 assert.deepEqual(schema.properties.status,{type:'string',enum:['insufficient_evidence']});assert.deepEqual(schema.required,['answer']);assert.equal(schema.additionalProperties,false);
 for(const reply of [{answer:'Original excerpt'},{status:'insufficient_evidence',answer:'No time in these excerpts.'},{answer:'No time in these excerpts.',status:'insufficient_evidence'}])assert.equal(accepts(format,JSON.stringify(reply)),true);
 for(const reply of [{answer:'Done',status:'saved'},{answer:'No time',sources:[]},{answer:'No time',status:'insufficient_evidence',path:'Notes/new.md'}])assert.equal(accepts(format,JSON.stringify(reply)),false);
 assert.equal(accepts('dialogue-answer','{"status":"insufficient_evidence","answer":"missing"}'),false);
 const {nativeOutputRequest}=await import('../src/native-output-format.ts');
 const native=nativeOutputRequest([{role:'system',content:'Return a source excerpt or insufficient evidence.'}],format);
 assert.equal(native.responseTool.name,'babelshelf_answer');assert.deepEqual(native.responseTool.parameters.properties.status,schema.properties.status);
});

test('LFM JSON schema mirrors the scoped planner grammar and rejects undeclared actions/targets',()=>{
 const format={type:'dialogue-plan',scope:{inputs:false,file:true,current:true,historyCount:3,assistantIndices:[0,2]}};
 const schema=createStructuredSchema(format);
 assert.equal(schema.type,'object');assert.ok(Array.isArray(schema.anyOf));assert.ok(schema.anyOf.length>0);
 const branches=schema.anyOf;
 const find=(action,target)=>branches.some(branch=>branch.properties.action.enum.includes(action)&&(!target||branch.properties.target?.enum.includes(target)));
 assert.equal(find('chat'),true);assert.equal(find('read','file'),true);assert.equal(find('read','path'),true);
 assert.equal(find('recall','history'),true);assert.equal(find('read','knowledge'),false);assert.equal(find('delete'),false);
 const history=branches.find(branch=>branch.properties.action.enum.includes('recall')&&branch.properties.target?.enum.includes('history'));
 assert.deepEqual(history.properties.historyIndex,{type:'integer',minimum:0,maximum:2});
 assert.equal(history.additionalProperties,false);
 const answer=createStructuredSchema('dialogue-answer');assert.deepEqual(answer,{type:'object',properties:{answer:{type:'string'}},required:['answer'],additionalProperties:false});
});

test('sourced calculation uses an exact bounded schema for source and request operands',()=>{
 const format={type:'sourced-calculation',sourceCount:2},schema=createStructuredSchema(format),valid={operation:'divide',sourceOperandIndex:0,sourceIndex:1,sourceQuote:'七リットル',sourceUnit:'リットル',requestQuote:'3'};
 assert.equal(schema.additionalProperties,false);assert.deepEqual(schema.properties.operation.enum,['add','subtract','multiply','divide']);assert.deepEqual(schema.properties.sourceIndex,{type:'integer',minimum:0,maximum:1});
 assert.equal(accepts(format,JSON.stringify(valid)),true);assert.equal(accepts(format,JSON.stringify({...valid,sourceIndex:2})),false);assert.equal(accepts(format,JSON.stringify({...valid,sourceOperandIndex:2})),false);assert.equal(accepts(format,JSON.stringify({...valid,extra:'field'})),false);
 assert.throws(()=>createStructuredSchema({type:'sourced-calculation',sourceCount:0}),/schema/);assert.throws(()=>createStructuredGrammar({type:'sourced-calculation',sourceCount:9}),/schema/);
});

test('body-only capture is a complete new-text plan, never an attachment or historical selector',()=>{
 const scope={inputs:false,file:false,current:false,historyCount:0},format={type:'dialogue-plan',scope};
 assert.equal(accepts(format,JSON.stringify({action:'capture',body:'原文'})),true);
 assert.equal(accepts({type:'dialogue-plan',scope:{...scope,inputs:true}},JSON.stringify({action:'capture',body:'原文'})),false);
 for(const v of [{action:'capture'},{action:'capture',target:'current',body:'原文'},{action:'answer',body:'原文'}])assert.equal(accepts(format,JSON.stringify(v)),false);
});
test('new tool drafting is available only outside attachment and opened-file scopes',()=>{
 const request={action:'tool-create',query:'Search saved notes for a named person and return their phone number'};
 const base={inputs:false,file:false,current:false,historyCount:0};
 assert.equal(accepts({type:'dialogue-plan',scope:base},JSON.stringify(request)),true);
 assert.equal(accepts({type:'dialogue-plan',scope:{...base,inputs:true}},JSON.stringify(request)),false);
 assert.equal(accepts({type:'dialogue-plan',scope:{...base,file:true}},JSON.stringify(request)),false);
 assert.equal(accepts({type:'dialogue-plan',scope:base},JSON.stringify({...request,enabled:true})),false);
});

test('request scope excludes absent inputs/file/current/history while retaining new capture and exact paths',()=>{
 const format={type:'dialogue-plan',scope:{inputs:false,file:false,current:false,historyCount:0}};
 for(const value of [{action:'chat',query:''},{action:'capture',query:'',body:'New original'},{action:'read',query:'Home/a.md',target:'path'},{action:'search',query:'水',target:'knowledge'}])assert.equal(accepts(format,JSON.stringify(value)),true);
 for(const value of [{action:'summary',query:'',target:'inputs'},{action:'read',query:'',target:'file'},{action:'capture',query:'',target:'current'},{action:'recall',query:'',target:'history',historyIndex:0,historyPart:'user'}])assert.equal(accepts(format,JSON.stringify(value)),false);
 const inputs={type:'dialogue-plan',scope:{...format.scope,inputs:true}};
 assert.equal(accepts(inputs,JSON.stringify({action:'summary',query:'',target:'inputs'})),true);
 assert.equal(accepts(inputs,JSON.stringify({action:'summary',query:'',target:'knowledge'})),false);
});

test('history upper bounds reject observed nonexistent targets at decimal boundaries without enumerating turns',()=>{
 for(const count of [1,2,10,11,99,100,101,999,1000,Number.MAX_SAFE_INTEGER]){
  const format={type:'dialogue-plan',scope:{inputs:false,file:true,current:true,historyCount:count}};
  for(const index of [...new Set([0,count-1,Math.floor(count/2)])])assert.equal(accepts(format,JSON.stringify({action:'recall',query:'',target:'history',historyIndex:index,historyPart:'user'})),true,`${count}/${index}`);
  for(const index of [-1,count,count+1])assert.equal(accepts(format,JSON.stringify({action:'recall',query:'',target:'history',historyIndex:index,historyPart:'assistant'})),false,`${count}/${index}`);
 }
 assert.throws(()=>createStructuredGrammar({type:'dialogue-plan',scope:{inputs:false,file:false,current:false,historyCount:-1}}),/scope/);
 assert.throws(()=>createStructuredGrammar({type:'dialogue-plan',scope:{inputs:'true',file:false,current:false,historyCount:0}}),/scope/);
});

test('failed turns retain user originals but cannot be selected as nonexistent assistant answers',()=>{
 const format={type:'dialogue-plan',scope:{inputs:false,file:false,current:true,historyCount:4,assistantIndices:[0,2]}};
 for(const index of [0,1,2,3])for(const speaker of ['user','assistant'])assert.equal(accepts(format,JSON.stringify({action:'recall',query:'',target:'history',historyIndex:index,historyPart:speaker})),speaker==='user'||[0,2].includes(index));
 const none={type:'dialogue-plan',scope:{...format.scope,assistantIndices:[]}};
 assert.equal(accepts(none,JSON.stringify({action:'capture',query:'',target:'history',historyIndex:0,historyPart:'assistant'})),false);
 assert.throws(()=>createStructuredGrammar({type:'dialogue-plan',scope:{...format.scope,assistantIndices:[2,0]}}),/indices/);
});
test('planner grammar accepts actual scoped contracts and refuses invalid action/target structure',()=>{
 for(const value of [{action:'chat',query:''},{action:'read',query:'Notes/a.md',target:'path'},{action:'capture',query:'',body:'日本語とالعربية'},{action:'recall',query:'',target:'history',historyIndex:0,historyPart:'user'},{action:'summary',query:'',target:'inputs'}])assert.equal(accepts('dialogue-plan',JSON.stringify(value)),true);
 for(const value of [{action:'delete',query:''},{action:'chat',query:'',target:'file'},{action:'recall',query:'',target:'history'},{action:'capture',query:''}])assert.equal(accepts('dialogue-plan',JSON.stringify(value)),false);
});
test('grammar retains UTF8 across token boundaries and permits valid escaped JSON strings',()=>{
 const grammar=createStructuredGrammar('dialogue-answer'),bytes=enc.encode(JSON.stringify({answer:'水🙂 "quote"\nline'}));let state=grammar.initial;
 for(const byte of bytes){state=grammar.advance(state,new Uint8Array([byte]));assert.ok(state);}
 assert.equal(grammar.complete(state),true);assert.equal(accepts('dialogue-answer','{"answer":"bad\\x"}'),false);
 const prefix=grammar.advance(grammar.initial,enc.encode('{"answer":"'));assert.equal(grammar.advance(prefix,new Uint8Array([0xc0])),null);
});
test('incomplete or extended output cannot become a successful structured result',()=>{
 const grammar=createStructuredGrammar('dialogue-answer'),prefix=grammar.advance(grammar.initial,enc.encode('{"answer":"hello'));
 assert.ok(prefix);assert.equal(grammar.complete(prefix),false);
 assert.equal(accepts('dialogue-answer','{"answer":"hello"} prose'),false);assert.equal(accepts('dialogue-answer','{"answer":true}'),false);
 assert.throws(()=>createStructuredGrammar('arbitrary-code'),/format/);
});

test('planner grammar accepts insignificant JSON whitespace while retaining exact scoped fields',()=>{
 const format={type:'dialogue-plan',scope:{inputs:false,file:false,current:false,historyCount:0,assistantIndices:[]}};
 for(const text of [' { "action" : "chat" , "query" : "hello" }\n','{\n"action"\t:\t"calculate",\r\n"query":"(2 + 2)"\n}'])assert.equal(accepts(format,text),true,text);
 for(const text of ['{ "action":"delete", "query":"all" }','{ "action":"chat", "query":"", "target":"file" }','{ "action":"chat", "query":"", "extra":true }'])assert.equal(accepts(format,text),false,text);
});

test('JSON string controls and multilingual scalar values remain valid at every byte boundary',()=>{
 const text=Array.from({length:128},(_,i)=>String.fromCodePoint(i)).join('')+'日本語 العربية Ελληνικά 🙂';
 const grammar=createStructuredGrammar('dialogue-answer'),serialized=JSON.stringify({answer:text});let state=grammar.initial;
 for(const byte of enc.encode(serialized)){state=grammar.advance(state,Uint8Array.of(byte));assert.ok(state);}
 assert.equal(grammar.complete(state),true);assert.equal(JSON.parse(serialized).answer,text);
 const prefix=grammar.advance(grammar.initial,enc.encode('{"answer":"'));
 for(const invalid of [[0xed,0xa0,0x80],[0xf4,0x90,0x80,0x80],[0xe0,0x80,0x80],[0x80]])assert.equal(grammar.advance(prefix,Uint8Array.from(invalid)),null);
});

test('calculation is a targetless tool request and unavailable for current unread inputs',()=>{
 assert.equal(accepts('dialogue-plan',JSON.stringify({action:'calculate',query:'(1200+800)/4'})),true);
 assert.equal(accepts('dialogue-plan',JSON.stringify({action:'calculate',query:'2+3',target:'file'})),false);
 assert.equal(accepts({type:'dialogue-plan',scope:{inputs:true,file:false,current:false,historyCount:0}},JSON.stringify({action:'calculate',query:'2+3'})),false);
});

test('tool-call envelope exposes only the request-local registered IDs and stays strictly shaped',()=>{
 const base={inputs:false,file:false,current:false,historyCount:0,assistantIndices:[]},selected={type:'dialogue-plan',scope:{...base,toolIds:['memory.search','memory.read']}};
 const call={action:'tool',query:'memory.search',body:JSON.stringify({query:'meeting'})};
 assert.equal(accepts(selected,JSON.stringify(call)),true);
 assert.equal(accepts(selected,JSON.stringify({...call,query:'filesystem.delete'})),false);
 assert.equal(accepts(selected,JSON.stringify({...call,target:'file'})),false);
 assert.equal(accepts(selected,JSON.stringify({...call,extra:true})),false);
 assert.equal(accepts({type:'dialogue-plan',scope:base},JSON.stringify(call)),false);
 const schema=createStructuredSchema(selected),tool=schema.anyOf.find(branch=>branch.properties?.action?.enum?.[0]==='tool');
 assert.deepEqual(tool.properties.query.enum,['memory.search','memory.read']);assert.equal(tool.properties.body.type,'string');
 assert.throws(()=>createStructuredGrammar({type:'dialogue-plan',scope:{...base,toolIds:['memory.search','memory.search']}}),/planner tool IDs/i);
});
test('planner schema accepts the full configured tool catalog and rejects entries above the shared cap',()=>{
 const toolIds=['memory.search','memory.read','math.calculate',...Array.from({length:61},(_,index)=>`user.local-tool-${index}`)];
 const scope={inputs:false,file:false,current:false,historyCount:0,toolIds},format={type:'dialogue-plan',scope};
 const schema=createStructuredSchema(format),tool=schema.anyOf.find(branch=>branch.properties?.action?.enum?.[0]==='tool');
 assert.equal(tool.properties.query.enum.length,64);
 assert.equal(accepts(format,JSON.stringify({action:'tool',query:toolIds.at(-1),body:'{}'})),true);
 assert.throws(()=>createStructuredSchema({...format,scope:{...scope,toolIds:[...toolIds,'user.extra']}}),/planner tool IDs/i);
});
test('a multi-step local lookup can require the next registered tool without exposing one-shot actions',()=>{
 const base={inputs:false,file:false,current:false,historyCount:0,toolIds:['memory.search','memory.read'],requiredToolIds:['memory.search']},format={type:'dialogue-plan',scope:base};
 assert.equal(accepts(format,JSON.stringify({action:'tool',query:'memory.search',body:'{"query":"water"}'})),true);
 for(const value of [{action:'search',query:'water',target:'knowledge'},{action:'read',query:'Notes/water.md',target:'path'},{action:'answer',query:'water',target:'knowledge'},{action:'tool',query:'memory.read',body:'{"query":"Notes/water.md"}'}])assert.equal(accepts(format,JSON.stringify(value)),false,JSON.stringify(value));
 const afterSearch={...base,requiredToolIds:['memory.read']};
 assert.equal(accepts({type:'dialogue-plan',scope:afterSearch},JSON.stringify({action:'tool',query:'memory.read',body:'{"query":"Notes/water.md"}'})),true);
 assert.equal(accepts({type:'dialogue-plan',scope:afterSearch},JSON.stringify({action:'tool',query:'memory.search',body:'{"query":"water"}'})),false);
 assert.equal(accepts({type:'dialogue-plan',scope:{...base,requiredToolIds:undefined}},JSON.stringify({action:'answer',query:'water',target:'knowledge'})),true);
 assert.throws(()=>createStructuredGrammar({type:'dialogue-plan',scope:{...base,requiredToolIds:['filesystem.delete']}}),/required planner tool IDs/i);
});
test('after a required local search and read, the structured planner exposes only the final answer action',()=>{
 const scope={inputs:false,file:false,current:false,historyCount:0,toolIds:['memory.search','memory.read'],requiredActionIds:['answer']},format={type:'dialogue-plan',scope};
 assert.equal(accepts(format,JSON.stringify({action:'answer',query:'reserve',target:'knowledge'})),true);
 for(const value of [{action:'tool',query:'memory.search',body:'{"query":"reserve"}'},{action:'search',query:'reserve',target:'knowledge'},{action:'read',query:'Notes/water.md',target:'path'},{action:'capture',query:'reserve',body:'a guess'}])assert.equal(accepts(format,JSON.stringify(value)),false,JSON.stringify(value));
 const schema=createStructuredSchema(format);assert.deepEqual([...new Set(schema.anyOf.map(branch=>branch.properties.action.enum[0]))],['answer']);
 assert.throws(()=>createStructuredGrammar({type:'dialogue-plan',scope:{...scope,requiredActionIds:['tool']}}),/required planner action IDs/i);
});
