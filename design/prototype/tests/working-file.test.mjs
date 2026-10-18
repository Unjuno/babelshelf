import test from 'node:test';
import assert from 'node:assert/strict';
import {createNote,reviseNote,withdrawNote} from '../../../dist/core.js';
import {emptyDialogue,validateDialogue,dialogueContext,historyPayload,planDialogue} from '../src/conversation.ts';
import {withWorkingFile,workingFileNote,workingFileMetadata,workingFileCoverage,workingFileEvidence,bindWorkingFileRequest,validateWorkingFileLink,createFileFocusQueue} from '../src/working-file.ts';

const note=()=>createNote({path:'Notes/focus.md',body:'The inventory code is COPPER-2816. Water is 3L.'});
test('file working target retains ID/version and refuses stale, withdrawn or missing originals',()=>{
 const n=note(),pin={noteId:n.id,revision:1},state=withWorkingFile(emptyDialogue(),pin);
 assert.deepEqual(validateDialogue(state).currentFile,pin);assert.deepEqual(dialogueContext(state).currentFile,pin);assert.deepEqual(historyPayload(dialogueContext(state)).currentFile,pin);
 assert.equal(workingFileNote([n],pin).id,n.id);assert.notEqual(workingFileNote([n],pin),n);
 const changed=reviseNote(n,{body:'Different'},1),withdrawn=withdrawNote(n,1);
 for(const records of [[],[changed],[withdrawn]])assert.throws(()=>workingFileNote(records,pin),/changed|unavailable/);
 assert.doesNotThrow(()=>validateWorkingFileLink([withdrawn],pin));assert.throws(()=>validateWorkingFileLink([n],{...pin,revision:99}));
 assert.throws(()=>validateDialogue({...state,currentFile:{...pin,permission:'write'}}));
 assert.deepEqual(state.turns,[]);assert.equal(withWorkingFile(state,pin),state);
});
test('file scope retrieves only exact selected eligible text, never a similarly named unrelated file',()=>{
 const n=note(),other=createNote({path:'Inbox/focus.md',body:'The inventory code is WRONG-999.'}),pin={noteId:n.id,revision:1};
 const refs=workingFileEvidence([n,other],pin,'inventory code');assert.ok(refs.length);assert.ok(refs.every(r=>r.noteId===n.id&&n.revisions[0].body.slice(r.start,r.end)===r.quote));assert.doesNotMatch(JSON.stringify(refs),/WRONG/);
});
test('focus persistence is serialized and a caller waits before capturing its Send snapshot',async()=>{
 let state=emptyDialogue(),release;const gate=new Promise(r=>release=r),writes=[];
 const queue=createFileFocusQueue(()=>state,async next=>{if(!writes.length)await gate;writes.push(next);state=next;});
 const a=queue.select({noteId:'a',revision:1}),b=queue.select({noteId:'b',revision:2});let captured;
 const wait=queue.settled().then(()=>captured=state.currentFile);await Promise.resolve();assert.equal(captured,undefined);release();await Promise.all([a,b,wait]);
 assert.equal(writes.length,2);assert.equal(state.revision,2);assert.deepEqual(captured,{noteId:'b',revision:2});
});
test('planner file scopes are finite and cannot mix identity with competing metadata',async()=>{
 const context={summary:'',recent:[],refs:[],turnCount:0,currentFile:{noteId:'n',revision:2}},engine=value=>({manifest:{contextTokens:2048},count:async()=>({prompt_tokens:200}),generate:async()=>({text:JSON.stringify(value)})});
 for(const action of ['read','answer','summary','edit'])assert.equal((await planDialogue(engine({action,query:'',target:'file'}),'this file',context)).target,'file');
 for(const value of [{action:'edit',query:'Notes/other.md',target:'path'},{action:'answer',query:'water',target:'knowledge'},{action:'answer',query:'inventory code',target:'file'}])assert.equal((await planDialogue(engine(value),'this file',context)).target,value.target);
 for(const value of [{action:'edit',query:'Notes/other.md',target:'path',revision:1},{action:'summary',query:'',target:'file',historyIndex:0},{action:'capture',query:'',target:'file'},{action:'edit',query:'',target:'file',noteId:'invented'}])await assert.rejects(()=>planDialogue(engine(value),'this file',context));
});

test('selected-file generation validates its scope again after generation and never falls back to other evidence',async()=>{
 const {groundedAnswer}=await import('../src/grounded-answer.ts');
 const n=note(),other=createNote({path:'Inbox/other.md',body:'Unrelated WRONG-999'}),pin={noteId:n.id,revision:1};let records=[n,other],calls=0;
 const engine={loaded:'4B',assets:{'4B':{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'4B',revision:'test'}],runtime:{revision:'test'}},count:async()=>({prompt_tokens:200}),generate:async messages=>{calls++;assert.doesNotMatch(JSON.stringify(messages),/WRONG-999/);return {text:JSON.stringify({answer:'COPPER-2816',citations:[{id:'S1',quote:'COPPER-2816'}]})};}};
 const store={all:async()=>records,search:async()=>{throw Error('No global search allowed');}};
 const result=await groundedAnswer(store,engine,'4B','What is this code?','','answer',undefined,()=>{},[],pin);assert.equal(result.sources[0].noteId,n.id);
 engine.generate=async()=>{calls++;records=[reviseNote(n,{body:'Changed'},1),other];return {text:JSON.stringify({answer:'COPPER-2816',citations:[{id:'S1',quote:'COPPER-2816'}]})};};
 await assert.rejects(()=>groundedAnswer(store,engine,'4B','What is this code?','','answer',undefined,()=>{},[],pin),/changed/i);
 const count=calls;await assert.rejects(()=>groundedAnswer(store,engine,'4B','retry','','answer',undefined,()=>{},[],pin),/changed/i);assert.equal(calls,count);
});

test('focus queue freezes selected identity and propagates CAS failures without overwriting later state',async()=>{
 let state=emptyDialogue(),attempts=0;const pin={noteId:'first',revision:1},queue=createFileFocusQueue(()=>state,async()=>{attempts++;throw Error('Conversation changed');});
 const pending=queue.select(pin);pin.noteId='mutated';await assert.rejects(pending,/changed/);await assert.rejects(queue.settled(),/changed/);
 await assert.rejects(queue.select({noteId:'next',revision:1}),/changed/);assert.equal(attempts,1);assert.deepEqual(state,emptyDialogue());
});

test('working-file audit metadata uses canonical legacy path fallback and remains portable JSON',()=>{
 const n=note();delete n.revisions[0].path;const meta=workingFileMetadata(n);assert.equal(typeof meta.path,'string');assert.ok(meta.path.endsWith('.md'));assert.deepEqual(JSON.parse(JSON.stringify(meta)),meta);
});

test('file scope retains extraction limits instead of implying raw media understanding',()=>{
 assert.match(workingFileCoverage({ocrText:{}}),/scene not processed/);assert.match(workingFileCoverage({pdfText:{}}),/coverage may be partial/);
 assert.match(workingFileCoverage({revisions:[{version:1,body:'Spoken text'}],transcription:{sourceTrack:'video-audio',text:'Spoken text'}}),/frames not processed; container timing unmapped/);
 assert.match(workingFileCoverage({originalAsset:{}}),/binary content not decoded/);
});

test('machine action catalog has separate exact IDs and shares target validation without output aliases',async()=>{
 const {harnessActionCatalog,validHarnessAction,validHarnessTarget}=await import('../src/harness-actions.ts');
 const catalog=JSON.parse(harnessActionCatalog());assert.equal(new Set(catalog.map(a=>a.id)).size,catalog.length);
 assert.ok(validHarnessAction('answer'));assert.ok(validHarnessAction('summary'));assert.equal(validHarnessAction('answer/summary'),false);
 assert.equal(validHarnessTarget('edit','file'),true);assert.equal(validHarnessTarget('capture','file'),false);
 const context={summary:'',recent:[],refs:[]},engine={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:100}),generate:async()=>({text:'{"action":"answer/summary","target":"file","query":""}'})};
 await assert.rejects(()=>planDialogue(engine,'this file',context),e=>e.diagnostic?.reason==='action');
});

test('unscoped file-capable requests use the harness file default while explicit scopes and attachments stay distinct',async()=>{
 const pin={noteId:'chosen',revision:2},raw={action:'answer',query:''},bound=bindWorkingFileRequest(raw,pin);
 assert.deepEqual(bound,{request:{action:'answer',query:'',target:'file'},binding:'default-working-file'});assert.deepEqual(raw,{action:'answer',query:''});
 assert.deepEqual(bindWorkingFileRequest({action:'edit',query:'free text instruction'},pin).request,{action:'edit',query:'free text instruction',target:'file'});
 for(const action of ['read','summary','edit'])assert.equal(bindWorkingFileRequest({action,query:''},pin).request.target,'file');
 for(const value of [{action:'search',query:''},{action:'chat',query:''},{action:'answer',query:'other topic',target:'knowledge'},{action:'recall',query:'',target:'current'}])assert.equal(bindWorkingFileRequest(value,pin).request,value);
 assert.equal(bindWorkingFileRequest(raw,pin,true).request,raw);assert.equal(bindWorkingFileRequest(raw,undefined).request,raw);
 assert.throws(()=>bindWorkingFileRequest({...raw,noteId:'invented'},pin));assert.throws(()=>bindWorkingFileRequest({...raw,historyIndex:0},pin));
 const context={summary:'',recent:[],refs:[],currentFile:pin},engine={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:100}),generate:async()=>({text:'{"action":"edit","query":""}'})};
 const parsed=await planDialogue(engine,'correct this file',context);assert.equal(parsed.target,undefined);assert.equal(bindWorkingFileRequest(parsed,pin).request.target,'file');
});

test('media-derived file scope finds a late relevant excerpt while retaining raw-source eligibility',()=>{
 const raw=createNote({path:'Files/recording.md',body:''});raw.originalAsset={id:raw.id,revision:1,sha256:'a'.repeat(64)};
 const derived=createNote({path:'Notes/transcript.md',body:'A'.repeat(900)+'\n\nThe vault code is COPPER-2816.'});derived.mediaSource={...raw.originalAsset};derived.transcription={sourceTrack:'audio'};
 const refs=workingFileEvidence([raw,derived],{noteId:derived.id,revision:1},'COPPER-2816');assert.ok(refs.some(r=>r.quote.includes('COPPER-2816')&&r.start>=902));assert.ok(refs.every(r=>r.noteId===derived.id));
 assert.throws(()=>workingFileEvidence([derived],{noteId:derived.id,revision:1},'COPPER-2816'),/eligible/);
});
test('approved status and rendered-file focus share one writer without self-conflicting or dropping either update',async()=>{
 const {createDialogueWriter}=await import('../src/dialogue-writer.ts');
 let state={...emptyDialogue(),turns:[{id:'turn',user:'Correct this file'}]},release;const gate=new Promise(r=>release=r);let commits=0;
 const writer=createDialogueWriter(()=>state,async next=>{if(!commits)await gate;assert.equal(next.revision,state.revision+1);commits++;state=next;});
 const {completeTurn}=await import('../src/conversation.ts');
 const status=writer.update(current=>completeTurn(current,'turn',{status:'Corrected v2'}));
 const focus=createFileFocusQueue(()=>state,next=>writer.update(current=>withWorkingFile(current,next.currentFile)));
 const selected=focus.select({noteId:'file',revision:2});release();await Promise.all([status,selected]);await writer.settled();await focus.settled();
 assert.equal(state.turns[0].status,'Corrected v2');assert.deepEqual(state.currentFile,{noteId:'file',revision:2});assert.equal(state.revision,2);
 await writer.update(current=>completeTurn(current,'turn',{status:'Retained'}));assert.equal(state.turns[0].status,'Retained');
});

test('dialogue writer refuses a stale bulk snapshot and propagates a genuine foreign CAS without retry',async()=>{
 const {createDialogueWriter}=await import('../src/dialogue-writer.ts'),{completeTurn}=await import('../src/conversation.ts');
 let state={...emptyDialogue(),turns:[{id:'turn',user:'Keep me'}]},release;const gate=new Promise(r=>release=r);
 const writer=createDialogueWriter(()=>state,async next=>{await gate;state=next;});
 const status=writer.update(current=>completeTurn(current,'turn',{status:'Retained'}));const stale=writer.replace({...state,revision:1,currentFile:{noteId:'x',revision:1}});release();await status;await assert.rejects(stale,/changed locally/);assert.equal(state.turns[0].status,'Retained');assert.equal(state.currentFile,undefined);
 let attempts=0;const foreign=createDialogueWriter(()=>state,async()=>{attempts++;throw Error('Foreign CAS');});
 await assert.rejects(foreign.update(current=>completeTurn(current,'turn',{status:'Do not commit'})),/Foreign CAS/);await assert.rejects(foreign.settled(),/Foreign CAS/);assert.equal(attempts,1);assert.equal(state.turns[0].status,'Retained');
});

test('literal user Read and global query routes keep explicit scope instead of inheriting a different current file',async()=>{
 const {localRequest}=await import('../../../dist/requests.js'),{scopeLiteralRequest}=await import('../src/working-file.ts');
 const pin={noteId:'file-A',revision:1};
 for(const text of ['Read Notes/other.md','読んで Notes/other.md','Open: Notes/other.md']){const request=scopeLiteralRequest(localRequest(text));assert.equal(request.target,'path');assert.equal(request.query,'Notes/other.md');assert.equal(bindWorkingFileRequest(request,pin).request,request);}
 for(const text of ['Answer: water','Summarize: water','Search: water']){const request=scopeLiteralRequest(localRequest(text));assert.equal(request.target,'knowledge');assert.equal(bindWorkingFileRequest(request,pin).request,request);}
 assert.equal(scopeLiteralRequest(localRequest('Answer: current attachment'),true).target,undefined);
 assert.equal(scopeLiteralRequest(null),null);
});

test('explicit dialogue recovery waits for all writers, validates latest state and never replays failed updates',async()=>{
 const {readDialogueRecovery}=await import('../src/dialogue-recovery.ts');let release,reads=0;const pending=new Promise(r=>release=r),latestState={...emptyDialogue(),revision:4,turns:[{id:'foreign',user:'Foreign retained original'}]};
 let done=false;const recovery=readDialogueRecovery([Promise.reject(Error('CAS')),pending],async()=>{reads++;return latestState;}).then(value=>{done=true;return value;});
 await Promise.resolve();assert.equal(reads,0);assert.equal(done,false);release();const result=await recovery;assert.deepEqual(result,{stored:latestState,value:latestState});assert.equal(reads,1);
 await assert.rejects(readDialogueRecovery([],async()=>({...latestState,schema:9})),/invalid/);
 await assert.rejects(readDialogueRecovery([],async()=>{throw Error('Read failed');}),/Read failed/);
 assert.deepEqual(await readDialogueRecovery([],async()=>undefined),{stored:undefined,value:emptyDialogue()});
});
