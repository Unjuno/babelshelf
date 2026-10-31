import {originalNote} from '../src/original-assets.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {executeSubmission} from '../src/submission-workflow.ts';
import {createSubmissionController} from '../src/submission-controller.ts';
import {createToolRegistry} from '../src/tools/tool-registry.ts';
import {definition,run as calculate} from '../src/tools/math.calculate/tool.ts';
import {emptyDialogue,completeTurn,validateDialogue} from '../src/conversation.ts';
import {createNote,reviseNote,searchNotes} from '../../../dist/core.js';
import {definition as searchDefinition,run as searchRun} from '../src/tools/memory.search/tool.ts';
import {definition as readDefinition,run as readRun} from '../src/tools/memory.read/tool.ts';
import {KnowledgeStore,projectNote} from '../src/knowledge-store.ts';
import {createLfmTextRuntime} from '../src/lfm-text-runtime.ts';
import * as clock from '../src/tools/time.now/tool.ts';
import * as sourceTool from '../src/tools/memory.sources/tool.ts';
import {searchStoredPageChecked} from '../src/file-discovery.ts';
function fixture(){
 let dialogue=emptyDialogue();const events=[],reviews=[];let modelCalls=0;
 const services={
  knowledge:{},builtinToolPackages:[],builtinToolRegistry:createToolRegistry([{definition,entry:'Tools/math.calculate/tool.ts',sources:[{path:'Tools/math.calculate/SKILL.md',body:'Calculate locally.'},{path:'Tools/math.calculate/tool.ts',body:'Bounded calculator'}],run:calculate}]),bonsai:{manifest:{models:[],runtime:{revision:'test-runtime'}},loaded:'',assets:{},load:async()=>{modelCalls++;throw Error('Unexpected model');}},
  decision:{identity:{model:'',revision:'test-decision'},enabled:false,ready:false},ocr:{ready:false},speech:{ready:false,transcribe:async()=>{throw Error('Unexpected speech');}},vision:{describe:async()=>{throw Error('Unexpected vision');}},
  ocrModel:'',ocrLanguage:'eng',speechModel:'',visionModel:'',visionAvailable:false,model:'',decisionModel:'',
  modelPreferences:{transcriptionLanguage:'auto',customSpeechModels:[],customVisionModels:[],customDecisionModels:[]},harnessPreferences:{replyStyle:'balanced',userGuidance:''},activeHarnessProfile:{id:'test-profile',label:'Test',enabledTools:[],maxToolCalls:4,maxResultChars:10000},settingsRevisions:{models:12,harness:8},connectionPreferences:{diagnosticLogs:false},
  diagnostics:{getItem:()=>null,setItem:()=>{}},
  currentDialogue:()=>dialogue,storedDialogue:()=>dialogue,settled:async()=>{},flushStorage:async()=>{},refreshStorage:async()=>{},refreshSnapshot:async()=>[],
  saveDialogue:async next=>{validateDialogue(next);dialogue=next;events.push('save');},finishTurn:async(id,result)=>{dialogue=completeTurn(dialogue,id,result);},
  ensureProductRuntime:async()=>{throw Error('Unexpected acquisition');},traceProcessing:async()=>{throw Error('Unexpected processing');},
 };
 const view={adopt:()=>{},consume:()=>events.push('consume'),composer:()=>({text:'',attachments:[]}),restore:()=>{},toast:message=>events.push(message),failure:message=>events.push(message),openNote:()=>{},saveCapture:async value=>{reviews.push(value);await services.finishTurn(value.turnId,{status:'Review new note'});},reviewCorrection:()=>{},reviewSchedule:()=>{},startToolPackageFromChat:()=>{}};
 return {services,view,events,reviews,current:()=>dialogue,modelCalls:()=>modelCalls};
}

test('source metadata is passed to the final answer commit after agent inspection',async()=>{
 for(const stale of [false,true]){
 const f=fixture(),c=createSubmissionController(),original=createNote({path:'Inbox/original.md',body:'Water 17'}),ref={noteId:original.id,revision:1,start:0,end:8,quote:'Water 17'},summary=createNote({path:'Inbox/summary.md',body:'Summary',kind:'generated',sources:[ref]}),records=[original,summary],guards=[];
 const pkg={definition:sourceTool.definition,entry:'Tools/memory.sources/tool.ts',sources:[{path:'Tools/memory.sources/SKILL.md',body:'Inspect sources.'},{path:'Tools/memory.sources/tool.ts',body:'Trusted source metadata.'}],run:sourceTool.run};
 f.services.builtinToolPackages=[pkg];f.services.builtinToolRegistry=createToolRegistry([pkg]);f.services.activeHarnessProfile={...f.services.activeHarnessProfile,enabledTools:['memory.sources'],maxToolCalls:null,maxResultChars:8000};
 f.services.knowledge={all:async()=>records,getState:async()=>undefined,views:async()=>records.map(projectNote),search:async()=>[]};f.services.refreshSnapshot=async()=>records.map(projectNote);
 const finish=f.services.finishTurn;f.services.finishTurn=async(id,result,refs,metadata)=>{if(metadata?.length){guards.push(structuredClone(metadata));if(stale)throw Error('Source changed · retry');}return finish(id,result,refs,metadata);};
 f.services.model='test';let calls=0;f.services.bonsai={plannerProtocol:'native-tool-calls',loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:8192,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>({text:JSON.stringify(++calls===1?{action:'tool',query:'memory.sources',body:JSON.stringify({id:summary.id,revision:1})}:{action:'answer',query:'sources',target:'knowledge',reply:{status:'answered',answer:'The summary has one source.',sources:[]}}),finishReason:'stop'})};
 await c.run(run=>executeSubmission({text:'Inspect the source details for '+summary.id,attachments:[]},f.services,f.view,run));
 assert.equal(guards.length,1,JSON.stringify({state:c.state,turn:f.current().turns.at(-1)}));assert.equal(guards[0][0].noteId,summary.id);assert.equal(guards[0][0].revision,1);assert.match(guards[0][0].snapshot,/^[a-f0-9]{64}$/);
 if(stale){assert.equal(c.state.phase,'failed');assert.equal(f.current().turns.at(-1).answer,undefined);assert.equal(f.reviews.length,0);}else assert.equal(c.state.phase,'completed');
 }
});

test('a selected device clock reaches the final answer through the submission flow',async()=>{
 const f=fixture(),c=createSubmissionController(),seen=[];
 const pkg={definition:clock.definition,entry:'Tools/time.now/tool.ts',sources:[{path:'Tools/time.now/SKILL.md',body:'Read the device clock.'},{path:'Tools/time.now/tool.ts',body:'Trusted local clock.'}],run:clock.run};
 f.services.builtinToolPackages=[pkg];f.services.activeHarnessProfile={...f.services.activeHarnessProfile,enabledTools:['time.now'],maxResultChars:8000};
 f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async messages=>{seen.push(JSON.stringify(messages));if(seen.length===1)return {text:JSON.stringify({action:'tool',query:'time.now',body:'{}'})};if(seen.length===2)return {text:JSON.stringify({action:'answer',query:'What time is it?',target:'knowledge'})};return {text:JSON.stringify({answer:'Device time noted.',citations:[]}),finishReason:'stop'};},load:async()=>{throw Error('Already loaded');}};
 f.services.knowledge={all:async()=>[],views:async()=>[],search:async()=>[],getState:async()=>[]};
 assert.equal(await c.run(run=>executeSubmission({text:'What time is it?',attachments:[]},f.services,f.view,run)),'completed',c.state.error);
 assert.match(seen.at(-1),/device-clock/);assert.equal(f.current().turns.at(-1).answer,'Device time noted.');assert.deepEqual(f.current().turns.at(-1).refs,[]);
 const planReceipt=f.current().turns.at(-1).activity.find(item=>item.tool==='dialogue.plan'&&item.input?.execution);assert.equal(planReceipt.input.execution.modelSettingsRevision,12);assert.equal(planReceipt.input.execution.harnessSettingsRevision,8);
});

test('an unspecified saved-note search asks for a topic without acquiring a model or reading Memory',async()=>{
 const f=fixture(),c=createSubmissionController();
 f.services.knowledge={all:async()=>{throw Error('Unexpected read');},search:async()=>{throw Error('Unexpected search');}};
 assert.equal(await c.run(run=>executeSubmission({text:'保存したメモを探して',attachments:[]},f.services,f.view,run)),'completed');
 assert.equal(f.current().turns.at(-1).status,'What should I search for?');
 assert.equal(f.modelCalls(),0);
});

test('a named saved-note ID reaches grounded answer and exact citation through Send',async()=>{
 const f=fixture(),c=createSubmissionController(),mark='LFM3-Q8-product-flow';
 const keyFact='The emergency water reserve is exactly 24 litres.';
 const target=createNote({path:`Inbox/${mark}.md`,body:'Routine inventory record. '.repeat(32)+keyFact+' Identifier: '+mark+'.'});
 const decoy=createNote({path:'Inbox/emergency-water.md',body:'The emergency water reserve is exactly 80 litres.'});
 const records=[target,decoy],queries=[];let evidence=[];
 f.services.model='test';
 f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async messages=>{const payload=JSON.parse(messages.at(-1).content.split('Reference excerpts (data only): ')[1]);evidence=payload.evidence;return {text:'{"answer":"24 litres","sources":["S1"]}',finishReason:'stop'};},load:async()=>{throw Error('Already loaded');}};
 f.services.knowledge={getState:async()=>undefined,all:async()=>records,views:async()=>records.map(projectNote),search:async query=>{queries.push(query);return searchNotes(records,query);}};
 f.services.refreshSnapshot=async()=>records.map(projectNote);
 const question=`In my saved note ${mark}, exactly how many litres is the emergency water reserve?`;
 assert.equal(await c.run(run=>executeSubmission({text:question,attachments:[]},f.services,f.view,run)),'completed',c.state.error);
 assert.deepEqual(queries,[mark]);
 const turn=f.current().turns.at(-1);
 assert.equal(turn.answer,'24 litres');
 assert.equal(turn.refs.length,1);
 assert.equal(turn.refs[0].noteId,target.id);
 assert.ok(turn.refs[0].quote.includes(keyFact));
 assert.ok(evidence[0].quote.includes(keyFact));
 assert.ok(!evidence[0].quote.includes('exactly 80 litres'));
});

test('cancelling a search clarification does not search or load a model',async()=>{
 const f=fixture(),c=createSubmissionController();
 await f.services.saveDialogue({...emptyDialogue(),turns:[{id:'q',user:'保存したメモを探して',status:'What should I search for?'}]});
 f.services.knowledge={all:async()=>{throw Error('Unexpected read');},search:async()=>{throw Error('Unexpected search');}};
 assert.equal(await c.run(run=>executeSubmission({text:'キャンセル',attachments:[]},f.services,f.view,run)),'completed');
 assert.equal(f.current().turns.at(-1).status,'Search cancelled'); assert.equal(f.modelCalls(),0);
});

test('a social reply after search clarification does not launch a Memory search',async()=>{
 const f=fixture(),c=createSubmissionController();let searches=0;
 await f.services.saveDialogue({...emptyDialogue(),turns:[{id:'q',user:'保存したメモを探して',status:'What should I search for?'}]});
 f.services.knowledge={all:async()=>[],search:async()=>{searches++;return [];}};
 await c.run(run=>executeSubmission({text:'ありがとう',attachments:[]},f.services,f.view,run));
 assert.equal(searches,0);
});

test('thanks after clarification generates from the recent turn without planning or compaction',async()=>{
 const f=fixture(),c=createSubmissionController(),old={id:'old',user:'UNRELATED PRIVATE HISTORY',answer:'Older answer'},recent={id:'q',user:'保存したメモを探して',status:'What should I search for?'};
 await f.services.saveDialogue({...emptyDialogue(),turns:[old,recent]}); let generations=0;
 f.services.model='test'; f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async messages=>{const input=JSON.stringify(messages);assert.doesNotMatch(input,/UNRELATED PRIVATE HISTORY/);assert.match(input,/What should I search for/);return {prompt_tokens:100};},generate:async messages=>{generations++;assert.doesNotMatch(JSON.stringify(messages),/UNRELATED PRIVATE HISTORY/);return {text:'どういたしまして。',finishReason:'stop'};},load:async()=>{throw Error('Already loaded');}};
 f.services.decision={...f.services.decision,enabled:true,ready:true,loaded:false,busy:false,load:async()=>{throw Error('Unexpected decision');}};
 f.services.knowledge={all:async()=>{throw Error('Unexpected Memory read');},search:async()=>{throw Error('Unexpected search');}};
 assert.equal(await c.run(run=>executeSubmission({text:'ありがとう',attachments:[]},f.services,f.view,run)),'completed',c.state.error);
 assert.equal(generations,1);assert.equal(f.current().turns.at(-1).answer,'どういたしまして。');assert.deepEqual(f.current().turns.slice(0,2),[old,recent]);
 assert.equal(f.current().turns.at(-1).activity.some(a=>a.tool==='dialogue.compact'||a.tool==='dialogue.plan'),false);
});

test('saved-file correction searches canonical Memory before proposing changes, without using unrelated dialogue or pinned files',async()=>{
 const f=fixture(),c=createSubmissionController(),target=createNote({path:'Notes/meeting.md',body:'Bring water.'}),other=createNote({path:'Notes/other.md',body:'Unrelated file'}),records=[target,other],before=structuredClone(records),proposals=[],prompts=[];
 await f.services.saveDialogue({...emptyDialogue(),turns:[{id:'old',user:'UNRELATED-OLD-REQUEST',answer:'UNRELATED-OLD-ANSWER'}],compaction:{through:1,summary:'UNRELATED-SUMMARY'},currentFile:{noteId:other.id,revision:1},currentResult:{turnId:'old'}});const prior=structuredClone(f.current());
 const responses=[JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'meeting'})}),JSON.stringify({action:'edit',query:'Notes/meeting.md',target:'path'}),JSON.stringify({action:'replace',find:'water',with:'tea'})];
 f.services.model='test';f.services.bonsai={loaded:'test',assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async messages=>{prompts.push(messages);assert.doesNotMatch(JSON.stringify(messages),/UNRELATED-|Unrelated file/);return {text:responses.shift(),finishReason:'stop'};}};
 f.services.knowledge={getState:async()=>undefined,all:async()=>records,search:async query=>{assert.equal(query,'meeting');return [{noteId:target.id,revision:1,start:0,end:11,quote:'Bring water',title:'Notes/meeting.md'}];}};
 f.services.builtinToolPackages=[{definition:searchDefinition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search local Memory'},{path:'Tools/memory.search/tool.ts',body:'Trusted search adapter'}],run:searchRun}];f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:['memory.search'],maxToolCalls:3,maxResultChars:8000};f.view.reviewCorrection=proposal=>proposals.push(proposal);
 assert.equal(await c.run(run=>executeSubmission({text:'Could you replace water with tea in my saved meeting note?',attachments:[]},f.services,f.view,run)),'awaitingApproval',JSON.stringify({state:c.state,events:f.events,prompts:prompts.length}));assert.equal(prompts.length,3);assert.equal(proposals.length,1);assert.equal(proposals[0].path,'Notes/meeting.md');assert.equal(proposals[0].before,'Bring water.');assert.equal(proposals[0].after,'Bring tea.');assert.deepEqual(records,before);assert.deepEqual(f.current().currentFile,prior.currentFile);assert.deepEqual(f.current().compaction,prior.compaction);assert.deepEqual(f.current().turns[0],prior.turns[0]);assert.equal(f.current().turns.at(-1).activity.some(a=>a.tool==='dialogue.compact'),false);
});

test('native tool protocol discovers a note and stages its correction without writing',async()=>{
 const f=fixture(),c=createSubmissionController(),note=createNote({path:'Notes/meeting.md',body:'Bring water.'}),before=structuredClone(note),proposals=[];
 const adapter={loaded:'test',nativeToolCalls:true,supportsExactCount:true,maxReplyTokens:3072,abort(){},async count(){return 100;},async generate(_messages,options){
  if(options.tools){const offered=options.tools.map(tool=>tool.function.name);if(!this.searched){this.searched=true;assert.ok(offered.includes('memory.search'));return {text:'Searching.',assistantContent:'Searching.',toolCalls:[{id:'search-1',name:'memory.search',arguments:{query:'meeting'}}],finishReason:'stop'};}assert.ok(offered.includes('finish_edit'));return {text:'',toolCalls:[{id:'edit-1',name:'finish_edit',arguments:{query:'Notes/meeting.md',target:'path'}}],finishReason:'stop'};}
  return {text:JSON.stringify({action:'replace',find:'water',with:'tea'}),finishReason:'stop'};
 }};
 const manifest={contextTokens:4096,runtime:{revision:'test'},models:[{id:'test',revision:'test',contextTokens:4096,file:{name:'test.gguf',bytes:1}}]};
 f.services.model='test';f.services.bonsai=createLfmTextRuntime({adapter,manifest,readFile:async()=>new Blob(['x']),readAssets:()=>({test:{filesPresent:true}})});
 f.services.knowledge={getState:async()=>undefined,all:async()=>[note],views:async()=>[],search:async()=>[{noteId:note.id,revision:1,start:0,end:11,quote:'Bring water',title:'Notes/meeting.md'}]};
 f.services.builtinToolPackages=[{definition:searchDefinition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search local Memory'},{path:'Tools/memory.search/tool.ts',body:'Trusted search adapter'}],run:searchRun}];f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:['memory.search'],maxToolCalls:3,maxResultChars:8000};f.view.reviewCorrection=proposal=>proposals.push(proposal);
 assert.equal(await c.run(run=>executeSubmission({text:'Could you replace water with tea in my saved meeting note?',attachments:[]},f.services,f.view,run)),'awaitingApproval',JSON.stringify(c.state));
 assert.equal(proposals.length,1);assert.equal(proposals[0].after,'Bring tea.');assert.deepEqual(note,before);
});

test('a paged discovery can stage an exact second-page correction without changing originals',async()=>{
 const f=fixture(),c=createSubmissionController(),proposals=[];
 const notes=Array.from({length:15},(_,i)=>createNote({title:`meeting ${i}`,path:`Notes/meeting-${i}.md`,body:'Bring water.'})),before=structuredClone(notes);
 const first=searchStoredPageChecked(notes,'meeting',{offset:0,limit:12}),second=searchStoredPageChecked(notes,'meeting',{offset:12,limit:12,snapshot:first.snapshot}),target=second.hits[0].path;
 const adapter={loaded:'test',nativeToolCalls:true,supportsExactCount:true,maxReplyTokens:3072,abort(){},async count(){return 100;},async generate(_messages,options){
  if(options.tools){this.step=(this.step??0)+1;if(this.step===1)return {text:'',toolCalls:[{id:'first',name:'memory.search',arguments:{query:'meeting',offset:0}}],finishReason:'stop'};if(this.step===2)return {text:'',toolCalls:[{id:'second',name:'memory.search',arguments:{query:'meeting',offset:12,snapshot:first.snapshot}}],finishReason:'stop'};return {text:'',toolCalls:[{id:'edit',name:'finish_edit',arguments:{query:target,target:'path'}}],finishReason:'stop'};}
  return {text:JSON.stringify({action:'replace',find:'water',with:'tea'}),finishReason:'stop'};
 }};
 const manifest={contextTokens:8192,runtime:{revision:'test'},models:[{id:'test',revision:'test',contextTokens:8192,file:{name:'test.gguf',bytes:1}}]};
 f.services.model='test';f.services.bonsai=createLfmTextRuntime({adapter,manifest,readFile:async()=>new Blob(['x']),readAssets:()=>({test:{filesPresent:true}})});
 f.services.knowledge={getState:async()=>undefined,all:async()=>notes,views:async()=>notes.map(projectNote),search:async()=>[],searchPage:async(query,options)=>searchStoredPageChecked(notes,query,options)};
 f.services.builtinToolPackages=[{definition:searchDefinition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search local Memory'},{path:'Tools/memory.search/tool.ts',body:'Trusted search adapter'}],run:searchRun}];f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:['memory.search'],maxToolCalls:4,maxResultChars:8000};f.view.reviewCorrection=proposal=>proposals.push(proposal);
 assert.equal(await c.run(run=>executeSubmission({text:'Please find my meeting note and replace water with tea.',attachments:[]},f.services,f.view,run)),'awaitingApproval',JSON.stringify(c.state));
 assert.equal(proposals.length,1);assert.equal(proposals[0].path,target);assert.equal(proposals[0].after,'Bring tea.');assert.deepEqual(notes,before);
});

test('discovered corrections revalidate canonical identity and revision before proposal generation',async()=>{
 for(const mismatch of ['revision','identity']){
  const f=fixture(),c=createSubmissionController(),note=createNote({path:'Notes/meeting.md',body:'Bring water.'}),other=createNote({path:'Notes/other.md',body:'Do not change.'});
  const records=[mismatch==='revision'?reviseNote(note,{body:'Newer original'},1):note,other],before=structuredClone(records);let generated=0;
  const plans=[JSON.stringify({action:'tool',query:'memory.search',body:'{"query":"meeting"}'}),JSON.stringify({action:'edit',query:'Notes/meeting.md',target:'path'})];
  f.services.model='test';f.services.bonsai={loaded:'test',assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>{generated++;assert.ok(plans.length,'No correction generation after stale discovery');return {text:plans.shift(),finishReason:'stop'};}};
  f.services.knowledge={getState:async()=>undefined,all:async()=>records,search:async()=>[{kind:'file',noteId:mismatch==='identity'?other.id:note.id,revision:1,path:'Notes/meeting.md'}]};
  f.services.builtinToolPackages=[{definition:searchDefinition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search local Memory'},{path:'Tools/memory.search/tool.ts',body:'Trusted adapter'}],run:searchRun}];f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:['memory.search'],maxToolCalls:3,maxResultChars:8000};
  assert.equal(await c.run(run=>executeSubmission({text:'Could you replace water with tea in my saved meeting note?',attachments:[]},f.services,f.view,run)),'failed');assert.match(c.state.error,/changed/i);assert.equal(generated,2);assert.deepEqual(records,before);assert.equal(f.reviews.length,0);
 }
});

test('quoted named corrections can reach exact review with no prepared model, without writing knowledge',async()=>{
 const f=fixture(),c=createSubmissionController(),note=createNote({path:'Notes/packing.md',body:'水と懐中電灯。'}),before=structuredClone(note),proposals=[];
 f.services.knowledge={getState:async()=>undefined,all:async()=>[note],search:async query=>{assert.equal(query,'荷物');return [{kind:'file',noteId:note.id,revision:1,path:'Notes/packing.md'}];}};f.view.reviewCorrection=p=>proposals.push(p);
 const outcome=await c.run(run=>executeSubmission({text:'保存した荷物のメモの「水」を「お茶」に直して。',attachments:[]},f.services,f.view,run));
 assert.equal(outcome,'awaitingApproval');assert.equal(f.modelCalls(),0);assert.equal(proposals[0].after,'お茶と懐中電灯。');assert.deepEqual(note,before);assert.equal(f.current().turns.at(-1).activity.some(a=>a.tool==='model.load'||a.tool==='dialogue.plan'),false);
});

test('unqualified quoted replacements require a selected file rather than treating operands as knowledge questions',async()=>{
 const f=fixture(),c=createSubmissionController();f.services.knowledge={all:async()=>{throw Error('No implicit knowledge read');},search:async()=>{throw Error('No implicit search');}};
 assert.equal(await c.run(run=>executeSubmission({text:'Replace "saved note what" with "x".',attachments:[]},f.services,f.view,run)),'failed');assert.match(c.state.error,/No working file/);assert.equal(f.modelCalls(),0);
});

test('named corrections discover first, choose among canonical files and generate only a reviewed proposal',async()=>{
 for(const mode of ['unique','choose','cancel','stale']){
  const f=fixture(),c=createSubmissionController(),note=createNote({path:'Notes/meeting.md',body:'Bring water.'}),other=createNote({path:'Inbox/meeting-copy.md',body:'Other water.'}),proposals=[];let records=[note,other],generated=0,choices=0;
  f.services.model='test';f.services.bonsai={loaded:'test',assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async messages=>{generated++;assert.match(JSON.stringify(messages),/Bring water/);assert.doesNotMatch(JSON.stringify(messages),/Other water/);return {text:'{"action":"replace","find":"water","with":"tea"}',finishReason:'stop'};}};
  f.services.knowledge={getState:async()=>undefined,all:async()=>records,search:async query=>{assert.equal(query,'meeting');return (mode==='unique'?[note]:[note,other]).map(n=>({kind:'file',noteId:n.id,revision:1,path:n.revisions[0].path}));}};
  f.view.chooseCorrectionTarget=async options=>{choices++;assert.equal(generated,0);assert.equal(options.length,2);if(mode==='cancel')return null;if(mode==='stale')records=[reviseNote(note,{body:'Newer source'},1),other];return {noteId:note.id,revision:1};};f.view.reviewCorrection=p=>proposals.push(p);
  const outcome=await c.run(run=>executeSubmission({text:'In my saved meeting note, replace water with tea.',attachments:[]},f.services,f.view,run));
  assert.equal(outcome,mode==='cancel'?'cancelled':mode==='stale'?'failed':'awaitingApproval');assert.equal(choices,mode==='unique'?0:1);assert.equal(generated,mode==='cancel'||mode==='stale'?0:1);
  if(proposals.length){assert.equal(proposals[0].before,'Bring water.');assert.equal(proposals[0].after,'Bring tea.');assert.equal(proposals[0].path,'Notes/meeting.md');}else assert.equal(mode==='cancel'||mode==='stale',true);
  assert.equal(note.revisions.length,1);assert.equal(other.revisions.length,1);assert.equal(f.current().turns.at(-1).activity.some(a=>a.tool==='dialogue.plan'||a.tool==='dialogue.compact'),false);
 }
});

test('earlier operation outcomes generate from retained receipts without planner, compaction or knowledge reads',async()=>{
 const f=fixture(),c=createSubmissionController(),text='QA取消確認のメモは保存されましたか？前の会話の操作結果を教えて。';let generated=0;
 await f.services.saveDialogue({...emptyDialogue(),turns:[{id:'cancel',user:'QA取消確認は保存前です。メモして。',status:'Save cancelled'}],compaction:{through:1,summary:'The QA note was saved.'},currentFile:{noteId:'unrelated-file',revision:5}});const before=structuredClone(f.current());
 f.services.model='test';f.services.bonsai={loaded:'test',assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async messages=>{generated++;const payload=JSON.stringify(messages);assert.ok(payload.includes('Save cancelled'));assert.ok(!payload.includes('The QA note was saved.'));assert.ok(payload.includes(text));return {text:'保存はキャンセルされています。',finishReason:'stop'};}};
 f.services.knowledge={all:async()=>{throw Error('No knowledge read');},search:async()=>{throw Error('No knowledge search');}};
 assert.equal(await c.run(run=>executeSubmission({text,attachments:[]},f.services,f.view,run)),'completed');assert.equal(generated,1);const turn=f.current().turns.at(-1);assert.equal(turn.answer,'保存はキャンセルされています。');assert.deepEqual(turn.refs,[]);assert.deepEqual(f.current().turns[0],before.turns[0]);assert.deepEqual(f.current().compaction,before.compaction);assert.equal(turn.activity.some(a=>a.tool==='dialogue.compact'||a.tool==='dialogue.plan'),false);assert.equal(turn.activity.find(a=>a.tool==='dialogue.read').output[0].outcome.status,'Save cancelled');
});

test('a Memory search that asks a question finishes with a grounded answer rather than a terminal list',async()=>{
 const f=fixture(),c=createSubmissionController(),note=createNote({title:'Meeting',body:'集合場所は北口。',path:'Notes/meeting.md'}),records=[note];
 const responses=['{"action":"search","query":"集合場所"}','{"completion":"search"}',JSON.stringify({answer:'集合場所は北口です。',citations:[{id:'S1',quote:'集合場所は北口。'}]})];
 let generated=0;
 f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:8192,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>{generated++;return {text:responses.shift(),finishReason:'stop'};},unload:async()=>{},load:async()=>{throw Error('Already resident');}};
 f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:[],maxToolCalls:3,maxResultChars:8000};
 f.services.knowledge={all:async()=>records,search:async query=>searchNotes(records,query)};
 f.services.builtinToolRegistry=createToolRegistry([{definition:searchDefinition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Read-only search.'},{path:'Tools/memory.search/tool.ts',body:'Trusted search.'}],run:searchRun}]);
 const outcome=await c.run(run=>executeSubmission({text:'Search Memory for the meeting place and tell me where it is.',attachments:[]},f.services,f.view,run));
 assert.equal(outcome,'completed');assert.equal(generated,3);
 const turn=f.current().turns[0];assert.equal(turn.answer,'集合場所は北口です。');assert.equal(turn.refs[0].noteId,note.id);assert.equal(turn.refs[0].revision,1);assert.equal(turn.results,undefined);
 assert.deepEqual(records,[note]);assert.equal(f.reviews.length,0);
});

test('an interrupted multi-source inspection remains visibly partial even if the model omits that qualifier',async()=>{
 const f=fixture(),c=createSubmissionController(),note=createNote({path:'Notes/review.md',body:'The first review is Monday at 10.'}),quote=note.revisions[0].body;
 const responses=[JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'review'})}),JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:note.id})}),JSON.stringify({answer:'The first review is Monday at 10.',citations:[{id:'S1',quote}]})];
 f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:8192,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>({text:responses.shift(),finishReason:'stop'})};
 f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:['memory.search','memory.read'],maxToolCalls:1,maxResultChars:8000};
 f.services.knowledge={all:async()=>[note],search:async()=>[{noteId:note.id,revision:1,start:0,end:quote.length,quote,title:note.path}],views:async()=>[projectNote(note)]};
 f.services.builtinToolPackages=[{definition:searchDefinition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search.'},{path:'Tools/memory.search/tool.ts',body:'Search code.'}],run:searchRun},{definition:readDefinition,entry:'Tools/memory.read/tool.ts',sources:[{path:'Tools/memory.read/SKILL.md',body:'Read.'},{path:'Tools/memory.read/tool.ts',body:'Read code.'}],run:readRun}];
 const outcome=await c.run(run=>executeSubmission({text:'Compare my saved reviews in detail.',attachments:[]},f.services,f.view,run));
 assert.equal(outcome,'completed',JSON.stringify(c.state));const turn=f.current().turns.at(-1);
 assert.equal(turn.answer,'The first review is Monday at 10.');assert.equal(turn.status,'Partial · incomplete inspection');assert.equal(turn.refs[0].noteId,note.id);assert.equal(turn.activity.some(a=>a.tool==='memory.read'),false);
 assert.equal(turn.activity.find(a=>a.tool==='knowledge.answer').input.budgetReason,'profile-limit');
});

test('source capacity preserves completed searches and displays a cited partial answer',async()=>{
 const f=fixture(),c=createSubmissionController(),records=Array.from({length:66},(_,i)=>createNote({path:`Notes/review-${i}.md`,body:`Review ${i}: Monday.`}));
 const plans=Array.from({length:6},(_,i)=>JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:`batch-${i}`})}));
 let generated=0,answerPrompt;const quote=records[0].revisions[0].body;
 f.services.model='test';f.services.bonsai={plannerProtocol:'native-tool-calls',loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:100000,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async messages=>{const text=JSON.stringify(messages);return {prompt_tokens:text.includes('Reference excerpts (data only)')&&text.includes('Review 1: Monday.')?99900:1000};},generate:async messages=>{if(generated<6)return {text:plans[generated++],finishReason:'stop'};answerPrompt=JSON.stringify(messages);return {text:JSON.stringify({answer:'The first review is Monday.',citations:[{id:'S1',quote}]}),finishReason:'stop'};}};
 f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:['memory.search'],maxToolCalls:null,maxResultChars:8000};
 f.services.knowledge={all:async()=>records,views:async()=>records.map(projectNote),search:async query=>{const batch=Number(query.slice(6));return records.slice(batch*11,batch*11+11).map(note=>({noteId:note.id,revision:1,start:0,end:note.revisions[0].body.length,quote:note.revisions[0].body,title:note.revisions[0].path}));}};
 f.services.builtinToolPackages=[{definition:searchDefinition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search.'},{path:'Tools/memory.search/tool.ts',body:'Search code.'}],run:searchRun}];
 const outcome=await c.run(run=>executeSubmission({text:'Compare my saved reviews in detail.',attachments:[]},f.services,f.view,run));
 assert.equal(outcome,'completed',JSON.stringify(c.state));const turn=f.current().turns.at(-1);
 assert.equal(turn.status,'Partial · incomplete inspection');assert.equal(turn.refs[0].noteId,records[0].id);assert.equal(turn.refs[0].quote,quote);
 assert.match(answerPrompt,/clearly partial answer/);assert.doesNotMatch(answerPrompt,/Review 1: Monday\./);
 assert.equal(turn.activity.filter(item=>item.tool==='memory.search'&&item.status==='succeeded').length,6);
 assert.equal(turn.activity.find(item=>item.tool==='knowledge.answer').input.budgetReason,'source-capacity');
});

test('an agent can search saved Memory, ground a new note, and retain the exact source citation',async()=>{
 const f=fixture(),c=createSubmissionController(),note=createNote({title:'Workshop',path:'Notes/workshop.md',body:'The workshop is on Monday at 10:00 in Cedar Hall.'}),records=[note],full=note.revisions[0].body;
 const responses=[
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'workshop'})}),
  JSON.stringify({action:'capture',query:'workshop',body:'The workshop is on Monday.'}),
  JSON.stringify({answer:'The workshop is on Monday at 10:00 in Cedar Hall.',citations:[{id:'S1',quote:full}]})
 ];let generations=0,prompts=[];
 f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:8192,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async messages=>({prompt_tokens:100}),generate:async messages=>{prompts.push(messages);generations++;return {text:responses.shift(),finishReason:'stop'};},load:async()=>{throw Error('Already loaded');}};
 f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:['memory.search'],maxToolCalls:null,maxResultChars:8000};
 f.services.knowledge={all:async()=>records,search:async query=>[{noteId:note.id,revision:1,start:0,end:full.length,quote:full,title:note.path}],views:async()=>[]};
 f.services.refreshSnapshot=async()=>[];
 f.services.builtinToolPackages=[{definition:searchDefinition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search local Memory.'},{path:'Tools/memory.search/tool.ts',body:'Trusted search.'}],run:searchRun}];
 f.services.builtinToolRegistry=createToolRegistry(f.services.builtinToolPackages);
 const text='Summarize my saved notes about the workshop and save a new note.';
 const outcome=await c.run(run=>executeSubmission({text,attachments:[]},f.services,f.view,run));
 assert.equal(outcome,'awaitingApproval',JSON.stringify({error:c.state.error,turn:f.current().turns.at(-1)}));
 assert.equal(generations,3);assert.equal(f.reviews.length,1);assert.equal(f.reviews[0].body,'The workshop is on Monday at 10:00 in Cedar Hall.');assert.deepEqual(f.reviews[0].sources,[{noteId:note.id,revision:1,start:0,end:full.length,quote:full,citedQuote:full}]);
 const searchReceipt=f.current().turns.at(-1).activity.find(item=>item.tool==='memory.search'&&item.status==='succeeded');assert.equal(searchReceipt.output.kind,'memory_search_result');assert.equal(searchReceipt.output.hits[0].noteId,note.id);assert.equal('quote' in searchReceipt.output.hits[0],false);assert.doesNotMatch(JSON.stringify(searchReceipt),/workshop|Monday at 10:00|Notes\/workshop\.md/);
 assert.equal(f.reviews[0].kind,'generated');assert.equal(f.reviews[0].source,null);
 const {discardPendingNoteReview,createNewNoteView}=await import('../src/note-creation.ts');
 const draft=f.reviews[0],discarded=discardPendingNoteReview(f.current(),draft.turnId);
 assert.equal(discarded.turns.at(-1).status,'Draft discarded');assert.equal(discarded.turns.at(-1).answer,draft.body);
 assert.deepEqual(discarded.turns.at(-1).refs,draft.sources);
 const saved=createNewNoteView({id:'new',path:'Inbox/workshop-summary.md',body:draft.body,kind:draft.kind,sources:draft.sources});
 assert.equal(saved.body,draft.body);assert.deepEqual(saved.sources,draft.sources);assert.notEqual(saved.sources,draft.sources);
 assert.ok(JSON.stringify(prompts.at(-1)).includes(full));assert.equal(records[0].revisions.length,1);
});

test('agent file lookup uses canonical discovery instead of reciting an earlier comparison',async()=>{
 const f=fixture(),c=createSubmissionController();
 const a=createNote({path:'Inbox/alpha.md',body:'Alpha meeting: Cedar Hall. Water: 17 litres.'});
 const b=createNote({path:'Inbox/beta.md',body:'Beta meeting: Riverside Park. Water: 9 litres.'});
 const derived=createNote({path:'Inbox/comparison.md',body:'OLD DERIVED COMPARISON: alpha.md and beta.md are mentioned here.'});
 const records=[derived,a,b],before=structuredClone(records);
 const store={all:async()=>records};
 f.services.knowledge={...store,getState:async()=>undefined,views:async()=>records.map(projectNote),search:(...args)=>KnowledgeStore.prototype.search.apply(store,args)};
 f.services.builtinToolPackages=[
  {definition:searchDefinition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search saved files.'},{path:'Tools/memory.search/tool.ts',body:'Trusted search.'}],run:searchRun},
  {definition:readDefinition,entry:'Tools/memory.read/tool.ts',sources:[{path:'Tools/memory.read/SKILL.md',body:'Read saved files.'},{path:'Tools/memory.read/tool.ts',body:'Trusted read.'}],run:readRun},
 ];
 f.services.builtinToolRegistry=createToolRegistry(f.services.builtinToolPackages);
 f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:['memory.search','memory.read'],maxToolCalls:null,maxResultChars:8000};
 const body='Alpha meets in Cedar Hall with 17 litres; Beta meets in Riverside Park with 9 litres.';
 const responses=[
  {action:'tool_batch',calls:[{tool:'memory.search',arguments:{query:'alpha.md'}},{tool:'memory.search',arguments:{query:'beta.md'}}]},
  {action:'tool_batch',calls:[{tool:'memory.read',arguments:{query:a.id}},{tool:'memory.read',arguments:{query:b.id}}]},
  {action:'capture',query:'comparison',body:'Planner draft'},
  {status:'answered',answer:body,sources:['S1','S2']},
 ];
 f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:8192,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>{assert.ok(responses.length,'no unexpected extra model call');return {text:JSON.stringify(responses.shift()),finishReason:'stop'};}};
 assert.equal(await c.run(run=>executeSubmission({text:'Find alpha.md and beta.md, compare their meeting places and water, and save a new note.',attachments:[]},f.services,f.view,run)),'awaitingApproval',JSON.stringify({state:c.state,turn:f.current().turns.at(-1)}));
 const searches=f.current().turns.at(-1).activity.filter(item=>item.tool==='memory.search');
 assert.equal(searches.length,2);
 assert.deepEqual(searches.map(item=>item.output.hits.map(hit=>hit.noteId)),[[a.id],[b.id]]);
 assert.ok(searches.every(item=>item.output.hits.every(hit=>!('quote' in hit)&&!('path' in hit))));
 assert.equal(f.reviews.length,1);assert.equal(f.reviews[0].body,body);
 assert.deepEqual(new Set(f.reviews[0].sources.map(ref=>ref.noteId)),new Set([a.id,b.id]));
 assert.deepEqual(records,before,'retrieval and review do not write source files');
});

test('missing evidence asks for information without retrying or opening a generated-note save',async()=>{
 for(const action of ['answer','capture']){
  const f=fixture(),c=createSubmissionController(),note=createNote({path:'Notes/workshop.md',body:'The workshop takes place in Cedar Hall.'}),body=note.revisions[0].body;
  const ref={noteId:note.id,revision:1,start:0,end:body.length,quote:body,title:'Workshop'},answer='The supplied excerpts do not give a start time. Do you have a note with the time?';let calls=0,restored=0,guard;
  const responses=[{action:'tool',query:'memory.search',body:'{"query":"workshop"}'},{action,query:'workshop',...(action==='capture'?{body:'Draft'}:{target:'knowledge'})},{status:'insufficient_evidence',answer,sources:[]}];
  f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:8192,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>{calls++;assert.ok(responses.length);return {text:JSON.stringify(responses.shift()),finishReason:'stop'};},load:async()=>{throw Error('Already loaded');}};
  f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:['memory.search'],maxToolCalls:null,maxResultChars:8000};
  f.services.knowledge={all:async()=>[note],search:async()=>[{...ref,score:1}],views:async()=>[]};
  f.services.builtinToolPackages=[{definition:searchDefinition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search Memory.'},{path:'Tools/memory.search/tool.ts',body:'Trusted search.'}],run:searchRun}];
  f.services.builtinToolRegistry=createToolRegistry(f.services.builtinToolPackages);
  const finish=f.services.finishTurn;f.services.finishTurn=async(id,result,refs)=>{if(refs)guard=refs;await finish(id,result);};f.view.restore=()=>{restored++;};
  const text='Search my saved workshop notes and '+(action==='capture'?'save a note with the starting time.':'tell me the starting time.');
  assert.equal(await c.run(run=>executeSubmission({text,attachments:[]},f.services,f.view,run)),'blocked',JSON.stringify({action,calls,turn:f.current().turns.at(-1),error:c.state.error}));
  assert.deepEqual(c.state.outcome,{kind:'needsInput',reason:'insufficient-evidence'});assert.equal(c.state.error,undefined);
  const turn=f.current().turns.at(-1);assert.equal(turn.answer,answer);assert.equal(turn.status,'Not enough evidence');assert.deepEqual(turn.refs,[]);assert.deepEqual(guard,[ref]);
  assert.equal(turn.activity.some(a=>a.status==='failed'),false);assert.equal(calls,3);assert.equal(restored,0);assert.equal(f.reviews.length,0);assert.equal(note.revisions.length,1);
 }
});

test('current-answer rewrite loads once, reads the exact assistant text and never retrieves unrelated Memory',async()=>{
 const f=fixture(),c=createSubmissionController(),original='Oak wood is used for furniture and barrels.';let loaded='',loads=0;const prompts=[];
 await f.services.saveDialogue({schema:1,revision:1,turns:[{id:'oak-answer',user:'List two uses.',answer:original}],compaction:null,currentResult:{turnId:'oak-answer'},currentFile:{noteId:'unrelated-file',revision:1}});
 f.services.model='test';f.services.bonsai={get loaded(){return loaded;},busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async messages=>{prompts.push(messages);return {text:prompts.length===1?'{"action":"read"}':'家具や樽に使います。',finishReason:'stop'};},unload:async()=>{loaded='';},load:async()=>{loads++;loaded='test';}};
 // Controlled protocol responses check routing, not model quality.
 f.services.knowledge={all:async()=>{throw Error('Unrelated Memory read');},search:async()=>{throw Error('Unrelated Memory search');}};
 const outcome=await c.run(run=>executeSubmission({text:'今の回答を日本語で短くまとめて。',attachments:[]},f.services,f.view,run));
 assert.equal(outcome,'completed');assert.equal(loads,1);assert.equal(prompts.length,2);assert.ok(prompts.every(messages=>JSON.stringify(messages).includes(original)));
 assert.deepEqual(prompts[1].slice(1),[{role:'assistant',content:original},{role:'user',content:'今の回答を日本語で短くまとめて。'}]);
 const answer=f.current().turns.at(-1);assert.equal(answer.answer,'家具や樽に使います。');assert.equal(answer.readTurn.turnId,'oak-answer');assert.equal(answer.readTurn.speaker,'assistant');assert.deepEqual(answer.refs,[]);assert.equal(answer.activity.some(a=>a.tool==='dialogue.plan'),false);assert.equal(f.current().turns[0].answer,original);
 await f.services.saveDialogue(emptyDialogue());prompts.length=0;
 assert.equal(await c.run(run=>executeSubmission({text:'今の回答を日本語で短くまとめて。',attachments:[]},f.services,f.view,run)),'failed');
 assert.match(c.state.error,/Current result unavailable/);assert.equal(prompts.length,0);
});

test('current-answer formatting reads only the exact answer and preserves its source references without Memory search or compaction',async()=>{
 const f=fixture(),c=createSubmissionController(),answer='青いノート',ref={noteId:'trip',revision:2,start:0,end:5,quote:answer},old={id:'packing-answer',user:'旅程の持ち物は？',answer,refs:[ref]};let calls=0;
 await f.services.saveDialogue({...emptyDialogue(),turns:[{id:'irrelevant',user:'UNRELATED HISTORY',answer:'Other topic'},old],currentResult:{turnId:old.id}});
 f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async messages=>{assert.doesNotMatch(JSON.stringify(messages),/UNRELATED HISTORY/);return {prompt_tokens:100};},generate:async messages=>{calls++;assert.match(JSON.stringify(messages),/青いノート/);return {text:calls===1?'{"action":"read"}':'- [ ] 青いノート',finishReason:'stop'};},load:async()=>{throw Error('Already loaded');}};
 f.services.knowledge={all:async()=>{throw Error('Must not reread unrelated Memory');},search:async()=>{throw Error('Must not search');}};
 assert.equal(await c.run(run=>executeSubmission({text:'今の回答をチェックリストにして。',attachments:[]},f.services,f.view,run)),'completed',c.state.error);
 const turn=f.current().turns.at(-1);assert.equal(calls,2);assert.equal(turn.answer,'- [ ] 青いノート');assert.deepEqual(turn.refs,[ref]);assert.equal(turn.readTurn.turnId,old.id);assert.deepEqual(f.current().turns[1],old);assert.equal(turn.activity.some(a=>a.tool==='dialogue.plan'||a.tool==='dialogue.compact'),false);
});

test('an explicitly bound file question never counts or compacts unrelated dialogue before answering',async()=>{
 const f=fixture(),c=createSubmissionController(),note=createNote({path:'Inbox/place.md',body:'集合場所は北口。持ち物は青いノート。'}),prior={schema:1,revision:1,turns:Array.from({length:24},(_,i)=>({id:'prior-'+i,user:'UNRELATED_DIALOGUE '+i,answer:'Keep earlier original '+i})),compaction:{through:12,summary:'UNRELATED_DIALOGUE summary'},currentFile:{noteId:note.id,revision:1}};
 await f.services.saveDialogue(prior);let generations=0;const seen=[];
 f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async messages=>{const raw=JSON.stringify(messages);seen.push(raw);assert.doesNotMatch(raw,/UNRELATED_DIALOGUE/);return {prompt_tokens:100};},generate:async messages=>{generations++;assert.doesNotMatch(JSON.stringify(messages),/UNRELATED_DIALOGUE/);return {text:JSON.stringify({answer:'集合場所は北口。持ち物は青いノート。',citations:[{id:'S1',quote:note.revisions[0].body}]}),finishReason:'stop'};},load:async()=>{throw Error('Already resident');}};
 f.services.knowledge={all:async()=>[note],search:async()=>{throw Error('Do not search other files');}};
 const question='この入力ファイルに書かれている集合場所と持ち物を日本語で答えてください。';
 assert.equal(await c.run(run=>executeSubmission({text:question,attachments:[]},f.services,f.view,run)),'completed',c.state.error);
 const current=f.current(),turn=current.turns.at(-1);assert.equal(generations,1);assert.ok(seen.length);assert.deepEqual(current.compaction,prior.compaction);assert.deepEqual(current.turns.slice(0,24),prior.turns);assert.equal(turn.refs[0].noteId,note.id);assert.equal(turn.refs[0].revision,1);assert.equal(turn.refs[0].start,0);assert.equal(turn.refs[0].end,note.revisions[0].body.length);assert.equal(turn.refs[0].quote,note.revisions[0].body);assert.equal(turn.activity.some(a=>a.tool==='dialogue.compact'),false);assert.equal(turn.activity.some(a=>a.tool==='dialogue.plan'),false);assert.equal(turn.answer,'集合場所は北口。持ち物は青いノート。');
});

test('bound file admission reports unavailable or empty originals before any text model acquisition',async()=>{
 for(const scenario of ['missing','withdrawn','empty']){
  const f=fixture(),c=createSubmissionController(),note=createNote({path:'Inbox/preflight.md',body:scenario==='empty'?'':'Meeting at the north gate.'});
  if(scenario==='withdrawn')note.state='withdrawn';
  const records=scenario==='missing'?[]:[note],snapshot=structuredClone(records);let loads=0;
  await f.services.saveDialogue({...emptyDialogue(),currentFile:{noteId:note.id,revision:1}});
  f.services.model='test';f.services.bonsai={loaded:'',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},load:async()=>{loads++;throw Error('Unexpected model acquisition');}};
  f.services.knowledge={all:async()=>records,search:async()=>{throw Error('Unrelated search');}};
  assert.equal(await c.run(run=>executeSubmission({text:'What time does this file say we should meet?',attachments:[]},f.services,f.view,run)),'failed');
  assert.match(c.state.error,scenario==='missing'?/Working file original unavailable/:scenario==='withdrawn'?/Working file changed/:/File is empty/);
  assert.equal(loads,0);assert.deepEqual(records,snapshot);
  assert.equal(f.current().turns.at(-1).activity.some(a=>a.tool==='model.load'),false);
 }
});

test('bound file answer admits evidence before releasing another model and loading the selected text runtime',async()=>{
 const f=fixture(),c=createSubmissionController(),note=createNote({path:'Inbox/preflight.md',body:'Meeting at 09:30.'}),steps=[];let loaded='';
 await f.services.saveDialogue({...emptyDialogue(),currentFile:{noteId:note.id,revision:1}});
 f.services.model='test';f.services.bonsai={get loaded(){return loaded;},busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',engine:'wllama-lfm2',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>{assert.equal(loaded,'test');return {prompt_tokens:100};},generate:async()=>({text:JSON.stringify({answer:'09:30',citations:[{id:'S1',quote:note.revisions[0].body}]})}),load:async()=>{steps.push('load');loaded='test';},unload:async()=>{loaded='';}};
 f.services.decision={...f.services.decision,loaded:true,busy:false,enabled:false,ready:false,unload:async()=>{steps.push('release-decision');f.services.decision.loaded=false;}};
 f.services.ensureProductRuntime=async(_role,network)=>{assert.equal(network,false);steps.push('runtime');};
 f.services.knowledge={all:async()=>{steps.push('read');return [note];},search:async()=>{throw Error('Unrelated search');}};
 assert.equal(await c.run(run=>executeSubmission({text:'What time does this file say we should meet?',attachments:[]},f.services,f.view,run)),'completed',c.state.error);
 assert.ok(steps.indexOf('read')<steps.indexOf('release-decision'));assert.ok(steps.indexOf('runtime')<steps.indexOf('load'));assert.equal(steps.filter(s=>s==='load').length,1);
 assert.equal(f.current().turns.at(-1).answer,'09:30');assert.equal(f.current().turns.at(-1).refs[0].noteId,note.id);assert.equal(note.revisions.length,1);
});

test('an opened-file correction reads its pinned original then loads only for an exact-span proposal, without replaying old dialogue',async()=>{
 const f=fixture(),c=createSubmissionController(),note=createNote({path:'Inbox/place.md',body:'集合場所は北口。まだ作成途中です。'}),before=structuredClone(note),steps=[];let loaded='',generations=0,review;
 const old={id:'old',user:'UNRELATED instructions',answer:'Old answer'};
 await f.services.saveDialogue({...emptyDialogue(),turns:[old],currentFile:{noteId:note.id,revision:1}});
 f.services.model='test';f.services.bonsai={get loaded(){return loaded;},busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},load:async()=>{steps.push('load');loaded='test';},unload:async()=>{loaded='';},count:async messages=>{assert.equal(loaded,'test');assert.doesNotMatch(JSON.stringify(messages),/UNRELATED/);return {prompt_tokens:100};},generate:async messages=>{generations++;assert.match(JSON.stringify(messages),/集合場所は北口/);return {text:JSON.stringify({action:'replace',find:'北口',with:'南口'})};}};
 f.services.knowledge={all:async()=>{steps.push('read');return [note];},getState:async()=>undefined};
 f.view.reviewCorrection=async proposal=>{review=proposal;};
 assert.equal(await c.run(run=>executeSubmission({text:'集合場所を南口に直して。',attachments:[]},f.services,f.view,run)),'awaitingApproval',c.state.error);
 assert.ok(steps.indexOf('read')<steps.indexOf('load'));assert.equal(generations,1);assert.equal(review.path,'Inbox/place.md');assert.equal(review.before,before.revisions[0].body);assert.equal(review.after,'集合場所は南口。まだ作成途中です。');assert.equal(review.operation.name,'text.replace');assert.deepEqual(note,before);assert.deepEqual(f.current().turns[0],old);
 assert.equal(f.current().turns.at(-1).activity.some(a=>a.tool==='dialogue.plan'||a.tool==='dialogue.compact'),false);
});

test('a saved correction review blocks another proposal before model acquisition and retains both requests',async()=>{
 for(const saved of [{type:'pending-correction',proposal:{id:'existing'}},{malformed:'inert saved data'}]){
  const f=fixture(),c=createSubmissionController(),note=createNote({path:'Inbox/place.md',body:'集合場所は北口。'}),before=structuredClone(saved),original=structuredClone(note);let loads=0,refreshed=0,recovered;
  await f.services.saveDialogue({...emptyDialogue(),currentFile:{noteId:note.id,revision:1}});
  f.services.model='test';f.services.bonsai={loaded:'',assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[],runtime:{revision:'fixture'}},load:async()=>{loads++;throw Error('Must not load');}};
  f.services.knowledge={all:async()=>[note],getState:async key=>{assert.equal(key,'pending-correction');return saved;}};
  f.services.refreshStorage=async()=>{refreshed++;};f.view.restore=value=>{recovered=value;};
  assert.equal(await c.run(run=>executeSubmission({text:'集合場所を南口に直して。',attachments:[]},f.services,f.view,run)),'blocked');
  assert.equal(c.state.outcome.reason,'pending-correction');assert.equal(loads,0);assert.equal(refreshed,1);assert.deepEqual(saved,before);assert.deepEqual(note,original);assert.equal(recovered.text,'集合場所を南口に直して。');assert.equal(f.current().turns.at(-1).status,'Review pending changes first');assert.equal(f.current().turns.at(-1).activity.some(a=>a.tool==='model.load'||a.tool==='memory.propose_correction'),false);
 }
});

test('explicit missing Memory subjects stop before model acquisition or history compaction',async()=>{
 const f=fixture(),c=createSubmissionController();let loads=0,counts=0,generated=0;
 f.services.model='test';f.services.bonsai={loaded:'',busy:false,assets:{test:{filesPresent:false}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>{counts++;throw Error('Unexpected count');},generate:async()=>{generated++;throw Error('Unexpected generation');},unload:async()=>{},load:async()=>{loads++;throw Error('Unexpected load');}};
 f.services.knowledge={all:async()=>[],search:async()=>[]};
 for(const text of ['answer: QACANOE9360ZXF','What is in my saved canoe insurance note?','保存したカヌー保険のメモには何が書いてありますか？','保存したカヌー保険のメモを短く要約して。','Summarize the saved canoe insurance note briefly.'])assert.equal(await c.run(run=>executeSubmission({text,attachments:[]},f.services,f.view,run)),'failed');
 assert.match(c.state.error,/No matching notes/);assert.equal(loads,0);assert.equal(counts,0);assert.equal(generated,0);
 assert.equal(f.current().turns.some(turn=>turn.activity.some(a=>a.tool==='model.load'||a.tool==='dialogue.compact')),false);
});

test('a named saved summary preserves the full request and current evidence without action selection',async()=>{
 const f=fixture(),c=createSubmissionController(),text='保存したQA星見のメモを短く要約して。',note=createNote({path:'Inbox/QA-星見.md',body:'QA星見の持ち物は水と懐中電灯。'}),before=structuredClone(note),ref={noteId:note.id,revision:1,start:0,end:note.revisions[0].body.length,quote:note.revisions[0].body};let generated=0;
 f.services.model='test';f.services.bonsai={loaded:'test',assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async messages=>{generated++;const prompt=JSON.stringify(messages);assert.ok(prompt.includes(text));assert.ok(prompt.includes('summary'));assert.ok(prompt.includes(ref.quote));return {text:JSON.stringify({answer:'持ち物は水と懐中電灯。',citations:[{id:'S1',quote:ref.quote}]})};}};
 f.services.knowledge={all:async()=>[note],search:async query=>{assert.equal(query,'QA星見');return [ref];}};
 assert.equal(await c.run(run=>executeSubmission({text,attachments:[]},f.services,f.view,run)),'completed');assert.equal(generated,1);const turn=f.current().turns.at(-1);assert.equal(turn.status,'Summary · selected excerpts');assert.equal(turn.refs[0].noteId,note.id);assert.equal(turn.activity.some(a=>a.tool==='dialogue.compact'||a.tool==='dialogue.plan'),false);assert.deepEqual(note,before);
});

test('an explicit opened-file summary uses the pinned original and skips model planning',async()=>{
 const f=fixture(),c=createSubmissionController(),text='このファイルを短く要約してください。',note=createNote({path:'Inbox/summary.md',body:'集合は北口。水を持参。'}),before=structuredClone(note);let generated=0;
 await f.services.saveDialogue({...emptyDialogue(),currentFile:{noteId:note.id,revision:1}});
 f.services.model='test';f.services.bonsai={loaded:'test',assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async messages=>{generated++;const prompt=JSON.stringify(messages);assert.ok(prompt.includes(text));assert.ok(prompt.includes('summary'));assert.ok(prompt.includes(note.revisions[0].body));return {text:JSON.stringify({answer:'北口集合、水を持参。',citations:[{id:'S1',quote:note.revisions[0].body}]})};}};
 f.services.knowledge={all:async()=>[note],search:async()=>{throw Error('Unexpected search');}};
 assert.equal(await c.run(run=>executeSubmission({text,attachments:[]},f.services,f.view,run)),'completed');const turn=f.current().turns.at(-1);assert.equal(generated,1);assert.equal(turn.refs[0].noteId,note.id);assert.equal(turn.refs[0].revision,1);assert.equal(turn.activity.some(a=>['decision.classify','dialogue.compact','dialogue.plan'].includes(a.tool)),false);assert.deepEqual(note,before);
});

test('a literal sourced answer acquires through the local ownership manager only after retrieval',async()=>{
 const f=fixture(),c=createSubmissionController(),note=createNote({path:'Notes/office.md',body:'The office opens at 09:30.'}),ref={noteId:note.id,revision:1,start:0,end:note.revisions[0].body.length,quote:note.revisions[0].body};let loaded='';const steps=[];
 f.services.model='test';f.services.bonsai={get loaded(){return loaded;},busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture',engine:'wllama-lfm2'}],runtime:{revision:'fixture'}},count:async()=>{assert.equal(loaded,'test');steps.push('count');return {prompt_tokens:100};},generate:async()=>{steps.push('generate');return {text:JSON.stringify({answer:'09:30',citations:[{id:'S1',quote:ref.quote}]})};},unload:async()=>{loaded='';},load:async()=>{steps.push('load');loaded='test';}};
 f.services.decision={...f.services.decision,loaded:true,busy:false,enabled:false,ready:false,unload:async()=>{steps.push('release-decision');f.services.decision.loaded=false;}};
 f.services.ensureProductRuntime=async(_role,network)=>{assert.equal(network,false);steps.push('runtime');};
 f.services.knowledge={all:async()=>[note],search:async()=>{steps.push('search');return [ref];}};
 let guarded;const finish=f.services.finishTurn;f.services.finishTurn=async(id,result,refs)=>{if(result.answer)guarded=refs;await finish(id,result);};
 assert.equal(await c.run(run=>executeSubmission({text:'answer: office opening time',attachments:[]},f.services,f.view,run)),'completed');
 assert.ok(steps.indexOf('search')<steps.indexOf('release-decision'));assert.ok(steps.indexOf('runtime')<steps.indexOf('load'));assert.ok(steps.indexOf('load')<steps.indexOf('count'));assert.equal(steps.filter(s=>s==='load').length,1);
 assert.equal(f.current().turns[0].answer,'09:30');assert.equal(f.current().turns[0].refs[0].noteId,note.id);assert.equal(guarded[0].noteId,note.id);assert.equal(note.revisions.length,1);
});

test('explicit Memory search still lists results with no configured model or completion inference',async()=>{
 for(const text of ['search: 集合場所','集合場所について保存したメモを探して','保存した集合場所のメモを探して。']){
  const f=fixture(),c=createSubmissionController(),note=createNote({title:'Meeting',body:'集合場所は北口。',path:'Notes/meeting.md'});
  f.services.knowledge={search:async query=>searchNotes([note],query)};
  f.services.builtinToolRegistry=createToolRegistry([{definition:searchDefinition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search.'},{path:'Tools/memory.search/tool.ts',body:'Trusted adapter.'}],run:searchRun}]);
  assert.equal(await c.run(run=>executeSubmission({text,attachments:[]},f.services,f.view,run)),'completed');
  assert.equal(f.current().turns[0].answer,undefined);assert.equal(f.current().turns[0].results[0].noteId,note.id);assert.equal(f.modelCalls(),0);
 }
});
test('application executes real local calculation and persists its result without invoking a model',async()=>{
 const f=fixture(),c=createSubmissionController();
 assert.equal(await c.run(run=>executeSubmission({text:'12 * 7',attachments:[]},f.services,f.view,run)),'completed');
 assert.equal(f.current().turns[0].answer,'84');assert.equal(f.current().turns[0].toolCalls,undefined);
 assert.equal(f.current().turns[0].activity[0].tool,'math.calculate');assert.equal(f.current().turns[0].activity[0].status,'succeeded');
 assert.deepEqual(f.events,['save','consume']);assert.equal(f.modelCalls(),0);
});

test('a model-proposed calculation cannot discard a cited prior answer',async()=>{
 const f=fixture(),c=createSubmissionController(),note=createNote({path:'Inbox/water.md',body:'水は七リットルです。'});
 const ref={noteId:note.id,revision:1,start:0,end:note.revisions[0].body.length,quote:note.revisions[0].body};
 await f.services.saveDialogue({...emptyDialogue(),turns:[{id:'prior',user:'水は何リットル？',answer:'七リットル',refs:[ref]}]});
 f.services.model='test';f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:[],maxToolCalls:3,maxResultChars:8000};
 f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>({text:JSON.stringify({action:'calculate',query:'7 / 3'})}),unload:async()=>{}};
 f.services.knowledge={all:async()=>[note],search:async()=>[]};let restored='';f.view.restore=value=>{restored=value.text;};
 const text='その水を3人で分けると1人何リットルですか？';
 assert.equal(await c.run(run=>executeSubmission({text,attachments:[]},f.services,f.view,run)),'failed');
 const turn=f.current().turns.at(-1);assert.equal(turn.status,'Check source values · enter the calculation explicitly');assert.equal(turn.answer,undefined);assert.equal(restored,text);assert.equal(turn.activity.some(item=>item.tool==='math.calculate'),false);
});

test('a cited follow-up cannot invoke the calculator before source review',async()=>{
 const f=fixture(),c=createSubmissionController(),note=createNote({path:'Inbox/water.md',body:'水は七リットルです。'});
 const ref={noteId:note.id,revision:1,start:0,end:note.revisions[0].body.length,quote:note.revisions[0].body};
 await f.services.saveDialogue({...emptyDialogue(),turns:[{id:'prior',user:'水は何リットル？',answer:'七リットル',refs:[ref]}]});
 f.services.model='test';f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:['math.calculate'],maxToolCalls:3,maxResultChars:8000};
 f.services.builtinToolPackages=[{definition,entry:'Tools/math.calculate/tool.ts',sources:[{path:'Tools/math.calculate/SKILL.md',body:'Calculate locally.'},{path:'Tools/math.calculate/tool.ts',body:'Bounded calculator'}],run:calculate}];
 const plans=[{action:'tool',query:'math.calculate',body:JSON.stringify({expression:'7 / 3'})},{action:'answer',query:'water'}];
 f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>({text:JSON.stringify(plans.shift())}),unload:async()=>{}};
 f.services.knowledge={all:async()=>[note],search:async()=>[]};let restored='';f.view.restore=value=>{restored=value.text;};
 const text='その水を3人で分けると1人何リットルですか？';
 assert.equal(await c.run(run=>executeSubmission({text,attachments:[]},f.services,f.view,run)),'failed');
 const turn=f.current().turns.at(-1);assert.match(turn.status,/Invalid model action/);assert.equal(turn.answer,undefined);assert.equal(restored,text);assert.equal(turn.activity.some(item=>item.tool==='math.calculate'),false);
});
test('a sourced calculation is reviewed before executing and keeps its source',async()=>{
 const f=fixture(),c=createSubmissionController(),note=createNote({path:'Inbox/water.md',body:'水は七リットルです。'}),ref={noteId:note.id,revision:1,start:0,end:note.revisions[0].body.length,quote:note.revisions[0].body};
 await f.services.saveDialogue({...emptyDialogue(),turns:[{id:'prior',user:'水は？',answer:'七リットル',refs:[ref]}]});
 f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:[],maxToolCalls:3,maxResultChars:8000};
 const plans=[{operation:'divide',sourceOperandIndex:0,sourceIndex:0,sourceQuote:'七リットル',sourceUnit:'リットル',requestQuote:'3'}];
 f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>({text:JSON.stringify(plans.shift())}),unload:async()=>{}};
 f.services.knowledge={all:async()=>[note],search:async()=>[]};let reviewCalls=0,guarded;
 f.view.reviewSourcedCalculation=async candidate=>{reviewCalls++;assert.equal(candidate.expression,'7 / 3');assert.equal(candidate.evidence[0].passage.quote,ref.quote);assert.equal((f.current().turns.at(-1).activity??[]).some(a=>a.tool==='math.calculate'),false);return true;};
 const finish=f.services.finishTurn;f.services.finishTurn=async(id,result,refs)=>{if(result.answer)guarded=refs;await finish(id,result);};
 assert.equal(await c.run(run=>executeSubmission({text:'その水を3人で分けると？',attachments:[]},f.services,f.view,run)),'completed',c.state.error);
 assert.equal(reviewCalls,1);assert.match(f.current().turns.at(-1).answer,/7 \/ 3 ≈ 2\.333/);assert.equal(guarded[0].quote,'七リットル');
});
test('a sourced division question cannot fall through to an unverified prose answer',async()=>{
 const f=fixture(),c=createSubmissionController(),note=createNote({path:'Inbox/water.md',body:'水は七リットルです。'}),ref={noteId:note.id,revision:1,start:0,end:note.revisions[0].body.length,quote:note.revisions[0].body};
 await f.services.saveDialogue({...emptyDialogue(),turns:[{id:'prior',user:'水は？',answer:'七リットル',refs:[ref]}]});
 const candidate={operation:'divide',sourceOperandIndex:0,sourceIndex:0,sourceQuote:'七リットル',sourceUnit:'リットル',requestQuote:'3'};let prompts=0;
 f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>{prompts++;return {text:JSON.stringify(candidate)};},unload:async()=>{}};
 f.services.knowledge={all:async()=>[note],search:async()=>[]};f.view.reviewSourcedCalculation=async()=>true;
 assert.equal(await c.run(run=>executeSubmission({text:'その水を3人で分けると1人何リットルですか？',attachments:[]},f.services,f.view,run)),'completed',c.state.error);
 assert.equal(prompts,1);assert.match(f.current().turns.at(-1).answer,/7 \/ 3 ≈ 2\.333/);assert.equal(f.current().turns.at(-1).refs[0].quote,'七リットル');
});
test('a different pinned file cannot silently replace a cited calculation source',async()=>{
 const f=fixture(),c=createSubmissionController(),note=createNote({path:'Inbox/water.md',body:'水は七リットルです。'}),ref={noteId:note.id,revision:1,start:0,end:note.revisions[0].body.length,quote:note.revisions[0].body};
 await f.services.saveDialogue({...emptyDialogue(),turns:[{id:'prior',user:'水は？',answer:'七リットル',refs:[ref]}],currentFile:{noteId:'other',revision:1}});
 f.view.reviewSourcedCalculation=async()=>{throw Error('Unexpected review');};f.services.knowledge={all:async()=>[note],search:async()=>[]};let restored='';f.view.restore=value=>{restored=value.text;};
 const text='その水を3人で分けると？';assert.equal(await c.run(run=>executeSubmission({text,attachments:[]},f.services,f.view,run)),'failed');assert.match(c.state.error,/Source changed/);assert.equal(restored,text);assert.equal(f.current().turns.at(-1).answer,undefined);
});
test('cancelling or changing a reviewed calculation source prevents calculation',async()=>{
 for(const scenario of ['cancel','changed']){
  const f=fixture(),c=createSubmissionController(),note=createNote({path:'Inbox/water.md',body:'水は七リットルです。'}),ref={noteId:note.id,revision:1,start:0,end:note.revisions[0].body.length,quote:note.revisions[0].body};let records=[note],restored='';
  await f.services.saveDialogue({...emptyDialogue(),turns:[{id:'prior',user:'水は？',answer:'七リットル',refs:[ref]}]});f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:[],maxToolCalls:3,maxResultChars:8000};
  const plans=[{operation:'divide',sourceOperandIndex:0,sourceIndex:0,sourceQuote:'七リットル',sourceUnit:'リットル',requestQuote:'3'}];
  f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>({text:JSON.stringify(plans.shift())}),unload:async()=>{}};
  f.services.knowledge={all:async()=>records,search:async()=>[]};f.view.restore=value=>{restored=value.text;};f.view.reviewSourcedCalculation=async()=>{if(scenario==='changed')records=[reviseNote(note,{body:'水は八リットルです。'},1)];return scenario!=='cancel';};
  const text='その水を3人で分けると？';assert.equal(await c.run(run=>executeSubmission({text,attachments:[]},f.services,f.view,run)),scenario==='cancel'?'cancelled':'failed');
  const turn=f.current().turns.at(-1);assert.equal(turn.answer,undefined);assert.equal((turn.activity??[]).some(a=>a.tool==='math.calculate'),false);assert.equal(restored,text);
 }
});
test('decimal calculations keep exact output and mark rounded division without a model',async()=>{
 for(const [text,answer] of [['０．１＋０．２','0.3'],['9007199254740993+1','9007199254740994'],['1/3','≈ 0.333333333333333333']]){
  const f=fixture(),c=createSubmissionController();assert.equal(await c.run(run=>executeSubmission({text,attachments:[]},f.services,f.view,run)),'completed');
  assert.equal(f.current().turns[0].answer,answer);assert.equal(f.modelCalls(),0);
  assert.equal(f.current().turns[0].activity[0].tool,'math.calculate');
 }
});
test('explicit capture stages exact content for a new-note review without a second generation',async()=>{
 const f=fixture(),c=createSubmissionController();
 assert.equal(await c.run(run=>executeSubmission({text:'note: Keep original words',attachments:[]},f.services,f.view,run)),'completed');
 assert.equal(f.reviews.length,1);assert.equal(f.reviews[0].body,'Keep original words');assert.equal(f.reviews[0].kind,'original');assert.equal(f.modelCalls(),0);assert.equal(f.current().turns[0].status,'Review new note');
});
test('persistence failure keeps draft, records failure, and permits a later attempt',async()=>{
 const f=fixture(),c=createSubmissionController();f.services.saveDialogue=async()=>{throw Error('Version conflict');};
 assert.equal(await c.run(run=>executeSubmission({text:'12 * 7',attachments:[]},f.services,f.view,run)),'failed');
 assert.equal(f.events.includes('consume'),false);assert.equal(c.busy,false);assert.equal(c.state.error,'Version conflict');assert.equal(f.current().turns.length,0);
});

test('Stop during attachment commit adopts the saved original before recovery and never replays it',async()=>{
 const f=fixture(),c=createSubmissionController();let release,entered;const gate=new Promise(r=>{release=r;}),committing=new Promise(r=>{entered=r;});let commits=0,adoptions=0,recovered;
 f.services.knowledge.submitInput=async(_expected,next,originals)=>{commits++;entered();await gate;await f.services.saveDialogue(next);return originals.map(originalNote);};
 f.view.adopt=()=>{adoptions++;};f.view.restore=value=>{recovered=value;};
 const file=new File(['Preserved original'],'source.md',{type:'text/markdown'});
 const pending=c.run(run=>executeSubmission({text:'',attachments:[{id:'source',name:file.name,kind:'text',size:file.size,status:'Ready',file,url:''}]},f.services,f.view,run));
 await committing;c.stop();assert.equal(c.busy,true);release();assert.equal(await pending,'cancelled');
 assert.equal(commits,1);assert.equal(adoptions,1);assert.equal(f.current().turns.length,1);assert.equal(f.current().turns[0].attachments[0].asset.id,'source');
 assert.equal(recovered.attachments[0].file,undefined);assert.equal(recovered.attachments[0].asset.id,'source');assert.equal(f.current().turns[0].status,'Stopped');
});
test('unsupported input retains its original and exposes the real preparation status without model fallback',async()=>{
 const f=fixture(),c=createSubmissionController();let originals=[],recovery=0;
 f.services.knowledge.submitInput=async(_expected,next,values)=>{originals=values;await f.services.saveDialogue(next);return values.map(originalNote);};
 f.view.restore=()=>{recovery++;};const file=new File(['opaque file'],'unknown.bin',{type:'application/octet-stream'});
 await c.run(run=>executeSubmission({text:'What is in this file?',attachments:[{id:'binary',name:file.name,kind:'file',size:file.size,status:'Ready',file,url:''}]},f.services,f.view,run));
 assert.equal(c.state.outcome.kind,'partial');assert.equal(originals.length,1);assert.match(f.current().turns[0].status,/Original saved · Unsupported/);assert.equal(f.modelCalls(),0);assert.equal(recovery,1);
});

test('an unprepared chat request reports needsPreparation and cannot bypass the model manager',async()=>{
 const f=fixture(),c=createSubmissionController();
 assert.equal(await c.run(run=>executeSubmission({text:'Hello',attachments:[]},f.services,f.view,run)),'blocked');
 assert.equal(c.state.outcome.kind,'needsPreparation');assert.equal(c.state.outcome.reason,'model-selection');assert.equal(f.modelCalls(),0);
 assert.equal(f.current().turns.length,1);assert.equal(f.current().turns[0].status,'Model not configured · Settings');
});

test('native-tool Text model owns ordinary action selection without loading the resident Decision role',async()=>{
 const f=fixture(),c=createSubmissionController();let plans=0,answers=0,decisionCalls=0,decisionLoads=0;
 f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:[],maxToolCalls:0,maxResultChars:8000};
 f.services.model='native-test';
 f.services.bonsai={loaded:'native-test',busy:false,assets:{'native-test':{filesPresent:true}},manifest:{contextTokens:4096,maxOutputTokens:512,models:[{id:'native-test',revision:'fixture'}],runtime:{revision:'fixture'}},plannerProtocol:'native-tool-calls',protocolForModel:id=>id==='native-test'?'native-tool-calls':'json',pin(){return this;},count:async()=>({prompt_tokens:64}),generate:async(_messages,_maxTokens,format)=>{if(format?.type==='native-tool-plan'){plans++;return {text:JSON.stringify({action:'chat',query:''})};}answers++;return {text:'Let us plan the weekly reset.',finishReason:'stop'};},load:async()=>{throw Error('Unexpected Text reload');},stop(){}};
 f.services.decision={...f.services.decision,enabled:true,ready:true,loaded:false,busy:false,load:async()=>{decisionLoads++;throw Error('Unexpected Decision load');},classify:async()=>{decisionCalls++;throw Error('Unexpected Decision classification');},unload:async()=>{}};
 assert.equal(await c.run(run=>executeSubmission({text:'Could you help me plan a weekly reset?',attachments:[]},f.services,f.view,run)),'completed',c.state.error);
 assert.equal(plans,1);assert.ok(answers>=1);assert.equal(decisionLoads,0);assert.equal(decisionCalls,0);assert.equal(f.current().turns.at(-1).answer,'Let us plan the weekly reset.');
});

test('literal new-note prose is saved exactly without model acquisition, even when another file is open',async()=>{
 const f=fixture(),c=createSubmissionController();await f.services.saveDialogue({...f.current(),currentFile:{noteId:'existing',revision:2}});
 const outcome=await c.run(run=>executeSubmission({text:'QA星見の持ち物は水と充電器。メモして。',attachments:[]},f.services,f.view,run));
 assert.equal(outcome,'completed');assert.equal(f.reviews.length,1);assert.equal(f.reviews[0].body,'QA星見の持ち物は水と充電器。');assert.equal(f.reviews[0].kind,'original');assert.equal(f.modelCalls(),0);assert.equal(f.current().turns.at(-1).status,'Review new note');
});

test('a model-authored new note is always reviewed before persistence',async()=>{
 const f=fixture(),c=createSubmissionController();let generations=0;
 f.services.activeHarnessProfile={...f.services.activeHarnessProfile,maxToolCalls:0,maxResultChars:8000};
 f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>{generations++;return {text:JSON.stringify({action:'capture',query:'',body:'The model omitted the exact reserve amount.'}),finishReason:'stop'};},load:async()=>{throw Error('Already loaded');}};
 f.services.knowledge={all:async()=>[],views:async()=>[],search:async()=>[],getState:async()=>[]};
 f.services.refreshSnapshot=async()=>[];
 const outcome=await c.run(run=>executeSubmission({text:'Create a note about my emergency water reserve.',attachments:[]},f.services,f.view,run));
 assert.equal(outcome,'awaitingApproval',c.state.error);assert.equal(generations,1);assert.equal(f.reviews.length,1);
 assert.equal(f.reviews[0].body,'The model omitted the exact reserve amount.');assert.equal(f.reviews[0].kind,'generated');
 assert.equal(f.current().turns.at(-1).status,'Review new note');
});

test('copying the current answer remains pending until the user saves the review',async()=>{
 const f=fixture(),c=createSubmissionController(),answer='Original answer',refs=[{noteId:'source',revision:2,start:0,end:5,quote:'proof'}];
 await f.services.saveDialogue({...emptyDialogue(),turns:[{id:'answer',user:'Question',answer,refs}],currentResult:{turnId:'answer'}});
 let generations=0;f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>{generations++;return {text:'{"action":"capture","target":"current","query":""}'};}};
 f.services.activeHarnessProfile={...f.services.activeHarnessProfile,maxResultChars:8000};
 const outcome=await c.run(run=>executeSubmission({text:'今の回答をメモとして残して',attachments:[]},f.services,f.view,run));
 assert.equal(outcome,'awaitingApproval',c.state.error);assert.equal(f.reviews.length,1);assert.equal(f.reviews[0].body,answer);assert.deepEqual(f.reviews[0].source.source.refs,refs);assert.equal(generations,1);
});

test('a direct request to save the current answer needs no model or regeneration',async()=>{
 const f=fixture(),c=createSubmissionController(),answer='Original answer',refs=[{noteId:'source',revision:2,start:0,end:5,quote:'proof'}];
 await f.services.saveDialogue({...emptyDialogue(),turns:[{id:'answer',user:'Question',answer,refs}],currentResult:{turnId:'answer'}});
 const outcome=await c.run(run=>executeSubmission({text:'今の回答をメモに保存して',attachments:[]},f.services,f.view,run));
 assert.equal(outcome,'awaitingApproval',c.state.error);assert.equal(f.reviews[0].body,answer);assert.deepEqual(f.reviews[0].source.source.refs,refs);assert.equal(f.modelCalls(),0);
});

test('a current-answer source follow-up bypasses history/planning and keeps its exact source without selecting a file',async()=>{
 const f=fixture(),c=createSubmissionController(),note=createNote({path:'Inbox/packing.md',body:'持ち物は水と懐中電灯。'}),before=structuredClone(note);let calls=0;
 const ref={noteId:note.id,revision:1,start:0,end:note.revisions[0].body.length,quote:note.revisions[0].body};
 await f.services.saveDialogue({...emptyDialogue(),turns:[{id:'answer',user:'Packing?',answer:'水と懐中電灯',refs:[ref]}],currentResult:{turnId:'answer'}});
 f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>{calls++;return {text:JSON.stringify({answer:'充電器は記載されていません。',citations:[{id:'S1',quote:note.revisions[0].body}]})};}};
 f.services.knowledge={all:async()=>[note],search:async()=>{throw Error('Unrelated search');}};
 assert.equal(await c.run(run=>executeSubmission({text:'そのメモの持ち物に充電器は含まれていますか？',attachments:[]},f.services,f.view,run)),'completed',c.state.error);
 assert.equal(calls,1);assert.equal(f.current().currentFile,undefined);assert.equal(f.current().turns.at(-1).refs[0].noteId,note.id);assert.deepEqual(note,before);assert.equal(f.current().turns.at(-1).activity.some(a=>['dialogue.compact','dialogue.plan'].includes(a.tool)),false);
});

test('a missing, changed or withdrawn current-answer source refuses before model acquisition rather than substituting evidence',async()=>{
 for(const scenario of ['missing','changed','withdrawn']){
  const f=fixture(),c=createSubmissionController(),note=createNote({path:'Inbox/packing.md',body:'Old text'});
  if(scenario==='changed')note.revisions.push({...note.revisions[0],version:2,body:'Changed text'});if(scenario==='withdrawn')note.state='withdrawn';
  const records=scenario==='missing'?[]:[note],before=structuredClone(records);
  await f.services.saveDialogue({...emptyDialogue(),turns:[{id:'answer',user:'Packing?',answer:'Old text',refs:[{noteId:note.id,revision:1,start:0,end:8,quote:'Old text'}]}],currentResult:{turnId:'answer'}});
 f.services.model='test';f.services.bonsai={loaded:'',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[],runtime:{revision:'fixture'}},load:async()=>{throw Error('Unexpected model acquisition');}};f.services.knowledge={all:async()=>records,search:async()=>{throw Error('Unrelated search');}};
  assert.equal(await c.run(run=>executeSubmission({text:'What is in that note?',attachments:[]},f.services,f.view,run)),'failed');assert.match(c.state.error,/Source changed/);assert.equal(f.current().currentFile,undefined);assert.equal(f.current().turns.at(-1).activity.some(a=>a.tool==='model.load'),false);assert.deepEqual(records,before);
 }
});

test('explicit previous utterance reaches generation without compaction or decision routing',async()=>{
 const f=fixture(),c=createSubmissionController(),old={id:'old',user:'UNRELATED PRIVATE HISTORY',answer:'Older answer'},recent={id:'last',user:'こんにちは',answer:'こんにちは！'};
 await f.services.saveDialogue({...emptyDialogue(),turns:[old,recent]});let generations=0;
 f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async messages=>{const s=JSON.stringify(messages);assert.doesNotMatch(s,/UNRELATED PRIVATE HISTORY/);assert.match(s,/こんにちは/);return {prompt_tokens:100};},generate:async messages=>{generations++;assert.match(JSON.stringify(messages),/こんにちは/);return {text:'こんにちは',finishReason:'stop'};},load:async()=>{throw Error('Already loaded');}};
 f.services.decision={...f.services.decision,enabled:true,ready:true,loaded:false,busy:false,load:async()=>{throw Error('Unexpected decision');}};
 f.services.knowledge={all:async()=>{throw Error('Unexpected Memory read');},search:async()=>{throw Error('Unexpected search');}};
 assert.equal(await c.run(run=>executeSubmission({text:'私が直前に言った挨拶は何ですか？',attachments:[]},f.services,f.view,run)),'completed',c.state.error);
 assert.equal(generations,1);assert.deepEqual(f.current().turns.slice(0,2),[old,recent]);assert.equal(f.current().turns.at(-1).activity.some(a=>a.tool==='dialogue.compact'||a.tool==='dialogue.plan'),false);
});

test('a text request blocked by an unavailable model restores its draft for retry',async()=>{
 const f=fixture(),c=createSubmissionController(),restored=[];
 f.services.model='missing';f.services.bonsai.manifest.models=[{id:'missing',engine:'wllama-lfm3',revision:'fixture'}];f.view.restore=value=>restored.push(value);
 await c.run(run=>executeSubmission({text:'1200円と800円を足して4で割って',attachments:[]},f.services,f.view,run));
 assert.equal(f.current().turns.at(-1).status,'Model not prepared · Settings');
 assert.deepEqual(restored,[{text:'1200円と800円を足して4で割って',attachments:[]}]);
});

test('a repeated continuation keeps the input available for retry without saving an answer',async()=>{
 const f=fixture(),c=createSubmissionController(),restored=[],question='私が直前に言った挨拶は何ですか？';let calls=0;
 const previous={id:'answer',user:'こんにちは',answer:'こんにちは！'};
 await f.services.saveDialogue({...emptyDialogue(),turns:[previous],currentResult:{turnId:'answer'}});
 f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:2048,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>({text:'A repeated model response with more than thirty-two characters.',finishReason:++calls===1?'length':'stop'})};
 f.view.restore=value=>restored.push(value);
 assert.equal(await c.run(run=>executeSubmission({text:question,attachments:[]},f.services,f.view,run)),'failed');
 assert.match(f.current().turns.at(-1).status,/continuation repeated/i);
 assert.equal(f.current().turns.at(-1).answer,undefined);
 assert.deepEqual(restored,[{text:question,attachments:[]}]);assert.deepEqual(f.current().turns[0],previous);
});

test('an unavailable model does not overwrite a newer composer draft',async()=>{
 const f=fixture(),c=createSubmissionController(),restored=[];
 f.services.model='missing';f.services.bonsai.manifest.models=[{id:'missing',engine:'wllama-lfm3',revision:'fixture'}];
 f.view.composer=()=>({text:'new draft',attachments:[]});f.view.restore=value=>restored.push(value);
 await c.run(run=>executeSubmission({text:'Earlier question',attachments:[]},f.services,f.view,run));
 assert.equal(f.current().turns.at(-1).status,'Model not prepared · Settings');assert.deepEqual(restored,[]);
});


test('native search/read replies reach display or note review once, with exact search-range citations',async()=>{
 for(const action of ['answer','capture'])for(const insufficient of [false,true]){
  const f=fixture(),c=createSubmissionController(),note=createNote({path:'Notes/meeting.md',body:'Meeting place: Cedar Hall. Water: 17 litres.'}),records=[note],before=structuredClone(records),full=note.revisions[0].body;
  const quote='Cedar Hall',start=full.indexOf(quote),ref={noteId:note.id,revision:1,start,end:start+quote.length,quote};
  let generations=0,terminal=0;
  const answer=insufficient?'The excerpt gives no start time. Do you have that information?':'Meeting place: Cedar Hall.';
  f.services.model='test';
  f.services.bonsai={plannerProtocol:'native-tool-calls',loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:8192,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),load:async()=>{throw Error('Already loaded');},generate:async(messages,_budget,format,onPreview)=>{
   generations++;assert.equal(format.type,'native-tool-plan','no separate answer generation after the terminal agent reply');
   const observed=messages.filter(message=>message.role==='tool');let value;
   if(observed.some(message=>message.name==='memory.read')){
    assert.equal(terminal++,0,'only one terminal reply');
    onPreview(answer.slice(0,12));
    assert.equal(c.state.preview,answer.slice(0,12),'preview crosses the application boundary before completion');
    assert.equal(f.current().turns.at(-1).answer,undefined,'partial text is not committed');
    assert.equal(f.reviews.length,0,'partial text cannot become a saved-note proposal');
    const read=JSON.parse(observed.find(message=>message.name==='memory.read').content)[0];assert.equal(read.excerpt,full);assert.equal(read.source,'S2');
    const found=JSON.parse(observed.find(message=>message.name==='memory.search').content)[0];assert.equal(found.source,'S1');assert.equal(found.quote,quote);
    value={action,...(action==='answer'?{query:'meeting',target:'knowledge'}:{}),reply:{status:insufficient?'insufficient_evidence':'answered',answer,sources:insufficient?[]:['S1']}};
   }else if(observed.some(message=>message.name==='memory.search'))value={action:'tool',query:'memory.read',body:JSON.stringify({query:note.id})};
   else value={action:'tool',query:'memory.search',body:JSON.stringify({query:'meeting'})};
   return {text:JSON.stringify(value),finishReason:'stop'};
  }};
  f.services.knowledge={all:async()=>records,getState:async()=>undefined,search:async()=>[ref],views:async()=>records.map(projectNote)};
  f.services.refreshSnapshot=async()=>records.map(projectNote);
  f.services.builtinToolPackages=[
   {definition:searchDefinition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search saved notes.'},{path:'Tools/memory.search/tool.ts',body:'Trusted search.'}],run:searchRun},
   {definition:readDefinition,entry:'Tools/memory.read/tool.ts',sources:[{path:'Tools/memory.read/SKILL.md',body:'Read saved notes.'},{path:'Tools/memory.read/tool.ts',body:'Trusted read.'}],run:readRun},
  ];
  f.services.builtinToolRegistry=createToolRegistry(f.services.builtinToolPackages);
  f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:['memory.search','memory.read'],maxToolCalls:null,maxResultChars:8000};
  const text='Search my saved meeting note, read it, and explain '+(insufficient?'the start time':'the meeting place')+(action==='capture'?', then save a new note.':'.');
  const outcome=await c.run(run=>executeSubmission({text,attachments:[]},f.services,f.view,run));
  assert.equal(outcome,insufficient?'blocked':action==='capture'?'awaitingApproval':'completed',JSON.stringify({state:c.state,turn:f.current().turns.at(-1)}));
  assert.equal(terminal,1);assert.ok(generations<=3);
  assert.equal(c.state.preview,'','validated completion replaces the provisional text');
  const turn=f.current().turns.at(-1);assert.equal(turn.answer,answer);
  assert.equal(turn.activity.filter(item=>item.tool==='knowledge.answer').length,1);
  assert.equal(turn.activity.find(item=>item.tool==='knowledge.answer').input.execution,'agent-terminal-reply');
  if(insufficient){assert.equal(f.reviews.length,0);assert.deepEqual(turn.refs,[]);assert.equal(turn.status,'Not enough evidence');}
  else if(action==='capture'){
   assert.equal(f.reviews.length,1);assert.equal(f.reviews[0].body,answer);assert.deepEqual(f.reviews[0].sources,[ref]);
   const {createNewNoteView}=await import('../src/note-creation.ts');
   const saved=createNewNoteView({id:'new',path:'Inbox/meeting-summary.md',body:f.reviews[0].body,kind:'generated',sources:f.reviews[0].sources});
   assert.equal(saved.body,answer);assert.deepEqual(saved.sources,[ref]);
  }else{assert.equal(f.reviews.length,0);assert.deepEqual(turn.refs,[ref]);}
  assert.deepEqual(records,before,'no original is changed by answering or proposing a new note');
 }
});

test('a second search page can ground the exact answer and a reviewed new note',async()=>{
 for(const action of ['answer','capture']){
  const f=fixture(),c=createSubmissionController(),notes=Array.from({length:15},(_,i)=>createNote({title:`water ${i}`,body:`water reserve ${i} litres`,path:`Inbox/water-${i}.md`})),before=structuredClone(notes);
  const first=searchStoredPageChecked(notes,'water',{offset:0,limit:12});let terminal=0;
  f.services.model='test';f.services.bonsai={plannerProtocol:'native-tool-calls',loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:16000,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),load:async()=>{throw Error('Already loaded');},generate:async(messages,_budget,format)=>{
   assert.equal(format.type,'native-tool-plan');const results=messages.filter(message=>message.role==='tool'&&message.name==='memory.search');let value;
   if(!results.length)value={action:'tool',query:'memory.search',body:JSON.stringify({query:'water',offset:0})};
   else if(results.length===1)value={action:'tool',query:'memory.search',body:JSON.stringify({query:'water',offset:12,snapshot:first.snapshot})};
   else{const page=JSON.parse(results[1].content);assert.equal(page.hits.length,3);const hit=page.hits[0];assert.ok(hit.source);terminal++;value={action,...(action==='answer'?{query:'water',target:'knowledge'}:{}),reply:{status:'answered',answer:hit.quote,sources:[hit.source]}};}
   return {text:JSON.stringify(value),finishReason:'stop'};
  }};
  f.services.knowledge={all:async()=>notes,getState:async()=>undefined,search:async()=>[],searchPage:async(query,options)=>searchStoredPageChecked(notes,query,options),views:async()=>notes.map(projectNote)};
  f.services.refreshSnapshot=async()=>notes.map(projectNote);
  f.services.builtinToolPackages=[{definition:searchDefinition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search saved notes.'},{path:'Tools/memory.search/tool.ts',body:'Trusted search.'}],run:searchRun}];f.services.builtinToolRegistry=createToolRegistry(f.services.builtinToolPackages);f.services.activeHarnessProfile={id:'test-profile',label:'Test',enabledTools:['memory.search'],maxToolCalls:null,maxResultChars:8000};
  const outcome=await c.run(run=>executeSubmission({text:'Search my saved water notes and explain the reserve'+(action==='capture'?', then save a new note.':'.'),attachments:[]},f.services,f.view,run));
  assert.equal(outcome,action==='capture'?'awaitingApproval':'completed',JSON.stringify(c.state));assert.equal(terminal,1);
  const turn=f.current().turns.at(-1),ref=turn.refs[0],note=notes.find(item=>item.id===ref.noteId);assert.equal(note.revisions[0].body.slice(ref.start,ref.end),ref.quote);assert.equal(turn.answer,ref.quote);
  if(action==='capture'){assert.equal(f.reviews.length,1);assert.equal(f.reviews[0].body,turn.answer);assert.deepEqual(f.reviews[0].sources,turn.refs);}else assert.equal(f.reviews.length,0);
  assert.deepEqual(notes,before);
 }
});
