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
function fixture(){
 let dialogue=emptyDialogue();const events=[],reviews=[];let modelCalls=0;
 const services={
  knowledge:{},builtinToolPackages:[],builtinToolRegistry:createToolRegistry([{definition,entry:'Tools/math.calculate/tool.ts',sources:[{path:'Tools/math.calculate/SKILL.md',body:'Calculate locally.'},{path:'Tools/math.calculate/tool.ts',body:'Bounded calculator'}],run:calculate}]),bonsai:{loaded:'',assets:{},load:async()=>{modelCalls++;throw Error('Unexpected model');}},
  decision:{enabled:false,ready:false},ocr:{ready:false},speech:{ready:false,transcribe:async()=>{throw Error('Unexpected speech');}},vision:{describe:async()=>{throw Error('Unexpected vision');}},
  ocrModel:'',ocrLanguage:'eng',speechModel:'',visionModel:'',visionAvailable:false,model:'',decisionModel:'',
  modelPreferences:{transcriptionLanguage:'auto',customSpeechModels:[],customVisionModels:[],customDecisionModels:[]},harnessPreferences:{replyStyle:'balanced',userGuidance:''},activeHarnessProfile:{enabledTools:[],maxToolCalls:4,maxResultChars:10000},connectionPreferences:{diagnosticLogs:false},
  diagnostics:{getItem:()=>null,setItem:()=>{}},
  currentDialogue:()=>dialogue,storedDialogue:()=>dialogue,settled:async()=>{},flushStorage:async()=>{},refreshStorage:async()=>{},refreshSnapshot:async()=>[],
  saveDialogue:async next=>{validateDialogue(next);dialogue=next;events.push('save');},finishTurn:async(id,result)=>{dialogue=completeTurn(dialogue,id,result);},
  ensureProductRuntime:async()=>{throw Error('Unexpected acquisition');},traceProcessing:async()=>{throw Error('Unexpected processing');},
 };
 const view={adopt:()=>{},consume:()=>events.push('consume'),composer:()=>({text:'',attachments:[]}),restore:()=>{},toast:message=>events.push(message),failure:message=>events.push(message),openNote:()=>{},reviewCapture:value=>reviews.push(value),reviewCorrection:()=>{},reviewSchedule:()=>{},startToolPackageFromChat:()=>{}};
 return {services,view,events,reviews,current:()=>dialogue,modelCalls:()=>modelCalls};
}

test('an unspecified saved-note search asks for a topic without acquiring a model or reading Memory',async()=>{
 const f=fixture(),c=createSubmissionController();
 f.services.knowledge={all:async()=>{throw Error('Unexpected read');},search:async()=>{throw Error('Unexpected search');}};
 assert.equal(await c.run(run=>executeSubmission({text:'保存したメモを探して',attachments:[]},f.services,f.view,run)),'completed');
 assert.equal(f.current().turns.at(-1).status,'What should I search for?');
 assert.equal(f.modelCalls(),0);
});

test('saved-file correction searches canonical Memory before proposing changes, without using unrelated dialogue or pinned files',async()=>{
 const f=fixture(),c=createSubmissionController(),target=createNote({path:'Notes/meeting.md',body:'Bring water.'}),other=createNote({path:'Notes/other.md',body:'Unrelated file'}),records=[target,other],before=structuredClone(records),proposals=[],prompts=[];
 await f.services.saveDialogue({...emptyDialogue(),turns:[{id:'old',user:'UNRELATED-OLD-REQUEST',answer:'UNRELATED-OLD-ANSWER'}],compaction:{through:1,summary:'UNRELATED-SUMMARY'},currentFile:{noteId:other.id,revision:1},currentResult:{turnId:'old'}});const prior=structuredClone(f.current());
 const responses=[JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'meeting'})}),JSON.stringify({action:'edit',query:'Notes/meeting.md',target:'path'}),JSON.stringify({action:'replace',find:'water',with:'tea'})];
 f.services.model='test';f.services.bonsai={loaded:'test',assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async messages=>{prompts.push(messages);assert.doesNotMatch(JSON.stringify(messages),/UNRELATED-|Unrelated file/);return {text:responses.shift(),finishReason:'stop'};}};
 f.services.knowledge={getState:async()=>undefined,all:async()=>records,search:async query=>{assert.equal(query,'meeting');return [{noteId:target.id,revision:1,start:0,end:11,quote:'Bring water',title:'Notes/meeting.md'}];}};
 f.services.builtinToolPackages=[{definition:searchDefinition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search local Memory'},{path:'Tools/memory.search/tool.ts',body:'Trusted search adapter'}],run:searchRun}];f.services.activeHarnessProfile={enabledTools:['memory.search'],maxToolCalls:3,maxResultChars:8000};f.view.reviewCorrection=proposal=>proposals.push(proposal);
 assert.equal(await c.run(run=>executeSubmission({text:'Could you replace water with tea in my saved meeting note?',attachments:[]},f.services,f.view,run)),'awaitingApproval',JSON.stringify({state:c.state,events:f.events,prompts:prompts.length}));assert.equal(prompts.length,3);assert.equal(proposals.length,1);assert.equal(proposals[0].path,'Notes/meeting.md');assert.equal(proposals[0].before,'Bring water.');assert.equal(proposals[0].after,'Bring tea.');assert.deepEqual(records,before);assert.deepEqual(f.current().currentFile,prior.currentFile);assert.deepEqual(f.current().compaction,prior.compaction);assert.deepEqual(f.current().turns[0],prior.turns[0]);assert.equal(f.current().turns.at(-1).activity.some(a=>a.tool==='dialogue.compact'),false);
});

test('discovered corrections revalidate canonical identity and revision before proposal generation',async()=>{
 for(const mismatch of ['revision','identity']){
  const f=fixture(),c=createSubmissionController(),note=createNote({path:'Notes/meeting.md',body:'Bring water.'}),other=createNote({path:'Notes/other.md',body:'Do not change.'});
  const records=[mismatch==='revision'?reviseNote(note,{body:'Newer original'},1):note,other],before=structuredClone(records);let generated=0;
  const plans=[JSON.stringify({action:'tool',query:'memory.search',body:'{"query":"meeting"}'}),JSON.stringify({action:'edit',query:'Notes/meeting.md',target:'path'})];
  f.services.model='test';f.services.bonsai={loaded:'test',assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>{generated++;assert.ok(plans.length,'No correction generation after stale discovery');return {text:plans.shift(),finishReason:'stop'};}};
  f.services.knowledge={getState:async()=>undefined,all:async()=>records,search:async()=>[{kind:'file',noteId:mismatch==='identity'?other.id:note.id,revision:1,path:'Notes/meeting.md'}]};
  f.services.builtinToolPackages=[{definition:searchDefinition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search local Memory'},{path:'Tools/memory.search/tool.ts',body:'Trusted adapter'}],run:searchRun}];f.services.activeHarnessProfile={enabledTools:['memory.search'],maxToolCalls:3,maxResultChars:8000};
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

test('a planned search asking for information finishes with a grounded answer rather than a terminal list',async()=>{
 const f=fixture(),c=createSubmissionController(),note=createNote({title:'Meeting',body:'集合場所は北口。',path:'Notes/meeting.md'}),records=[note];
 const responses=['{"action":"search","query":"集合場所"}','{"completion":"answer"}',JSON.stringify({answer:'集合場所は北口です。',citations:[{id:'S1',quote:'集合場所は北口。'}]})];
 let generated=0;
 f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:8192,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>{generated++;return {text:responses.shift(),finishReason:'stop'};},unload:async()=>{},load:async()=>{throw Error('Already resident');}};
 f.services.activeHarnessProfile={enabledTools:[],maxToolCalls:3,maxResultChars:8000};
 f.services.knowledge={all:async()=>records,search:async query=>searchNotes(records,query)};
 f.services.builtinToolRegistry=createToolRegistry([{definition:searchDefinition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Read-only search.'},{path:'Tools/memory.search/tool.ts',body:'Trusted search.'}],run:searchRun}]);
 const outcome=await c.run(run=>executeSubmission({text:'集合場所について保存したメモを探して、今の集合場所を教えて。',attachments:[]},f.services,f.view,run));
 assert.equal(outcome,'completed');assert.equal(generated,3);
 const turn=f.current().turns[0];assert.equal(turn.answer,'集合場所は北口です。');assert.equal(turn.refs[0].noteId,note.id);assert.equal(turn.refs[0].revision,1);assert.equal(turn.results,undefined);
 assert.deepEqual(records,[note]);assert.equal(f.reviews.length,0);
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
 const f=fixture(),c=createSubmissionController(),note=createNote({path:'Inbox/place.md',body:'集合場所は北口。まだ作成途中です。'}),prior={schema:1,revision:1,turns:Array.from({length:24},(_,i)=>({id:'prior-'+i,user:'UNRELATED_DIALOGUE '+i,answer:'Keep earlier original '+i})),compaction:{through:12,summary:'UNRELATED_DIALOGUE summary'},currentFile:{noteId:note.id,revision:1}};
 await f.services.saveDialogue(prior);let generations=0;const seen=[];
 f.services.model='test';f.services.bonsai={loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async messages=>{const raw=JSON.stringify(messages);seen.push(raw);assert.doesNotMatch(raw,/UNRELATED_DIALOGUE/);return {prompt_tokens:100};},generate:async messages=>{generations++;assert.doesNotMatch(JSON.stringify(messages),/UNRELATED_DIALOGUE/);return {text:JSON.stringify({answer:'The provided evidence does not state a meeting time.',citations:[{id:'S1',quote:note.revisions[0].body}]}),finishReason:'stop'};},load:async()=>{throw Error('Already resident');}};
 f.services.knowledge={all:async()=>[note],search:async()=>{throw Error('Do not search other files');}};
 assert.equal(await c.run(run=>executeSubmission({text:'What time does this file say we should meet?',attachments:[]},f.services,f.view,run)),'completed',c.state.error);
 const current=f.current(),turn=current.turns.at(-1);assert.equal(generations,1);assert.ok(seen.length);assert.deepEqual(current.compaction,prior.compaction);assert.deepEqual(current.turns.slice(0,24),prior.turns);assert.equal(turn.refs[0].noteId,note.id);assert.equal(turn.activity.some(a=>a.tool==='dialogue.compact'),false);assert.equal(turn.activity.some(a=>a.tool==='dialogue.plan'),false);assert.equal(turn.answer,'The provided evidence does not state a meeting time.');
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
 f.services.decision={loaded:true,busy:false,enabled:false,ready:false,unload:async()=>{steps.push('release-decision');f.services.decision.loaded=false;}};
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
  f.services.model='test';f.services.bonsai={loaded:'',assets:{test:{filesPresent:true}},manifest:{models:[]},load:async()=>{loads++;throw Error('Must not load');}};
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
 f.services.decision={loaded:true,busy:false,enabled:false,ready:false,unload:async()=>{steps.push('release-decision');f.services.decision.loaded=false;}};
 f.services.ensureProductRuntime=async(_role,network)=>{assert.equal(network,false);steps.push('runtime');};
 f.services.knowledge={all:async()=>[note],search:async()=>{steps.push('search');return [ref];}};
 assert.equal(await c.run(run=>executeSubmission({text:'answer: office opening time',attachments:[]},f.services,f.view,run)),'completed');
 assert.ok(steps.indexOf('search')<steps.indexOf('release-decision'));assert.ok(steps.indexOf('runtime')<steps.indexOf('load'));assert.ok(steps.indexOf('load')<steps.indexOf('count'));assert.equal(steps.filter(s=>s==='load').length,1);
 assert.equal(f.current().turns[0].answer,'09:30');assert.equal(f.current().turns[0].refs[0].noteId,note.id);assert.equal(note.revisions.length,1);
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
test('decimal calculations keep exact output and mark rounded division without a model',async()=>{
 for(const [text,answer] of [['０．１＋０．２','0.3'],['9007199254740993+1','9007199254740994'],['1/3','≈ 0.333333333333333333']]){
  const f=fixture(),c=createSubmissionController();assert.equal(await c.run(run=>executeSubmission({text,attachments:[]},f.services,f.view,run)),'completed');
  assert.equal(f.current().turns[0].answer,answer);assert.equal(f.modelCalls(),0);
  assert.equal(f.current().turns[0].activity[0].tool,'math.calculate');
 }
});
test('capture requests a review with exact content and never writes a new knowledge note',async()=>{
 const f=fixture(),c=createSubmissionController();
 assert.equal(await c.run(run=>executeSubmission({text:'note: Keep original words',attachments:[]},f.services,f.view,run)),'awaitingApproval');
 assert.equal(f.reviews.length,1);assert.equal(f.reviews[0].body,'Keep original words');assert.equal(f.reviews[0].kind,'original');assert.equal(f.modelCalls(),0);
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

test('literal new-note prose reaches exact review without model acquisition or knowledge writes',async()=>{
 const f=fixture(),c=createSubmissionController();await f.services.saveDialogue({...f.current(),currentFile:{noteId:'existing',revision:2}});
 const outcome=await c.run(run=>executeSubmission({text:'QA星見の持ち物は水と充電器。メモして。',attachments:[]},f.services,f.view,run));
 assert.equal(outcome,'awaitingApproval');assert.equal(f.reviews.length,1);assert.equal(f.reviews[0].body,'QA星見の持ち物は水と充電器。');assert.equal(f.reviews[0].kind,'original');assert.equal(f.modelCalls(),0);assert.equal(f.current().turns.at(-1).status,'Review before saving');
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
  f.services.model='test';f.services.bonsai={loaded:'',busy:false,assets:{test:{filesPresent:true}},load:async()=>{throw Error('Unexpected model acquisition');}};f.services.knowledge={all:async()=>records,search:async()=>{throw Error('Unrelated search');}};
  assert.equal(await c.run(run=>executeSubmission({text:'What is in that note?',attachments:[]},f.services,f.view,run)),'failed');assert.match(c.state.error,/Source changed/);assert.equal(f.current().currentFile,undefined);assert.equal(f.current().turns.at(-1).activity.some(a=>a.tool==='model.load'),false);assert.deepEqual(records,before);
 }
});
