import test from 'node:test';import assert from 'node:assert/strict';
import {voicePrompt,bindVoice,validateVoiceInputs,transcriptCitationRange} from '../src/voice-input.ts';
import {makeTranscript} from '../src/speech-transcript.ts';import {prepareOriginal,originalRef,originalNote,originalKey} from '../src/original-assets.ts';
import {appendTurn,emptyDialogue,historyPayload,dialogueContext} from '../src/conversation.ts';
const fixture=async()=>{const asset=await prepareOriginal(new File(['raw audio'],'voice.wav',{type:'audio/wav'}),'voice1');const t=makeTranscript(asset,6000,{text:'First sentence. Second sentence.',chunks:[{text:'First sentence.',timestamp:[0,2]},{text:'Second sentence.',timestamp:[3,6]}]});return {asset,t};};
test('Use text preserves existing draft and binds only unique exact recognized words, while corrected prompts retain raw transcript',async()=>{
 const {asset,t}=await fixture(),text=voicePrompt('Existing draft',t);assert.equal(text,'Existing draft\n'+t.text);const voice=bindVoice(t,text);assert.equal(text.slice(voice.prompt.start,voice.prompt.end),t.text);assert.equal(bindVoice(t,'Corrected user words').prompt,null);assert.equal(bindVoice(t,t.text+' '+t.text).prompt,null);
 const turn={id:'turn',user:text,attachments:[{id:asset.id,name:asset.name,kind:'audio',status:'Transcript reviewed',asset:originalRef(asset),voice}]},state=appendTurn(emptyDialogue(),turn);validateVoiceInputs(state,[{key:originalKey(asset.id),value:asset}]);const payload=JSON.stringify(historyPayload(dialogueContext(state)));assert.ok(!payload.includes(asset.sha256));assert.ok(!payload.includes('modelEndMs'));assert.ok(!payload.includes('transcript'));assert.ok(payload.includes('First sentence.'));
 const bad=structuredClone(state);bad.turns[0].attachments[0].voice.prompt.start++;assert.throws(()=>validateVoiceInputs(bad,[{key:originalKey(asset.id),value:asset}]),/voice/i);
});
test('working voice survives state backup without becoming a searchable transcript note; forged provenance refuses',async()=>{
 const {makeStateBackup,parseStateBackup,stateHash}=await import('../src/backup-state.ts'),{asset,t}=await fixture(),user=voicePrompt('',t),dialogue=appendTurn(emptyDialogue(),{id:'voiceTurn',user,attachments:[{id:asset.id,name:asset.name,kind:'audio',status:'Transcript reviewed',asset:originalRef(asset),voice:bindVoice(t,user)}]});const pack=await makeStateBackup({notes:[originalNote(asset)],settings:[{key:'ui-v1-dialogue',value:dialogue}],runs:[{key:originalKey(asset.id),value:asset}]});const restored=await parseStateBackup(JSON.stringify(pack));assert.equal(restored.notes.length,1);assert.equal(restored.notes[0].revisions[0].body,'');assert.equal(restored.settings[0].value.turns[0].attachments[0].voice.transcript.text,t.text);
 const bad=structuredClone(pack);bad.payload.settings[0].value.turns[0].attachments[0].voice.transcript.original.sha256='0'.repeat(64);bad.sha256=stateHash(bad.payload);await assert.rejects(parseStateBackup(JSON.stringify(bad)));
});
test('source quote maps to estimated overlapping audio segments; edited or unmatched versions open whole recording',async()=>{
 const {t}=await fixture();assert.deepEqual(transcriptCitationRange(t,t.text,1,16,32),{startMs:3000,endMs:6000,label:'Estimated · 00:03.0–00:06.0'});assert.equal(transcriptCitationRange(t,t.text,1,0,t.text.length).startMs,0);assert.deepEqual(transcriptCitationRange(t,'Corrected words',2,0,9),{startMs:0,endMs:6000,label:'Whole recording · edited transcript'});assert.throws(()=>transcriptCitationRange(t,t.text,1,-1,4),/range/i);
});

test('audio labels round across minute boundaries and repeated recognized words map to the selected occurrence',async()=>{
 const {asset}=await fixture(),t=makeTranscript(asset,61000,{text:'Tail',chunks:[{text:'Tail',timestamp:[59.96,61]}]});assert.equal(transcriptCitationRange(t,t.text,1,0,4).label,'Estimated · 01:00.0–01:01.0');const repeated=makeTranscript(asset,6000,{text:'Echo. Echo.',chunks:[{text:'Echo.',timestamp:[0,2]},{text:'Echo.',timestamp:[3,6]}]});assert.equal(transcriptCitationRange(repeated,repeated.text,1,6,11).startMs,3000);
});

test('a unique cited phrase narrows a larger evidence excerpt to its segment, while ambiguous phrases retain full coverage',async()=>{
 const {t}=await fixture();assert.equal(transcriptCitationRange(t,t.text,1,0,t.text.length,'Second sentence.').startMs,3000);
 const repeated={...t,text:'Echo. Echo.',segments:[{...t.segments[0],text:'Echo.'},{...t.segments[1],text:'Echo.'}]};assert.equal(transcriptCitationRange(repeated,repeated.text,1,0,repeated.text.length,'Echo.').startMs,0);
});
