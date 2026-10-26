import {originalNote} from '../src/original-assets.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {executeSubmission} from '../src/submission-workflow.ts';
import {createSubmissionController} from '../src/submission-controller.ts';
import {createToolRegistry} from '../src/tools/tool-registry.ts';
import {definition,run as calculate} from '../src/tools/math.calculate/tool.ts';
import {emptyDialogue,completeTurn,validateDialogue} from '../src/conversation.ts';
import {createNote,searchNotes} from '../../../dist/core.js';
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

test('explicit Memory search still lists results with no configured model or completion inference',async()=>{
 for(const text of ['search: 集合場所','集合場所について保存したメモを探して']){
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
