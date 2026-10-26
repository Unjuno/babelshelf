import test from 'node:test';
import assert from 'node:assert/strict';
import * as router from '../src/turn-router.ts';

const prior={schema:1,revision:1,turns:[{id:'turn-1',user:'What did we decide about the workshop?',answer:'Move it to Monday at 10.',refs:[{noteId:'meeting',revision:2,start:0,end:31,quote:'Workshop moved to Monday at 10.'}]}],compaction:null,currentFile:{noteId:'opened-file',revision:3}};

test('saved-file planning keeps the agent loop but excludes unrelated dialogue and implicit current-file edits',()=>{
 const question='保存したQA星見のメモの水をお茶に直して。',intent=route({question});
 assert.deepEqual(intent.request,{action:'edit',query:'QA星見',target:'path'});assert.deepEqual(intent.context,{summary:'',recent:[],refs:[],turnCount:0});
 const scoped=router.scopeResolvedTurnRequest({request:{action:'edit',query:'Notes/target.md'},question,literal:false,inputs:[],currentFile:prior.currentFile});
 assert.equal(scoped.request.target,undefined);assert.equal(scoped.fileBinding.binding,undefined);
 assert.throws(()=>router.scopeResolvedTurnRequest({request:{action:'edit',query:'',target:'file'},question,literal:false,inputs:[],currentFile:prior.currentFile}),/saved|scope/i);
 assert.equal(route({question:'What did I say earlier about my saved meeting note?'}).context.currentFile?.noteId,'opened-file');
});

test('explicit named corrections nominate a search subject without inventing a transformation or swallowing mixed requests',()=>{
 assert.deepEqual(router.explicitSavedKnowledgeCorrection('In my saved meeting note, replace water with tea.'),{action:'edit',query:'meeting',target:'path'});
 for(const text of ['このメモの水をお茶に直して。','前の会話で保存したQA星見のメモの水をお茶に直して。','保存したQA星見のメモの水をお茶に直して。それから削除して。','In my saved meeting note, replace water with tea and email it.'])assert.equal(router.explicitSavedKnowledgeCorrection(text),null,text);
 assert.equal(router.explicitSavedKnowledgeCorrection('保存したQA星見のメモの水をお茶に直して。',true),null);
});

test('quoted replacement content cannot masquerade as saved-knowledge, history or question routing',()=>{
 for(const question of ['Replace "saved note what" with "x".', 'Replace "saved note what" with "x" in this file.','このファイルの「前の会話」を「保存したメモ」に直して。','Replace "x.md?" with "and delete;" in this file.']){
  const intent=route({question});assert.equal(intent.request.action,'edit',question);assert.equal(intent.request.target,'file',question);
  assert.equal(router.scopeResolvedTurnRequest({request:intent.request,question,literal:false,inputs:[],currentFile:prior.currentFile}).request.target,'file');
 }
 assert.equal(route({question:'保存した荷物のメモの「何」を「新しい文字」に直して。'}).request.action,'edit');
});
const route=(overrides={})=>{
 assert.equal(typeof router.resolveSubmittedTurnIntent,'function');
 return router.resolveSubmittedTurnIntent({
  question:'What did we decide about the workshop?',literalRequest:null,hasAttachments:false,hasCurrentInputReadings:false,prior,
  attachments:[],...overrides,
 });
};

test('earlier application-outcome questions use original receipts instead of lossy summaries or failed retries',()=>{
 const question='QA取消確認のメモは保存されましたか？前の会話の操作結果を教えて。';
 const state={...prior,turns:[{id:'cancel',user:'QA取消確認は保存前です。メモして。',status:'Save cancelled'},{id:'other',user:'Save a note: Copper workshop',status:'Saved · Inbox/copper.md'},{id:'retry',user:question,status:'Invalid model action'}],compaction:{through:3,summary:'QA取消確認 was saved.'}};
 const before=structuredClone(state),intent=route({question,prior:state});assert.deepEqual(intent.request,{action:'chat',query:question});assert.equal(intent.context.outcomeOnly,true);assert.equal(intent.context.summary,'');assert.deepEqual(intent.context.refs,[]);
 assert.equal(intent.context.recalled.find(r=>r.turnId==='cancel')?.outcome.status,'Save cancelled');assert.equal(intent.context.recalled.some(r=>r.turnId==='retry'),false);assert.deepEqual(state,before);
 for(const inputs of [{hasAttachments:true},{hasCurrentInputReadings:true}])assert.equal(route({question,prior:state,...inputs}).context.outcomeOnly,undefined);
 for(const question of ['前の会話の操作結果を保存して。','What did I say earlier?','保存したQA取消確認のメモには何が書いてありますか？','Did the earlier note save? Delete it.'])assert.equal(route({question,prior:state}).context.outcomeOnly,undefined,question);
});

test('a named saved-note summary has an explicit knowledge scope without unrelated dialogue',()=>{
 for(const [question,query] of [
  ['保存したQA星見のメモを短く要約して。','QA星見'],
  ['保存済みの避難準備のノートを簡潔にまとめてください。','避難準備'],
  ['Summarize my saved blue lantern meeting note briefly.','blue lantern meeting'],
  ['Please summarize the stored notes about the blue lantern meeting.','blue lantern meeting'],
 ]){
  const before=structuredClone(prior),intent=route({question});assert.deepEqual(intent.request,{action:'summary',query,target:'knowledge'},question);assert.deepEqual(intent.context,{summary:'',recent:[],refs:[],turnCount:0});assert.deepEqual(prior,before);
 }
});

test('saved-summary admission refuses mixed actions, vague sources and current inputs',()=>{
 assert.equal(typeof router.explicitSavedKnowledgeSummary,'function');
 for(const question of ['保存したメモを要約して。','保存したこのメモを要約して。','保存したQA星見のメモを要約して、保存して。','保存したQA星見のメモを要約して。そして削除して。','前の会話で保存したQA星見のメモを要約して。','Summarize my saved note.','Summarize the stored notes about trip and email the result.','保存したメモをメールして、旅行のメモを要約して。','Summarize my saved note about trip and save it.','Summarize the stored notes about trip and delete them.','Summarize my saved notes from the previous chat.','Summarize your last answer.','このファイルを要約して。'])assert.equal(router.explicitSavedKnowledgeSummary(question),null,question);
 assert.equal(router.explicitSavedKnowledgeSummary('保存したQA星見のメモを短く要約して。',true),null);
 for(const inputs of [{hasAttachments:true},{hasCurrentInputReadings:true}])assert.equal(route({question:'保存したQA星見のメモを短く要約して。',...inputs}).explicitSavedRequest,null);
});

test('a single correction command with an opened file binds a review, never an earlier dialogue transform',()=>{
 for(const question of ['集合場所を南口に直して。','このファイルの時刻を10時に変更してください。','Change the meeting place to the south gate.','In this file, replace north with south.']){
  const before=structuredClone(prior),intent=route({question});
  assert.deepEqual(intent.request,{action:'edit',query:question,target:'file'});
  assert.deepEqual(intent.context,{summary:'',recent:[],refs:[],turnCount:0});assert.deepEqual(prior,before);
 }
 for(const question of ['Change your last answer to French.','Change another file to south.','別のファイルの集合場所を南口に直して。','集合場所を南口に直して、時刻を10時に変更して。','Replace the text in Notes/other.md with south.','Change the meeting place to south and save a new note.','集合場所を南口に直して。それから保存して。','Set the timer to ten minutes.','What would change the meeting place to south?'])assert.notEqual(route({question}).request?.action,'edit',question);
 assert.equal(route({question:'集合場所を南口に直して。',hasAttachments:true}).request,null);
 assert.equal(route({question:'集合場所を南口に直して。',prior:{...prior,currentFile:undefined}}).request,null);
});

test('an explicit rewrite of the current answer binds its immutable dialogue target before planning',()=>{
 for(const question of ['今の回答を日本語で短くまとめて。','今の回答をチェックリストにして。','直前の回答を表にして。','Format your last answer as a table.','Put your previous response into a checklist.','直前の回答を英語に翻訳して。','Summarize your last answer in Japanese.','Please translate your previous response into French.']){
  const before=structuredClone(prior),intent=route({question});
  assert.deepEqual(intent.request,{action:'recall',query:question,target:'current'});
  assert.deepEqual(prior,before);
 }
 for(const question of ['Summarize the saved note about your last answer.','Translate your last answer and save it.','今の回答を保存して。','Translate the phrase "your last answer" into Japanese.','Ignore your last answer.','Turn your last answer into a tool.','Format your last answer as code and execute it.','今の回答をツールにして。','その内容を短くして。','Read: Notes/last-answer.md'])assert.notDeepEqual(route({question}).request,{action:'recall',query:question,target:'current'});
});

test('explicit saved-note questions get a clean knowledge scope without mutating retained history',()=>{
 assert.equal(typeof router.resolveSubmittedTurnIntent,'function');
 const before=structuredClone(prior);
 const result=route({question:'In the saved blue lantern meeting note, what time is recorded?'});
 assert.deepEqual(result.request,{action:'answer',query:'blue lantern meeting',target:'knowledge'});
 assert.deepEqual(result.context,{summary:'',recent:[],refs:[],turnCount:0});
 assert.deepEqual(prior,before);
});

test('explicit natural-language Memory searches skip model routing and keep the named topic',async()=>{
 for(const [question,query] of [
  ['Find my notes about the blue lantern meeting.','blue lantern meeting'],
  ['Search saved notes for evacuation maps','evacuation maps'],
  ['青いランタンについて保存したメモを探して','青いランタン'],
 ]){
  const before=structuredClone(prior),literalRequest=question.startsWith('Find')?{action:'search',query:'my notes about the blue lantern meeting'}:null,intent=route({question,literalRequest});
  assert.deepEqual(intent.request,{action:'search',query,target:'knowledge'});
  assert.deepEqual(intent.context,{summary:'',recent:[],refs:[],turnCount:0});
  assert.deepEqual(prior,before);
  let routed=0;
  const result=await router.resolveTurnRoute({current:intent.request,question,select:async()=>{routed++;return {request:null,reason:'ambiguous'};},plan:async()=>{routed++;return {action:'chat',query:''};},check:()=>{}});
  assert.equal(result.source,'explicit');assert.equal(routed,0);
 }
});

test('explicit saved-note open commands select a direct read route without changing context',async()=>{
 for(const [question,query] of [
  ['Open my note about the blue lantern meeting.','blue lantern meeting'],
  ['Read the saved file about evacuation maps','evacuation maps'],
  ['青いランタンについて保存したメモを開いて','青いランタン'],
 ]){
  const before=structuredClone(prior),intent=route({question,literalRequest:{action:'read',query:'my note about the blue lantern meeting.'},prior:{...prior,currentFile:undefined}});
  assert.deepEqual(intent.explicitSavedRequest,{action:'read',query,target:'knowledge'});
  assert.deepEqual(intent.request,{action:'read',query,target:'knowledge'});
  assert.deepEqual(intent.context,{summary:'',recent:[],refs:[],turnCount:0});
  assert.deepEqual(prior,before);
  let routed=0;
  const result=await router.resolveTurnRoute({current:intent.request,question,select:async()=>{routed++;return {request:null,reason:'ambiguous'};},plan:async()=>{routed++;return {action:'chat',query:''};},check:()=>{}});
  assert.equal(result.source,'explicit');assert.equal(routed,0);
 }
});

test('saved-note open shortcut rejects questions, mixed actions, attachments, dialogue and vague targets',()=>{
 for(const question of [
  'What is in my saved note about the blue lantern meeting?',
  'Open my note about the blue lantern meeting and summarize it.',
  'Open my saved note about the blue lantern meeting from earlier.',
  'Open my note',
 ])assert.equal(router.explicitSavedKnowledgeOpen(question),null,question);
 assert.equal(route({question:'What is in my saved note about the blue lantern meeting?',prior:{...prior,currentFile:undefined}}).request.action,'answer');
 assert.equal(router.explicitSavedKnowledgeOpen('Open my note about the blue lantern meeting.',true),null);
 assert.equal(router.explicitSavedKnowledgeOpen('Open my note about the blue lantern meeting from earlier.'),null);
});

test('natural Memory search does not steal attachment, question, capture, or opened-file requests',()=>{
 assert.equal(route({question:'Find my notes about the blue lantern meeting.',hasAttachments:true}).request,null);
 assert.equal(route({question:'What is in this image?',hasAttachments:true,hasCurrentInputReadings:true}).request.action,'answer');
 for(const question of ['What did we decide about the blue lantern meeting?','Write a note about my travel plans.','Find my notes','Find my notes about the blue lantern meeting and summarize them.'])
  assert.equal(route({question,prior:{...prior,currentFile:undefined}}).request,null,question);
 assert.deepEqual(route({question:'Open my notes about travel',prior:{...prior,currentFile:undefined}}).request,{action:'read',query:'travel',target:'knowledge'});
});

test('explicit current-image questions select input evidence and exclude the open-file context',()=>{
 const formatted='What code is printed on the attached image? Reply with the code only.';
 const formattedRoute=route({question:formatted,hasAttachments:true,hasCurrentInputReadings:true});
 assert.deepEqual(formattedRoute.request,{action:'answer',query:formatted,target:'inputs'});assert.deepEqual(formattedRoute.context,{summary:'',recent:[],refs:[],turnCount:0});
 const result=route({question:'What color is visible in this attached image?',hasAttachments:true,hasCurrentInputReadings:true,attachments:[{name:'photo.jpg',kind:'image',status:'Image text extracted'}]});
 assert.deepEqual(result.request,{action:'answer',query:'What color is visible in this attached image?',target:'inputs'});
 assert.deepEqual(result.context,{summary:'',recent:[],refs:[],turnCount:0});
});

test('questions naming the currently open file use that pinned file and exclude unrelated chat history',()=>{
 const question='What exact marker is written in the currently open transcript file?';
 assert.deepEqual(route({question:'What is the complete emergency marker in the currently open transcript file? Include every digit.'}).request,{action:'answer',query:'What is the complete emergency marker in the currently open transcript file? Include every digit.',target:'file'});
 const before=structuredClone(prior),intent=route({question});
 assert.deepEqual(intent.request,{action:'answer',query:question,target:'file'});
 assert.deepEqual(intent.context,{summary:'',recent:[],refs:[],turnCount:0});
 assert.deepEqual(prior,before);
 assert.equal(route({question,hasAttachments:true}).request,null);
 assert.equal(route({question,hasCurrentInputReadings:true}).request,null);
 assert.equal(route({question:'What did we say earlier about this file?'}).request,null);
});

test('source-free greetings receive a clean model context while prior dialogue stays retained',()=>{
 const before=structuredClone(prior),result=route({question:'Hello.'});
 assert.deepEqual(result.request,{action:'chat',query:''});
 assert.deepEqual(result.context,{summary:'',recent:[],refs:[],turnCount:0});
 assert.deepEqual(prior,before);
});

test('contextual questions keep the original working-file pin and relevant dialogue',()=>{
 const result=route();
 assert.equal(result.context.currentFile.noteId,'opened-file');
 assert.equal(result.context.recent[0].answer,'Move it to Monday at 10.');
 assert.equal(result.contextIndependent,null);
});

test('literal read commands retain path scope even when attachments are also present',()=>{
 const result=route({question:'Read: Notes/meeting.md',literalRequest:{action:'read',query:'Notes/meeting.md'},hasAttachments:true,hasCurrentInputReadings:true,attachments:[{name:'photo.jpg',kind:'image',status:'Image text extracted'}]});
 assert.deepEqual(result.request,{action:'read',query:'Notes/meeting.md',target:'path'});
});

test('unresolved ordinary submissions reach the planner instead of bypassing it as an explicit request',async()=>{
 for(const question of ['Use the calculator to work out (83 + 17) / 4, and give just the result.','それをもう少し短く説明して']){
  const intent=route({question,prior:{...prior,currentFile:undefined}}),events=[];
  const planned={action:'answer',query:question};
  const result=await router.resolveTurnRoute({current:intent.request,question,check:()=>{},plan:async()=>{events.push('plan');return planned;}});
  assert.deepEqual(events,['plan']);assert.deepEqual(result,{request:planned,source:'planner'});
  assert.equal(intent.request,null);
 }
});

test('unresolved submission uses the decision path and prepares continuation once before planning on abstention',async()=>{
 const question='Please organize the ideas from earlier into a short outline.',intent=route({question}),events=[];
 const planned={action:'summary',query:question};
 const result=await router.resolveTurnRoute({current:intent.request,question,check:()=>{},select:async()=>{events.push('decision');return {request:null,reason:'abstain'};},prepareContinuation:async source=>{events.push('prepare:'+source);},plan:async()=>{events.push('plan');return planned;}});
 assert.deepEqual(events,['decision','prepare:planner','plan']);assert.deepEqual(result,{request:planned,source:'planner',decisionReason:'abstain'});
});

test('accepted decision prepares its own continuation without preparing a planner context',async()=>{
 const events=[],request={action:'search',query:'meeting'};
 const result=await router.resolveTurnRoute({current:null,question:'Find meeting notes',check:()=>{},select:async()=>({request,reason:'selected'}),prepareContinuation:async source=>{events.push(source);},plan:async()=>{throw Error('Planner must not run');}});
 assert.deepEqual(events,['decision']);assert.deepEqual(result,{request,source:'decision',reason:'selected'});
});

test('the coordinator treats absent optional routes as unresolved at its public boundary',async()=>{
 let calls=0;const planned={action:'chat',query:'test'};
 const result=await router.resolveTurnRoute({current:undefined,question:'Please help',check:()=>{},plan:async()=>{calls++;return planned;}});
 assert.equal(calls,1);assert.equal(result.source,'planner');assert.deepEqual(result.request,planned);
});

test('standalone literal Japanese note requests review exact supplied text without unrelated dialogue',()=>{
 const clean={...prior,currentFile:undefined};
 for(const [question,body]of [['QA星見の持ち物は水と充電器。メモして。','QA星見の持ち物は水と充電器。'],['集合は11時。\n持ち物は水。記録してください。','集合は11時。\n持ち物は水。']]){
  const before=structuredClone(clean),intent=route({question,prior:clean});assert.deepEqual(intent.request,{action:'capture',query:'',body});assert.equal(intent.context.recent.length,0);assert.deepEqual(clean,before);
 }
 for(const question of ['今の回答をメモして。','このファイルをメモして。','天気を教えて。メモして。','Explain the plan. メモして。','水の量を計算して。メモして。','予定を検索して。記録して。','水を買う。要約してメモして。','QA星見の持ち物は水。メモして、実行して。'])assert.notEqual(route({question,prior:clean}).request?.action,'capture',question);
 assert.notEqual(route({question:'QA星見の持ち物は水。メモして。',prior:clean,hasAttachments:true}).request?.action,'capture');
 assert.deepEqual(route({question:'QA星見の持ち物は水。メモして。'}).request,{action:'capture',query:'',body:'QA星見の持ち物は水。'});
});

test('a deictic question can read the sole source of the immediate current answer without changing file selection',()=>{
 const question='そのメモの持ち物に充電器は含まれていますか？',ref={noteId:'packing',revision:2,start:0,end:4,quote:'水と灯り'};
 const answer={id:'latest',user:'持ち物は？',answer:'水と灯り',refs:[ref]},state={...prior,turns:[answer],currentFile:undefined,currentResult:{turnId:'latest'}};
 assert.deepEqual(route({question:"What's in that note?",prior:state}).sourceFile,{noteId:'packing',revision:2});
 const before=structuredClone(state),intent=route({question,prior:state});assert.deepEqual(intent.sourceFile,{noteId:'packing',revision:2});assert.deepEqual(intent.request,{action:'answer',query:question,target:'file'});assert.equal(intent.context.recent.length,0);assert.deepEqual(state,before);
 const failed={id:'failed',user:question,status:'Invalid model action'};
 assert.deepEqual(route({question,prior:{...state,turns:[answer,failed]}}).sourceFile,intent.sourceFile);
 for(const changed of [{...state,turns:[{...answer,refs:[]}]},{...state,turns:[{...answer,refs:[ref,{...ref,noteId:'other'}]}]},{...state,turns:[answer,{id:'cancelled',user:'note: new topic',status:'Save cancelled'}]},{...state,turns:[answer,{...failed,user:'Another request'}]}])assert.equal(route({question,prior:changed}).sourceFile,undefined);
 assert.equal(route({question,prior:state,hasAttachments:true}).sourceFile,undefined);
 assert.equal(route({question,prior:{...state,currentFile:{noteId:'opened',revision:1}}}).sourceFile,undefined);
 assert.deepEqual(route({question,prior:{...state,turns:[{...answer,refs:[ref,{...ref,start:1,end:3}]}]}}).sourceFile,{noteId:'packing',revision:2});
 for(const text of ["What does 'that note' mean?",'そのメモと他のメモの違いは？','そのメモを削除できますか？','そのメモを要約して保存できますか？','前の会話でそのメモについて何を言いましたか？'])assert.equal(route({question:text,prior:state}).sourceFile,undefined,text);
});
