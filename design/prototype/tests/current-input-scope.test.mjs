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

import {explicitInputQuestion} from '../src/current-input-scope.ts';
test('plain-text attachment questions use the current inputs in Japanese and English',()=>{
 for(const question of ['この添付テキストの合言葉は何ですか？','添付の文章にあるコードは何ですか？','What is the code in this attached text?']){
  assert.deepEqual(explicitInputQuestion(question,true),{action:'answer',query:question,target:'inputs'});
  assert.equal(explicitInputQuestion(question,false),null);
 }
 for(const question of ['この添付テキストの合言葉は何で、削除してください？','What is in this attached text and delete the file?'])assert.equal(explicitInputQuestion(question,true),null);
});
test('an explicitly attachment-only text question remains read-only and excludes mixed commands',()=>{
 const question='Using only the attached text, what is the temporary bronze phrase? Reply with the phrase.';
 assert.deepEqual(explicitInputQuestion(question,true),{action:'answer',query:question,target:'inputs'});
 assert.equal(explicitInputQuestion(question,false),null);
 for(const text of ['Using only the attached text, what is the phrase and delete the file?','Using only the attached text, what is the phrase and search the memory?','Using only the attached text, what is the phrase? Save it.','Using only the attached text, what did I say earlier?','Using only the attached text, what is the phrase? What is the date?'])assert.equal(explicitInputQuestion(text,true),null);
});
test('self-contained questions about submitted files use a fixed read-only scope, while commands and prior dialogue stay planned',()=>{
 for(const question of ['What background color is visible in this image?','Which code is in the attached document?','この写真の背景は何色ですか？','What code is printed on the attached image? Reply with the code only.','Which date is in this file? Return the date only.'])assert.deepEqual(explicitInputQuestion(question,true),{action:'answer',query:question,target:'inputs'});
 for(const question of ['Delete this image.','Save this attachment.','What is in this image and delete the file?','このファイルの値は何で、削除してください？','What is in this image? Delete it.','What is in this image? What about that note?','What did I say earlier about this image?','What is the date?'])assert.equal(explicitInputQuestion(question,true),null);
 assert.equal(explicitInputQuestion('What color is in this image?',false),null);
});

test('audio-only video questions select a transcript-only view and refuse multiple inputs',()=>{
 const question='What code is spoken in the attached video? Use only the audio.',speech=[{kind:'speech',noteId:'transcript',revision:1}],vision=[{kind:'vision',noteId:'combined',revision:1}];
 assert.deepEqual(explicitInputQuestion(question,true),{action:'answer',query:question,target:'inputs'});
 assert.deepEqual(inputScope.constrainAudioOnlyInputs(question,speech,[{kind:'video'}]),speech);
 assert.deepEqual(inputScope.constrainAudioOnlyInputs(question,vision,[{kind:'video'}]),[{...vision[0],kind:'video-audio'}]);
 assert.throws(()=>inputScope.constrainAudioOnlyInputs(question,[...speech,...vision],[{kind:'video'}]),/Audio-only transcript unavailable/);
 assert.throws(()=>inputScope.constrainAudioOnlyInputs(question,speech,[{kind:'video'},{kind:'image'}]),/Audio-only transcript unavailable/);
 assert.equal(explicitInputQuestion('What is in this video and delete it? Use only the audio.',true),null);
 assert.equal(explicitInputQuestion('What is in this video? Use only the audio. Save it.',true),null);
});

test('literal PDF questions stay scoped to current originals without accepting mixed actions or earlier dialogue',()=>{
 for(const question of ['What is the silver code written on page 1 of this PDF? Reply with the code only.','Which date is printed in the attached PDF?','このPDFに記載されているコードは何ですか？'])assert.deepEqual(explicitInputQuestion(question,true),{action:'answer',query:question,target:'inputs'});
 for(const question of ['What is written in this PDF? Delete it.','What did I say earlier about this PDF?','What is in this PDF? What about that note?'])assert.equal(explicitInputQuestion(question,true),null);
 assert.equal(explicitInputQuestion('What is in this PDF?',false),null);
});

test('attachment-only questions also recognize PDF and other original media without enabling actions',()=>{
 for(const kind of ['PDF','document','image','audio','video']){
  const question=`Using only the attached ${kind}, what is the paper verification code?`;
  assert.deepEqual(explicitInputQuestion(question,true),{action:'answer',query:question,target:'inputs'});
  assert.equal(explicitInputQuestion(question,false),null);
 }
 for(const question of ['Using only the attached PDF, what is the code and delete the file?','Using only the attached PDF, what is the code? Save it.','Using only the attached PDF, what did I say earlier?'])assert.equal(explicitInputQuestion(question,true),null);
});
