import test from 'node:test';
import assert from 'node:assert/strict';
import {createResolvedActions} from '../src/resolved-actions.ts';
import * as application from '../src/resolved-actions.ts';
import {prepareOriginal,originalNote} from '../src/original-assets.ts';
import {makeVisionText,visionTextNote} from '../src/vision-text.ts';
import {visionManifest} from '../src/vision-assets.ts';

async function visionFixture(){
 const question='What code is in this image? Reply with the code only.';
 const asset=await prepareOriginal(new File(['synthetic image bytes'],'image.png',{type:'image/png'}),'image-original');
 const value=makeVisionText(asset,{model:visionManifest.id,revision:visionManifest.revision,runtime:visionManifest.runtime,prompt:question,text:'MAPLE-6381',width:960,height:320});
 const note=visionTextNote('image-reading',asset,value),records=[originalNote(asset),note],readings=[{kind:'vision',noteId:note.id,revision:1}],events=[];
 const dependencies={store:{all:async()=>records},check:()=>{},trace:async(tool,input,work)=>{events.push({tool,input});return work();}};
 return {question,note,records,readings,events,dependencies};
}

test('a single current image answer is reused unchanged with its actual model and original-linked revision',async()=>{
 assert.equal(typeof application.answerCurrentVisionInput,'function');const f=await visionFixture(),before=structuredClone(f.records);
 const answer=await application.answerCurrentVisionInput(f.dependencies,f.question,f.readings);
 assert.equal(answer.answer,'MAPLE-6381');assert.equal(answer.model.id,visionManifest.id);assert.equal(answer.model.revision,visionManifest.revision);
 assert.deepEqual(answer.sources,[{noteId:f.note.id,revision:1,start:0,end:10,quote:'MAPLE-6381',title:'image.png · image notes'}]);
 assert.deepEqual(f.events.map(event=>event.tool),['knowledge.answer']);assert.equal(f.events[0].input.execution,'current-vision-result');assert.deepEqual(f.records,before);
});

test('Vision reuse cannot answer a different prompt, merge files, use edited text or a withdrawn original',async()=>{
 assert.equal(typeof application.answerCurrentVisionInput,'function');const f=await visionFixture();
 assert.equal(await application.answerCurrentVisionInput(f.dependencies,'What else is shown?',f.readings),null);
 assert.equal(await application.answerCurrentVisionInput(f.dependencies,f.question,[...f.readings,...f.readings]),null);
 f.records[1]={...f.note,mediaSource:undefined,visionText:{...f.note.visionText,original:undefined}};
 await assert.rejects(application.answerCurrentVisionInput(f.dependencies,f.question,f.readings),/Source changed/);
 f.records[1]={...f.note,revisions:[{...f.note.revisions[0],body:'Changed after recognition'}]};
 await assert.rejects(application.answerCurrentVisionInput(f.dependencies,f.question,f.readings),/Source changed/);
 f.records[1]=f.note;f.records[0]={...f.records[0],state:'withdrawn'};
 await assert.rejects(application.answerCurrentVisionInput(f.dependencies,f.question,f.readings),/Source changed/);
});

test('Vision reuse revalidates the source at delivery and observes Stop without generating or writing',async()=>{
 assert.equal(typeof application.answerCurrentVisionInput,'function');const f=await visionFixture();let reads=0;
 f.dependencies.store.all=async()=>{if(++reads===2)return [{...f.records[0],state:'withdrawn'},f.note];return f.records;};
 await assert.rejects(application.answerCurrentVisionInput(f.dependencies,f.question,f.readings),/Source changed/);
 f.dependencies.check=()=>{throw Error('Stopped');};await assert.rejects(application.answerCurrentVisionInput(f.dependencies,f.question,f.readings),/Stopped/);
});

const context={summary:'',recent:[],refs:[]};
function fixture(overrides={}){
 const events=[];
 const check=()=>{};
 const engine={loaded:'test',assets:{},manifest:{contextTokens:2048,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>{throw Error('Unexpected inference');}};
 const store={all:async()=>{throw Error('Unexpected Memory enumeration');},search:async query=>{events.push(query);return [];}};
 const trace=async(tool,input,work)=>work();
 const registry={identity:async()=>({}),run:(id,args,host)=>id==='memory.search'?host.search(args.query):host.resolve(args.query)};
 return {events,engine,store,actions:createResolvedActions({store,engine,model:'test',question:'Find meeting',check,trace,registry,snapshot:async()=>[],...overrides})};
}

test('generated answer activity retains measured inference only and leaves answer bytes in the dialogue result',async()=>{
 let savedActivity;
 const trace=async(tool,input,work,project=value=>value)=>{const result=await work();if(tool==='knowledge.answer')savedActivity={input,output:project(result)};return result;};
 const f=fixture({trace});f.engine.generate=async()=>({text:'A private answer body.',outputTokens:7,metrics:{runtimePromptTokens:44,countMs:2.5}});
 const result=await f.actions.answer({model:'test',question:'Say hello.',mode:'chat',scope:{kind:'conversation'}});
 assert.equal(result.answer,'A private answer body.');assert.equal('inference' in result,false);
 assert.equal(savedActivity.output.sourceCount,0);assert.deepEqual(savedActivity.output.inference.measuredModelCalls,1);
 assert.equal(savedActivity.output.inference.promptTokens,44);assert.equal(savedActivity.output.inference.outputTokens,7);
 assert.ok(savedActivity.output.inference.countMs>=2.5);assert.ok(savedActivity.output.inference.generationWallMs>0);
 assert.equal(JSON.stringify(savedActivity.output).includes(result.answer),false);assert.equal('sources' in savedActivity.output,false);
});

test('Application explicit search preserves fallback and never starts a model or writes',async()=>{
 const {actions,events}=fixture();const result=await actions.search('meeting');
 assert.deepEqual(events,['meeting','Find meeting']);assert.equal(result.kind,'search');assert.equal(result.status,'No matching notes');assert.deepEqual(result.files,[]);
});

test('model-selected search resolves the full requested outcome before ending at a list',async()=>{
 const hit={noteId:'meeting',revision:3,start:0,end:6,quote:'北口で集合。',title:'Notes/meeting.md',score:1};
 const {engine}=fixture();let messages;
 engine.generate=async m=>{messages=m;return {text:'{"completion":"answer"}'};};
 const {actions}=fixture({engine,question:'集合場所について保存したメモを探して、今の集合場所を教えて。',store:{search:async()=>[hit]}});
 const result=await actions.search('集合場所',{complete:true});
 assert.equal(result.kind,'continue');assert.equal(result.action,'answer');assert.equal(result.query,'集合場所');
 assert.equal(messages.at(-1).content,'集合場所について保存したメモを探して、今の集合場所を教えて。');
 for(const completion of ['summary','search']){
  engine.generate=async()=>({text:JSON.stringify({completion})});
  const next=await actions.search('集合場所',{complete:true});assert.equal(next.kind,completion==='search'?'search':'continue');
 }
 engine.generate=async()=>({text:'{"completion":"delete"}'});
 await assert.rejects(actions.search('集合場所',{complete:true}),/Invalid search completion/);
 engine.generate=async()=>({text:'{"completion":"answer"}',stopped:true});
 await assert.rejects(actions.search('集合場所',{complete:true}),/Stopped/);
});

test('an empty or navigation-only search does not start an answer or reinterpret file metadata as evidence',async()=>{
 const {engine}=fixture();let generated=0;engine.generate=async()=>{generated++;throw Error('Unexpected classification');};
 for(const results of [[],[{kind:'file',noteId:'binary',revision:1,path:'Files/video.mp4'}]]){
  const {actions}=fixture({engine,store:{search:async()=>results}});
  assert.equal((await actions.search('video',{complete:true})).kind,'search');
 }
 assert.equal(generated,0);
});

test('Application explicit saved-file read returns navigation data and exact source pins without inference',async()=>{
 const body='The meeting starts at 14:30.',note={id:'meeting',version:2,path:'Notes/meeting.md',body};
 const hit={noteId:note.id,revision:2,start:0,end:body.length,quote:body,title:'Meeting',score:1};
 const {actions}=fixture({store:{search:async()=>[hit]},snapshot:async()=>[note]});
 const result=await actions.read('meeting',{explicitSavedOpen:true,literalRead:true});
 assert.equal(result.kind,'open');assert.equal(result.noteId,note.id);assert.equal(result.path,note.path);assert.equal(result.refs[0].revision,2);assert.equal(result.refs[0].quote,body);
});

test('Application schedule clarification returns data without saving or enabling a task',async()=>{
 const {engine}=fixture();engine.generate=async()=>({text:JSON.stringify({action:'clarify',question:'What time?'})});
 const {actions}=fixture({engine});assert.deepEqual(await actions.schedule(context),{kind:'clarify',question:'What time?'});
});

test('Application conversation answer skips Memory, uses the same generated bytes, and rejects a stopped result',async()=>{
 const {engine}=fixture();let stopped=false;
 engine.generate=async()=>({text:'A quiet morning.',finishReason:'stop'});
 const {actions}=fixture({engine,check:()=>{if(stopped)throw Error('Stopped');}});
 const request={model:'test',question:'Write a sentence.',mode:'chat',scope:{kind:'conversation'},context};
 const result=await actions.answer(request);assert.equal(result.kind,'answer');assert.equal(result.answer,'A quiet morning.');assert.deepEqual(result.sources,[]);
 engine.generate=async()=>{stopped=true;return {text:'Late answer',finishReason:'stop'};};
 await assert.rejects(actions.answer(request),/Stopped/);
});

test('Application rejects malformed external scopes before reading Memory or loading a model',async()=>{
 const {actions}=fixture();
 await assert.rejects(actions.answer({model:'test',question:'Read this.',mode:'answer',scope:{kind:'file',file:{noteId:'x',revision:1},readings:[]}}),/Conflicting input scopes/);
 await assert.rejects(actions.answer({model:'test',question:'Read this.',mode:'answer',scope:{kind:'attachments',readings:[]}}),/Conflicting input scopes/);
});
