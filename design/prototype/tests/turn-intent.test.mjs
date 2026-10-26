import test from 'node:test';
import assert from 'node:assert/strict';
import * as router from '../src/turn-router.ts';

const prior={schema:1,revision:1,turns:[{id:'turn-1',user:'What did we decide about the workshop?',answer:'Move it to Monday at 10.',refs:[{noteId:'meeting',revision:2,start:0,end:31,quote:'Workshop moved to Monday at 10.'}]}],compaction:null,currentFile:{noteId:'opened-file',revision:3}};
const route=(overrides={})=>{
 assert.equal(typeof router.resolveSubmittedTurnIntent,'function');
 return router.resolveSubmittedTurnIntent({
  question:'What did we decide about the workshop?',literalRequest:null,hasAttachments:false,hasCurrentInputReadings:false,prior,
  attachments:[],...overrides,
 });
};

test('an explicit rewrite of the current answer binds its immutable dialogue target before planning',()=>{
 for(const question of ['今の回答を日本語で短くまとめて。','直前の回答を英語に翻訳して。','Summarize your last answer in Japanese.','Please translate your previous response into French.']){
  const before=structuredClone(prior),intent=route({question});
  assert.deepEqual(intent.request,{action:'recall',query:question,target:'current'});
  assert.deepEqual(prior,before);
 }
 for(const question of ['Summarize the saved note about your last answer.','Translate your last answer and save it.','今の回答を保存して。','その内容を短くして。','Read: Notes/last-answer.md'])assert.notDeepEqual(route({question}).request,{action:'recall',query:question,target:'current'});
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
