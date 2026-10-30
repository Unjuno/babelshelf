import test from 'node:test';
import assert from 'node:assert/strict';
import * as router from '../src/turn-router.ts';
import {decisionMayRouteRequest,explicitlyNamedSearchResultIds,requestsCompoundSearchTask,requestsImplicitSearchReadAnswer,requestsLocalSearchReadAnswer,requestsMoreToolWorkAfterRead} from '../src/saved-knowledge-reference.ts';

test('current answer copy shortcut excludes compound requests and attachments',()=>{
 assert.deepEqual(router.explicitCurrentAnswerCapture('今の回答をメモに保存してください。'),{action:'capture',query:'',target:'current'});
 assert.deepEqual(router.explicitCurrentAnswerCapture('Save this answer as a note.'),{action:'capture',query:'',target:'current'});
 assert.equal(router.explicitCurrentAnswerCapture('今の回答をメモに保存してから翻訳して'),null);
 assert.equal(router.explicitCurrentAnswerCapture('今の回答をメモに保存して',true),null);
});

test('Remember colon is an exact model-free original capture command',()=>{
 const body='The emergency water reserve is exactly 24 litres. Identifier: LFM3-COLD-8C496430BFAAE3DD.';
 assert.deepEqual(router.explicitNewTextCapture(`Remember: ${body}`),{action:'capture',query:'',body});
 assert.deepEqual(router.explicitNewTextCapture(`remember:\n${body}\n`),{action:'capture',query:'',body});
 assert.equal(router.explicitNewTextCapture('Remember: ',false),null);
 assert.equal(router.explicitNewTextCapture(`Remember: ${body}`,true),null);
});

test('a completed read can skip only a redundant final tool-planning step',()=>{
 assert.equal(requestsMoreToolWorkAfterRead('Search Memory, read the matching note, then compare it with last week and calculate the change.'),true);
 assert.equal(requestsMoreToolWorkAfterRead('Search Memory, read the matching note, then search for the earlier version.'),true);
 assert.equal(requestsMoreToolWorkAfterRead('Search Memory for my saved note, read the complete file, then tell me its exact amount.'),false);
 assert.equal(requestsMoreToolWorkAfterRead('保存したメモを探して、ファイルを読んでから量を教えて。'),false);
});

test('compound-search read optimization binds only distinct, explicitly named result files',()=>{
 const question='Find the saved notes QA Alpine water plan and QA Birch water plan. Compare their amounts and cite both files.';
 const results=[{noteId:'alpine',title:'Notes/QA Alpine water plan.md'},{noteId:'birch',title:'Notes/QA Birch water plan.md'}];
 assert.deepEqual(explicitlyNamedSearchResultIds(question,results),['alpine','birch']);
 assert.deepEqual(explicitlyNamedSearchResultIds('Find water and battery notes and compare them.',[{noteId:'water',title:'Notes/water.md'},{noteId:'battery',title:'Notes/battery.md'}]),[],'generic one-word topics do not count as explicit filenames');
 assert.deepEqual(explicitlyNamedSearchResultIds('Find Notes/alpha.md and Notes/beta.md and compare.',[{noteId:'alpha-1',title:'Notes/alpha.md'},{noteId:'alpha-2',title:'Archive/alpha.md'},{noteId:'beta',title:'Notes/beta.md'}]),[],'duplicate basenames remain ambiguous');
 assert.deepEqual(explicitlyNamedSearchResultIds(question,[...results,{...results[0],start:400}]),['alpine','birch'],'multiple excerpts of the same record remain one exact ID');
});

test('local search-read-answer work bypasses single-action routing regardless of requested order',()=>{
 const requests=[
  'I have a saved note somewhere about an emergency water reserve. Use the available local tools to find the note, read it, then tell me the exact reserve amount and identifier.',
  'Search local Memory for my saved emergency water reserve note, read the exact file, then tell me its exact amount and identifier.',
  'Find a saved note about my emergency water reserve, read the complete matching file, and only after reading tell me the exact amount and identifier it records.',
  'Find my saved file Local QA fixture and tell me the unique test value.',
  'Check the saved emergency water reserve note in Memory again and confirm its exact amount and identifier.',
  '保存した備蓄メモを探して、ファイルを読んでから量を教えて。',
  'Read Notes/water.md first, then search Memory for my saved reserve note and tell me whether the values match.',
 ];
 for(const question of requests){assert.equal(requestsLocalSearchReadAnswer(question),true,question);assert.equal(decisionMayRouteRequest(true,true,question),false,question);}
 for(const question of ['What is my saved meeting note?','Find saved meeting notes.','Read Notes/meeting.md','Search local notes and explain how the search works.','Search Memory and explain how the read tool works.','Search my saved note about how to read files and tell me the main point.','Check whether Memory works.','Can you confirm our meeting time?','検索機能と読み取り機能を説明して。']){
  assert.equal(requestsLocalSearchReadAnswer(question),false,question);assert.equal(decisionMayRouteRequest(true,true,question),true,question);
 }
 assert.equal(requestsImplicitSearchReadAnswer('Search Memory for test marker MAPLE-6204 and tell me where the meeting place is.'),true);
 assert.equal(requestsLocalSearchReadAnswer('Find my saved file Local QA fixture and tell me the unique test value.'),true);
 assert.equal(requestsImplicitSearchReadAnswer('Find my saved file Local QA fixture and tell me the unique test value.'),true);
 assert.equal(requestsImplicitSearchReadAnswer('Search local notes and explain how the search works.'),false,'explaining the search feature is not a request to read search results');
 assert.equal(requestsImplicitSearchReadAnswer('Search Memory, read the matching note, then tell me its exact amount.'),false,'an explicitly requested read stays with the model planner');
 assert.equal(decisionMayRouteRequest(false,true,requests[0]),false);assert.equal(decisionMayRouteRequest(true,false,requests[0]),false);
 assert.equal(decisionMayRouteRequest(true,true,'What should I do with this note?','native-tool-calls'),false,'native-tool planner owns tool and action selection');
});

test('implicit Memory search answers are recognized across the LFM3 language set without capturing search-only requests',()=>{
 const examples=[
  'ابحث في الذاكرة عن موعد الاجتماع وأخبرني به.',
  '在记忆中搜索会议地点并告诉我。',
  'Cherche dans la mémoire le lieu de réunion et dis-moi où il est.',
  'Suche im Memory nach dem Treffpunkt und sag mir, wo er ist.',
  'Cerca nella memoria il luogo della riunione e dimmi dov’è.',
  'Search Memory for the meeting place and tell me where it is.',
  'Busca en la memoria el lugar de la reunión y dime dónde está.',
  'Pesquise na memória o local da reunião e me diga onde fica.',
  '메모리에서 회의 장소를 검색하고 어디인지 알려줘.',
  'Tìm trong bộ nhớ địa điểm họp và cho tôi biết ở đâu.',
  'Cari di Memori lokasi rapat dan beri tahu saya di mana.',
  'स्मृति में बैठक की जगह खोजें और मुझे बताएं कि वह कहाँ है।',
  'Найди в памяти место встречи и скажи, где оно.',
  'Wyszukaj w pamięci miejsce spotkania i powiedz mi, gdzie jest.',
  'ค้นหาสถานที่ประชุมในความจำแล้วบอกฉันว่าอยู่ที่ไหน',
 ];
 for(const question of examples)assert.equal(requestsImplicitSearchReadAnswer(question),true,question);
 for(const question of ['Busca notas guardadas sobre la reunión.','Cherche dans la mémoire le lieu de réunion.','在记忆中搜索会议地点。','ค้นหาสถานที่ประชุมในความจำ'])assert.equal(requestsImplicitSearchReadAnswer(question),false,question);
 for(const question of ['Busca en la memoria dos planes, compáralos y dime la diferencia.','Cherche dans la mémoire les deux plans, compare-les et dis-moi la différence.','在记忆中搜索两个方案，比较它们并告诉我差异。']){
  assert.equal(requestsLocalSearchReadAnswer(question),true,question);assert.equal(requestsImplicitSearchReadAnswer(question),false,question);
 }
 assert.equal(requestsImplicitSearchReadAnswer('Cherche dans la mémoire le lieu de réunion, lis la note correspondante et dis-moi où il est.'),false,'an explicit localized read remains model-directed');
});

test('decision routing does not evict a resident Text model or load before Text files are ready',()=>{
 const request='What should I do with this note?';
 assert.equal(decisionMayRouteRequest(true,true,request,'json',{textResident:true,textFilesPresent:true}),false);
 assert.equal(decisionMayRouteRequest(true,true,request,'json',{textResident:false,textFilesPresent:false}),false);
 assert.equal(decisionMayRouteRequest(true,true,request,'json',{textResident:false,textFilesPresent:true}),true);
});

test('unspecified saved search excludes topics, context, compound actions and attachments',()=>{
 for(const q of ['保存したメモを探して','保存済みのファイルを検索してください','Find my notes'])assert.equal(router.unspecifiedSavedSearch(q),true,q);
 for(const q of ['保存した集合場所のメモを探して','保存したメモを探して要約して','さっきの保存したメモを探して','Find my notes about the meeting'])assert.equal(router.unspecifiedSavedSearch(q),false,q);
 assert.equal(router.unspecifiedSavedSearch('保存したメモを探して',true),false);
});

test('clarification accepts only a short topic after the immediately preceding search question',()=>{
 const prior={schema:1,revision:1,turns:[{id:'q',user:'保存したメモを探して',status:'What should I search for?'}],compaction:null};
 assert.deepEqual(router.clarifiedSavedSearch('集合場所',prior),{action:'search',query:'集合場所',target:'knowledge'});
 for(const text of ['保存して','メモを削除して','hello?','2 + 2','ありがとう','こんにちは','thank you','hello'])assert.equal(router.clarifiedSavedSearch(text,prior),null,text);
 assert.equal(router.clarifiedSavedSearch('集合場所',prior,true),null);
 assert.equal(router.clarifiedSavedSearch('集合場所',{...prior,turns:[...prior.turns,{id:'next',user:'hi'}]}),null);
});

test('thanks after a search clarification keeps that turn without old history or planning',()=>{
 const previous={id:'q',user:'保存したメモを探して',status:'What should I search for?'},state={...prior,turns:[...prior.turns,previous]};
 const result=router.resolveSubmittedTurnIntent({question:'ありがとう',literalRequest:null,hasAttachments:false,hasCurrentInputReadings:false,prior:state,attachments:[]});
 assert.deepEqual(result.request,{action:'chat',query:''});
 assert.deepEqual(result.context.recent,[previous]); assert.deepEqual(result.context.refs,[]); assert.equal(result.context.summary,'');
 assert.equal(state.turns.length,2);
 const contextual=router.resolveSubmittedTurnIntent({question:'ありがとう、さっきの予定は？',literalRequest:null,hasAttachments:false,hasCurrentInputReadings:false,prior:state,attachments:[]});
 assert.notDeepEqual(contextual.context.recent,[previous]);
 const attached=router.resolveSubmittedTurnIntent({question:'ありがとう',literalRequest:null,hasAttachments:true,hasCurrentInputReadings:true,prior:state,attachments:[{name:'image.png',kind:'image',status:'ready'}]});
 assert.equal(attached.request?.action==='chat',false);
});

const prior={schema:1,revision:1,turns:[{id:'turn-1',user:'What did we decide about the workshop?',answer:'Move it to Monday at 10.',refs:[{noteId:'meeting',revision:2,start:0,end:31,quote:'Workshop moved to Monday at 10.'}]}],compaction:null,currentFile:{noteId:'opened-file',revision:3}};

test('mixed attachment requests do not become direct read-only answers at the turn boundary',()=>{
 const attachments=[{name:'photo.png',kind:'image',status:'ready'}];
 for(const question of ['What is in this image and delete the file?','このファイルの値は何で、削除してください？','Using only the attached text, what is the phrase and search the memory?']){
  const result=router.resolveSubmittedTurnIntent({question,literalRequest:null,hasAttachments:true,hasCurrentInputReadings:true,prior,attachments});
  assert.equal(result.inputQuestion,null,question);assert.equal(result.request,null,question);
 }
 const question='Using only the attached text, what is the phrase? Reply with the phrase.';
 const result=router.resolveSubmittedTurnIntent({question,literalRequest:null,hasAttachments:true,hasCurrentInputReadings:true,prior,attachments});
 assert.deepEqual(result.request,{action:'answer',query:question,target:'inputs'});
});
test('cross-source input requests stay with the agent and may finish grounded in both scopes',()=>{
 for(const question of ['Compare the code in this attachment with my saved model notes.','What does this PDF say about my saved meeting notes?','この画像を保存したメモと比較して。']){
  const attachments=[{name:'source.pdf',kind:'pdf',status:'ready'}];
  const intent=router.resolveSubmittedTurnIntent({question,literalRequest:null,hasAttachments:true,hasCurrentInputReadings:true,prior,attachments});
  assert.equal(intent.inputQuestion,null,question);assert.equal(intent.request,null,question);
  const scoped=router.scopeResolvedTurnRequest({request:{action:'answer',query:question,target:'knowledge'},question,literal:false,inputs:[{kind:'pdf',noteId:'current-reading',revision:1}],currentFile:prior.currentFile});
  assert.equal(scoped.request.target,'knowledge',question);
  assert.equal(scoped.inputs.length,1);
 }
});

test('period-terminated direct file quotes bypass earlier dialogue context',()=>{
 const question='From this file, quote the complete sentence that states the water-cache amount.';
 const result=router.resolveSubmittedTurnIntent({question,literalRequest:null,hasAttachments:false,hasCurrentInputReadings:false,prior,attachments:[]});
 assert.deepEqual(result.request,{action:'answer',query:question,target:'file'});
 assert.deepEqual(result.context,{summary:'',recent:[],refs:[],turnCount:0});
 const attached=router.resolveSubmittedTurnIntent({question,literalRequest:null,hasAttachments:true,hasCurrentInputReadings:true,prior,attachments:[{name:'field-notes.md',kind:'text',status:'Text available'}]});
 assert.deepEqual(attached.request,{action:'answer',query:question,target:'inputs'});
 assert.deepEqual(attached.context,{summary:'',recent:[],refs:[],turnCount:0});
});

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
  ['保存した「QA星見」のメモを短く要約して。','QA星見'],
  ['保存した『QA星見』のメモを短く要約して。','QA星見'],
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
 for(const question of ['集合場所を南口に直して。','このファイルの時刻を10時に変更してください。','このファイルの集合場所を北口から南口に直して。持ち物は変えないで。','Change the meeting place to the south gate.','In this file, replace north with south.']){
  const before=structuredClone(prior),intent=route({question});
  assert.deepEqual(intent.request,{action:'edit',query:question,target:'file'});
  assert.deepEqual(intent.context,{summary:'',recent:[],refs:[],turnCount:0});assert.deepEqual(prior,before);
 }
 for(const question of ['Change your last answer to French.','Change another file to south.','別のファイルの集合場所を南口に直して。','集合場所を南口に直して、時刻を10時に変更して。','Replace the text in Notes/other.md with south.','Change the meeting place to south and save a new note.','集合場所を南口に直して。それから保存して。','集合場所を南口に直して。保存して持ち物は変えないで。','Set the timer to ten minutes.','What would change the meeting place to south?'])assert.notEqual(route({question}).request?.action,'edit',question);
 assert.equal(route({question:'集合場所を南口に直して。',hasAttachments:true}).request,null);
 assert.equal(route({question:'集合場所を南口に直して。',prior:{...prior,currentFile:undefined}}).request,null);
});

test('an explicit rewrite of the current answer binds its immutable dialogue target before planning',()=>{
 for(const question of ['前の回答を一文でまとめて。','今の回答を日本語で短くまとめて。','今の回答をチェックリストにして。','直前の回答を表にして。','Format your last answer as a table.','Put your previous response into a checklist.','直前の回答を英語に翻訳して。','Summarize your last answer in Japanese.','Please translate your previous response into French.']){
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
  ['「青いランタン」について保存したメモを探して','青いランタン'],
  ['『青いランタン』について保存したメモを探して','青いランタン'],
  ['保存した集合場所のメモを探して。','集合場所'],
  ['保存済みの避難準備のノートを検索してください。','避難準備'],
  ['私の「旅行」の文書を見つけて。','旅行'],
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

test('saved-topic search does not absorb compound instructions or ambiguous targets',()=>{
 for(const question of ['保存したメモを探して。','保存した集合場所のメモを探して保存して。','保存した集合場所のメモを探して、削除して。','前の会話で保存した集合場所のメモを探して。','保存したこのメモを探して。'])assert.equal(router.explicitSavedKnowledgeSearch(question),null,question);
 assert.equal(router.explicitSavedKnowledgeSearch('保存した集合場所のメモを探して。',true),null);
 for(const text of ['削除してから会議について保存したメモを探して','送信してから備蓄について保存したメモを探して','メモから削除してから会議を探して'])assert.equal(router.explicitSavedKnowledgeSearch(text),null,text);
 assert.deepEqual(router.explicitSavedKnowledgeSearch('会議について保存したメモを探して'),{action:'search',query:'会議',target:'knowledge'});
 for(const text of ['削除履歴について保存したメモを探して','保存した削除履歴のメモを探して'])assert.deepEqual(router.explicitSavedKnowledgeSearch(text),{action:'search',query:'削除履歴',target:'knowledge'},text);
});

test('saved-note questions with additional write or external actions do not bypass planning',()=>{
 for(const question of ['What time is my saved zephyr meeting note? Delete it.','What is in my saved water note? Save the answer.','保存した備蓄のメモの量は何ですか？訂正してください。']){
  assert.equal(router.explicitSavedKnowledgeQuestion(question),null,question);
  const state={schema:1,revision:0,turns:[],compaction:null};
  const intent=router.resolveSubmittedTurnIntent({question,literalRequest:null,hasAttachments:false,hasCurrentInputReadings:false,prior:state,attachments:[]});
  assert.equal(intent.explicitSavedRequest,null,question);
 }
 assert.equal(router.explicitSavedKnowledgeQuestion('What time is my saved zephyr meeting note?')?.action,'answer');
});

test('compound search-read-answer requests stay on the model planner route',()=>{
 const question='I have a saved note somewhere about an emergency water reserve. Use the available local tools to find the note, read it, then tell me the exact reserve amount and identifier.';
 assert.equal(router.explicitSavedKnowledgeQuestion(question),null);
 const intent=route({question,prior:{schema:1,revision:0,turns:[],compaction:null}});
 assert.equal(intent.explicitSavedRequest,null);
 assert.equal(intent.request,null);
 const parsed=router.resolveSubmittedTurnIntent({question:'Search local Memory for my saved emergency water reserve note, read the exact file, then tell me its exact amount and identifier.',literalRequest:{action:'search',query:'emergency water reserve'},hasAttachments:false,hasCurrentInputReadings:false,prior,attachments:[]});
 assert.equal(parsed.literalRequest,null);assert.equal(parsed.explicitSavedRequest,null);assert.equal(parsed.request,null);
});

test('literal Find shortcuts yield to explicit follow-up operations',()=>{
 const question='Find the saved notes QA Alpine water plan and QA Birch water plan. Compare their exact emergency water amounts, calculate the combined total and the difference, and cite both files.';
 assert.equal(requestsCompoundSearchTask(question),true);
 const parsed=router.resolveSubmittedTurnIntent({question,literalRequest:{action:'search',query:'saved notes QA Alpine water plan and QA Birch water plan. Compare their exact emergency water amounts, calculate the combined total and the difference, and cite both files.'},hasAttachments:false,hasCurrentInputReadings:false,prior:{schema:1,revision:0,turns:[],compaction:null},attachments:[]});
 assert.equal(parsed.literalRequest,null);assert.equal(parsed.explicitSavedRequest,null);assert.equal(parsed.request,null);
 const directAnswer='Search Memory for test marker MAPLE-6204 and tell me where the meeting place is.';
 assert.equal(requestsCompoundSearchTask(directAnswer),true,'a search followed by a natural-language answer request must continue through the agent');
 assert.equal(requestsCompoundSearchTask('保存した Test-reserve.md と Test-reserve-second.md を探して読み、集合場所と飲料水の量を比較してください。'),true,'Japanese filename-first requests stay on the agent path');
 const directParsed=router.resolveSubmittedTurnIntent({question:directAnswer,literalRequest:{action:'search',query:'test marker MAPLE-6204'},hasAttachments:false,hasCurrentInputReadings:false,prior:{schema:1,revision:0,turns:[],compaction:null},attachments:[]});
 assert.equal(directParsed.literalRequest,null);assert.equal(directParsed.request,null,'do not finish at a search result when the user asked for an answer');
 for(const question of ['Find my notes about the blue lantern meeting.','Search saved notes for evacuation maps','Find saved notes about how to compare water systems.'])assert.equal(requestsCompoundSearchTask(question),false,question);
});

test('a named my-note question selects Memory even with a different file open',()=>{
 const input={question:'How much water is in my solar dock note?',literalRequest:null,hasAttachments:false,hasCurrentInputReadings:false,prior,attachments:[]};
 assert.deepEqual(router.resolveSubmittedTurnIntent(input).request,{action:'answer',query:'solar dock',target:'knowledge'});
 const explicitMemory=router.resolveSubmittedTurnIntent({...input,question:'Search Memory for test marker MAPLE-6204 and tell me where the meeting place is.'});
 assert.equal(explicitMemory.request,null,'search-and-answer stays on the agent route');assert.equal(explicitMemory.context.currentFile,undefined,'explicit Memory scope does not inherit an unrelated opened file');
 assert.equal(router.explicitSavedKnowledgeQuestion('What is in my current note?',false,true),null);
 const current='In my current note, is the example tool enabled?';
 assert.deepEqual(router.explicitWorkingFileQuestion(current,true),{action:'answer',query:current,target:'file'});
 assert.equal(router.explicitSavedKnowledgeQuestion(current,false,true),null);
});

test('short Japanese search is local only for an unscoped single subject',()=>{
 assert.deepEqual(router.shortLocalSearch('QA銀の灯台を探して'),{action:'search',query:'QA銀の灯台',target:'knowledge'});
 for(const text of ['これを探して','前の会話を探して','ウェブで灯台を探して','灯台を探して保存して','灯台を探して、削除して','添付の灯台を探して'])assert.equal(router.shortLocalSearch(text),null,text);
 assert.equal(router.shortLocalSearch('QA銀の灯台を探して',true),null);
 const state={schema:1,revision:0,turns:[],compaction:null};
 const input={question:'QA銀の灯台を探して',literalRequest:null,hasAttachments:false,hasCurrentInputReadings:false,prior:state,attachments:[]};
 assert.deepEqual(router.resolveSubmittedTurnIntent(input).request,{action:'search',query:'QA銀の灯台',target:'knowledge'});
 assert.equal(router.resolveSubmittedTurnIntent({...input,prior:{...state,currentFile:{noteId:'pinned',revision:1}}}).explicitSavedRequest,null);
 assert.equal(router.resolveSubmittedTurnIntent({...input,hasAttachments:true}).explicitSavedRequest,null);
});

test('explicit saved-note open commands select a direct read route without changing context',async()=>{
 for(const [question,query] of [
  ['Open my note about the blue lantern meeting.','blue lantern meeting'],
  ['Read the saved file about evacuation maps','evacuation maps'],
  ['青いランタンについて保存したメモを開いて','青いランタン'],
  ['「青いランタン」について保存したメモを開いて','青いランタン'],
  ['『青いランタン』について保存したメモを開いて','青いランタン'],
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


test('a follow-up about the cited place uses only the matching pinned file and rejects competing intent',()=>{
 const ref={noteId:'opened-file',revision:3,start:0,end:8,quote:'集合は北口。'};
 const answer={id:'place',user:'このファイルの集合場所はどこ？',answer:'北口です。',refs:[ref]};
 const state={...prior,turns:[answer],currentResult:{turnId:'place'}};
 const question='そこへ持っていくものは？';
 const result=route({question,prior:state});
 assert.deepEqual(result.request,{action:'answer',query:question,target:'file'});
 assert.deepEqual(result.context,{summary:'',recent:[],refs:[],turnCount:0});
 assert.deepEqual(route({question,prior:{...state,turns:[answer,{id:'retry',user:question,status:'Invalid model action'}]}}).request,result.request);
 for(const s of [{...state,currentFile:{noteId:'other',revision:3}},{...state,currentFile:{noteId:'opened-file',revision:4}},{...state,turns:[{...answer,refs:[]}]},{...state,turns:[{...answer,refs:[ref,{...ref,noteId:'other'}]}]},{...state,turns:[answer,{id:'new',user:'別の話題',answer:'別の場所'}]}])assert.notDeepEqual(route({question,prior:s}).request,result.request);
 for(const text of ['そこへ持っていくものは？削除して','そこへ持っていくものを保存できますか？','そこへ持っていくものは？別のメモも探して','そこへメールを送れますか？','前の会話ではそこへ何を持っていくと言った？'])assert.notEqual(route({question:text,prior:state}).request?.target,'file',text);
 assert.notEqual(route({question,prior:state,hasAttachments:true}).request?.target,'file');
});


test('read-only answer commands for the pinned file bypass planning without swallowing extra actions',()=>{
 const text='このファイルに書かれた持ち物だけを日本語で答えてください。';
 const intent=route({question:text});
 assert.deepEqual(intent.request,{action:'answer',query:text,target:'file'});
 assert.deepEqual(intent.context,{summary:'',recent:[],refs:[],turnCount:0});
 for(const other of ['このファイルを削除して結果を答えてください。','このファイルに書かれた内容を保存してから答えてください。','このファイルの内容を答えてください。別のファイルを消して。','このファイルに書かれた内容を答えて、メールを送ってください。'])assert.notEqual(route({question:other}).request?.target,'file',other);
 assert.equal(route({question:text,hasAttachments:true}).explicitFileQuestion,null);
 assert.equal(route({question:text,prior:{...prior,currentFile:undefined,turns:[]}}).explicitFileQuestion,null);
});

test('a single explicit current-file summary selects only its pinned source',()=>{
 for(const question of ['このファイルを短く要約してください。','このファイルを一文で短く要約してください。','このメモを1文でまとめて。','このメモをまとめて。','Please summarize this file briefly.','Summarize the current document.']){
  const intent=route({question});assert.deepEqual(intent.request,{action:'summary',query:question,target:'file'},question);assert.deepEqual(intent.context,{summary:'',recent:[],refs:[],turnCount:0});
 }
 for(const question of ['このファイルを要約して保存して。','このファイルを一文で短く要約してください。削除して。','このファイルを要約して、別のファイルを削除して。','Summarize this file and email it.','Summarize your last answer.','Summarize another file.'])assert.notEqual(route({question}).request?.action,'summary',question);
 assert.equal(route({question:'このファイルを短く要約してください。',hasAttachments:true}).explicitFileQuestion,null);
 assert.equal(route({question:'このファイルを短く要約してください。',prior:{...prior,currentFile:undefined}}).explicitFileQuestion,null);
});

test('explicit previous user message uses a bounded original exchange without changing history',()=>{
 const earlier={id:'older',user:'older secret',answer:'older answer'},last={id:'last',user:'こんにちは',answer:'こんにちは！'};
 const state={...prior,turns:[earlier,last],compaction:{through:1,summary:'stale summary'}},before=structuredClone(state);
 const result=route({question:'私が直前に言った挨拶は何ですか？',prior:state});
 assert.deepEqual(result.request,{action:'chat',query:'私が直前に言った挨拶は何ですか？'});
 assert.equal(result.context.summary,'');assert.deepEqual(result.context.recent,[last]);assert.deepEqual(result.context.refs,[]);assert.deepEqual(state,before);
 for(const question of ['私が以前言った挨拶は何ですか？','私が直前に言った挨拶は何ですか？そして保存して','私が直前に言った挨拶と以前の会話を比較して'])assert.notDeepEqual(route({question,prior:state}).request,{action:'chat',query:question},question);
 assert.notDeepEqual(route({question:'私が直前に言った挨拶は何ですか？',prior:state,hasAttachments:true}).request,{action:'chat',query:'私が直前に言った挨拶は何ですか？'});
});

test('explicit opened-file requests to explain named contents keep the pinned file scope',()=>{
 assert.deepEqual(router.explicitWorkingFileQuestion('このファイルに書かれた集合場所と飲料水の量を教えて。',true),{action:'answer',query:'このファイルに書かれた集合場所と飲料水の量を教えて。',target:'file'});
 const question='このファイルの集合場所と持ち物を日本語で教えてください。';
 assert.deepEqual(router.explicitWorkingFileQuestion(question,true),{action:'answer',query:question,target:'file'});
 for(const text of ['このファイルの集合場所を教えて保存してください。','このファイルの内容を削除して教えてください。','別のファイルの内容を教えてください。'])assert.equal(router.explicitWorkingFileQuestion(text,true),null,text);
 assert.equal(router.explicitWorkingFileQuestion(question,false),null);
 assert.equal(router.explicitWorkingFileQuestion(question,true,true),null);
});

test('natural input-file wording binds to the selected file and excludes unrelated dialogue history',()=>{
 const question='この入力ファイルに書かれている集合場所と持ち物を日本語で答えてください。';
 const unrelated=Array.from({length:91},(_,index)=>({id:`unrelated-${index}`,user:`Unrelated prior question ${index}`,answer:`Unrelated prior answer ${index}`}));
 const prior={schema:1,revision:1,turns:unrelated,compaction:null,currentFile:{noteId:'selected-input',revision:1}};
 const intent=route({question,prior});
 assert.deepEqual(intent.request,{action:'answer',query:question,target:'file'});
 assert.deepEqual(intent.context,{summary:'',recent:[],refs:[],turnCount:0});
});

test('ambiguous short search with a selected file gives a recovery hint only when a model is missing',()=>{
 const hint='Model not prepared · remove input file to search Memory';
 assert.equal(router.searchScopeFailure('Model not prepared · Settings','QA雨の日を探して',true,false),hint);
 assert.equal(router.searchScopeFailure('Model not configured','QA雨の日を探して',true,false),'Model not configured · remove input file to search Memory');
 for(const [status,question,file,attachments] of [['Stopped','QA雨の日を探して',true,false],['Model not prepared','QA雨の日を探して',false,false],['Model not prepared','QA雨の日を探して',true,true],['Model not prepared','削除して',true,false]])assert.equal(router.searchScopeFailure(status,question,file,attachments),status);
});
test('insufficient evidence display is scoped to inspected excerpts',()=>{
 assert.equal(router.searchScopeFailure('Insufficient evidence','What time?',true,false),'Could not answer from the selected excerpts');
 assert.equal(router.searchScopeFailure('Stopped','What time?',true,false),'Stopped');
 assert.equal(router.searchScopeFailure('Source changed · retry','What time?',true,false),'Source changed · retry');
});
