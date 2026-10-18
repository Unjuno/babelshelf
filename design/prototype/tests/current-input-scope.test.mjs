import test from 'node:test';import assert from 'node:assert/strict';
import {planDialogue,planDialogueMessages} from '../src/conversation.ts';
import * as inputScope from '../src/current-input-scope.ts';
const {planningContextForInputs,bindCurrentInputRequest}=inputScope;
const context={summary:'',recent:[],refs:[],turnCount:1,currentFile:{noteId:'OLD-SETTINGS-TARGET',revision:3}},inputs=[{name:'new.md',kind:'text',status:'Text available'}];
test('current attachment retrieval uses the literal human request without rewriting planner evidence',()=>{
 const question='What is the marker in this attachment?',proposal={action:'answer',query:'Earlier marker OLD-481',target:'inputs'},before=structuredClone(proposal);
 assert.equal(typeof inputScope.groundingQuery,'function');assert.equal(inputScope.groundingQuery(question,proposal.query,true),question);assert.deepEqual(proposal,before);
 assert.equal(inputScope.groundingQuery(question,'resolved knowledge query',false),'resolved knowledge query');assert.equal(inputScope.groundingQuery(question,'',false),question);
});
test('new current inputs hide old file identity from planning without mutating durable focus',()=>{const scoped=planningContextForInputs(context,true);assert.equal(scoped.currentFile,undefined);assert.equal(context.currentFile.noteId,'OLD-SETTINGS-TARGET');assert.equal(planningContextForInputs(context,false),context);const messages=planDialogueMessages('Read the attached file',scoped,inputs);assert.ok(!JSON.stringify(messages).includes('OLD-SETTINGS-TARGET'));assert.match(messages[0].content,/inputs/);assert.ok(!JSON.stringify(planDialogueMessages('Attached file',context,inputs)).includes('OLD-SETTINGS-TARGET'));});
test('input targets are explicit typed scopes and cannot select files or history by metadata',async()=>{const engine={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:1}),generate:async()=>({text:JSON.stringify({action:'answer',query:'verification code',target:'inputs'})})};const scoped=planningContextForInputs(context,true);assert.equal((await planDialogue(engine,'Question',scoped,inputs)).target,'inputs');await assert.rejects(planDialogue(engine,'Question',context),/Invalid/);assert.deepEqual(bindCurrentInputRequest({action:'answer',query:'code'},true),{action:'answer',query:'code',target:'inputs'});assert.throws(()=>bindCurrentInputRequest({action:'answer',query:'code',target:'file'},true),/Choose/);assert.throws(()=>bindCurrentInputRequest({action:'answer',query:'code',target:'inputs'},false),/unavailable/);});

test('explicit dialogue original scopes remain intact until exact-original validation clears readings',()=>{for(const request of [{action:'recall',query:'',target:'current'},{action:'transform',query:'split',target:'history',historyIndex:0,historyPart:'assistant'},{action:'capture',query:'',target:'current'}])assert.equal(bindCurrentInputRequest(request,true),request);});

test('validated legacy indexed capture keeps its original selector with current attachments',()=>{const request={action:'capture',query:'',historyIndex:0,historyPart:'assistant'};assert.equal(bindCurrentInputRequest(request,true),request);});
