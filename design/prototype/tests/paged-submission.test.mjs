import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeStore,projectNote} from '../src/knowledge-store.ts';
import {emptyDialogue,appendTurn,completeTurn} from '../src/conversation.ts';
import {executeSubmission} from '../src/submission-workflow.ts';
import {createSubmissionController} from '../src/submission-controller.ts';
import {startActivity,finishActivity} from '../src/harness-activity.ts';
import {makeDecimalReceipt} from '../src/tools/math.calculate/decimal-receipt.ts';
import * as calculator from '../src/tools/math.calculate/tool.ts';
import {createToolRegistry} from '../src/tools/tool-registry.ts';
import * as search from '../src/tools/memory.search/tool.ts';
import {createNote} from '../../../dist/core.js';

test('submission records more than 128 activities and preserves a grounded answer',async()=>{
 // Controlled planner outputs exercise the application path, not model quality.
 const store=new KnowledgeStore('paged-submit-'+crypto.randomUUID()),note=createNote({path:'Notes/review.md',body:'The first review is on Monday.'}),quote=note.revisions[0].body;
 const ref={noteId:note.id,revision:1,start:0,end:quote.length,quote,title:'Review',score:1};let dialogue=emptyDialogue(),stored,generated=0;
 try{
  const db=await store.open();await new Promise((resolve,reject)=>{const tx=db.transaction('notes','readwrite');tx.objectStore('notes').add(note);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
  store.search=async()=>[ref];store.views=async()=>[projectNote(note)];
  const pkg={definition:search.definition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search.'},{path:'Tools/memory.search/tool.ts',body:'bundled'}],run:search.run};
  const save=async next=>{await store.compareState('dialogue',stored,next);stored=dialogue=next;};
  const services={knowledge:store,builtinToolPackages:[pkg],builtinToolRegistry:createToolRegistry([pkg]),model:'test',ocrModel:'',ocrLanguage:'eng',speechModel:'',visionModel:'',visionAvailable:false,decisionModel:'',
   bonsai:{loaded:'test',busy:false,assets:{test:{filesPresent:true}},manifest:{contextTokens:8192,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>{generated++;if(generated<=70)return {text:JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:`review-${generated}`})}),finishReason:'stop'};if(generated===71)return {text:JSON.stringify({action:'answer',query:'review',target:'knowledge'}),finishReason:'stop'};return {text:JSON.stringify({answer:'The first review is on Monday.',citations:[{id:'S1',quote}]}),finishReason:'stop'};}},
   decision:{identity:{model:'',revision:'test'},enabled:false,ready:false},ocr:{ready:false},speech:{ready:false},vision:{},modelPreferences:{transcriptionLanguage:'auto',customSpeechModels:[],customVisionModels:[],customDecisionModels:[]},harnessPreferences:{replyStyle:'balanced',userGuidance:''},activeHarnessProfile:{id:'test-profile',label:'Test',enabledTools:['memory.search'],maxToolCalls:null,maxResultChars:8000},connectionPreferences:{diagnosticLogs:false},diagnostics:{getItem:()=>null,setItem:()=>{}},
   currentDialogue:()=>dialogue,storedDialogue:()=>stored,settled:async()=>{},saveDialogue:save,finishTurn:async(id,result)=>save(completeTurn(dialogue,id,result)),flushStorage:async()=>{},refreshStorage:async()=>{},refreshSnapshot:async()=>[],ensureProductRuntime:async()=>{},traceProcessing:async()=>{throw Error('Unexpected processing');}};
  const view={adopt:()=>{},consume:()=>{},composer:()=>({text:'',attachments:[]}),restore:()=>{},toast:()=>{},failure:()=>{},openNote:()=>{},saveCapture:()=>{},reviewCorrection:()=>{},reviewSchedule:()=>{},startToolPackageFromChat:()=>{},activityChanged:()=>{throw Error('Presentation failure');}};
  const controller=createSubmissionController();const outcome=await controller.run(run=>executeSubmission({text:'Compare my saved reviews in detail.',attachments:[]},services,view,run));
  assert.equal(outcome,'completed',JSON.stringify(controller.state));const turn=dialogue.turns.at(-1),paged=await store.turnActivities(turn.id);
  assert.equal(turn.answer,'The first review is on Monday.');assert.equal(turn.refs[0].noteId,note.id);assert.equal(turn.activity.length,128);assert.ok(paged.length>0);assert.equal(paged.at(-1).tool,'knowledge.answer');assert.equal(paged.at(-1).status,'succeeded');
  const backup=await store.backup();assert.ok(backup.payload.runs.some(item=>item.value?.type==='turn-activity-page'));
 }finally{store.close();}
});

test('a follow-up calculation can use an exact receipt stored in an overflow page',async()=>{
 const store=new KnowledgeStore('paged-calc-'+crypto.randomUUID()),inline=Array.from({length:128},(_,i)=>finishActivity(startActivity('memory.search',{query:`old-${i}`}),{output:[]}));
 const previous={id:'previous',user:'6 * 7',answer:'6 * 7 = 42',status:'Calculated',activity:inline};let dialogue=appendTurn(emptyDialogue(),previous),stored=dialogue;
 try{await store.compareState('dialogue',undefined,dialogue);const running=startActivity('math.calculate',{expression:'6 * 7'}),finished=finishActivity(running,{output:[makeDecimalReceipt('6 * 7')]});await store.recordTurnActivity(previous.id,running,dialogue);await store.recordTurnActivity(previous.id,finished,dialogue);
  const pkg={definition:calculator.definition,entry:'Tools/math.calculate/tool.ts',sources:[{path:'Tools/math.calculate/SKILL.md',body:'Calculate.'},{path:'Tools/math.calculate/tool.ts',body:'bundled'}],run:calculator.run};
  const save=async next=>{await store.compareState('dialogue',stored,next);stored=dialogue=next;};
  const services={knowledge:store,builtinToolPackages:[pkg],builtinToolRegistry:createToolRegistry([pkg]),model:'',ocrModel:'',ocrLanguage:'eng',speechModel:'',visionModel:'',visionAvailable:false,decisionModel:'',bonsai:{loaded:'',busy:false,assets:{},manifest:{models:[],runtime:{revision:'fixture'}}},decision:{identity:{model:'',revision:'test'},enabled:false,ready:false},ocr:{ready:false},speech:{ready:false},vision:{},modelPreferences:{transcriptionLanguage:'auto',customSpeechModels:[],customVisionModels:[],customDecisionModels:[]},harnessPreferences:{replyStyle:'balanced',userGuidance:''},activeHarnessProfile:{id:'test-profile',label:'Test',enabledTools:['math.calculate'],maxToolCalls:null,maxResultChars:8000},connectionPreferences:{diagnosticLogs:false},diagnostics:{getItem:()=>null,setItem:()=>{}},currentDialogue:()=>dialogue,storedDialogue:()=>stored,settled:async()=>{},saveDialogue:save,finishTurn:async(id,result)=>save(completeTurn(dialogue,id,result)),flushStorage:async()=>{},refreshStorage:async()=>{},refreshSnapshot:async()=>[],ensureProductRuntime:async()=>{throw Error('Unexpected model load');},traceProcessing:async()=>{throw Error('Unexpected processing');}};
  const view={adopt:()=>{},consume:()=>{},composer:()=>({text:'',attachments:[]}),restore:()=>{},toast:()=>{},failure:()=>{},openNote:()=>{},saveCapture:()=>{},reviewCorrection:()=>{},reviewSchedule:()=>{},startToolPackageFromChat:()=>{}};
  const controller=createSubmissionController();assert.equal(await controller.run(run=>executeSubmission({text:'その結果を2で割って',attachments:[]},services,view,run)),'completed',JSON.stringify(controller.state));
  assert.match(dialogue.turns.at(-1).answer,/21/);assert.equal(dialogue.turns.at(-1).status,'Calculated');assert.deepEqual(await store.turnActivities(previous.id),[finished]);
 }finally{store.close();}
});
