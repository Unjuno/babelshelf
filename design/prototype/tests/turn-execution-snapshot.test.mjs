import test from 'node:test';
import assert from 'node:assert/strict';
import {captureTurnExecutionSnapshot,turnExecutionReceipt} from '../src/turn-execution-snapshot.ts';

function input(overrides={}){
 const profile={id:'standard',label:'Standard',enabledTools:['memory.search','math.calculate'],maxToolCalls:null,maxResultChars:8000};
 const attachments=[{id:'asset-1',kind:'pdf',status:'Read',asset:{id:'asset-1',revision:1,sha256:'a'.repeat(64)},reading:{kind:'pdf',noteId:'reading-1',revision:1}}];
 return {turnId:'turn-1',textModel:'text-4b',textManifest:{models:[{id:'text-4b',revision:'model-r7'}],runtime:{revision:'runtime-r4'}},decisionModel:'decision-1',decisionIdentity:{model:'decision-1',revision:'decision-r2'},speechModel:'speech-1',ocrModel:'ocr-1',visionModel:'vision-1',settingsRevisions:{models:4,harness:7},profile,replyStyle:'detailed',userGuidance:'Use clear Japanese.',attachments,...overrides};
}

test('send snapshot copies and freezes selected models, harness, guidance and source identities',()=>{
 const source=input(),snapshot=captureTurnExecutionSnapshot(source);
 source.profile.enabledTools.push('user.new-tool');source.attachments[0].asset.sha256='b'.repeat(64);source.userGuidance='changed';
 assert.deepEqual(snapshot.harness.enabledTools,['memory.search','math.calculate']);assert.equal(snapshot.attachments[0].asset.sha256,'a'.repeat(64));assert.equal(snapshot.response.userGuidance,'Use clear Japanese.');
 assert.equal(snapshot.models.text.revision,'model-r7');assert.equal(snapshot.models.text.runtimeRevision,'runtime-r4');assert.equal(snapshot.models.decision.revision,'decision-r2');
 assert.deepEqual(snapshot.settingsRevisions,{models:4,harness:7});
 assert.ok(Object.isFrozen(snapshot));assert.ok(Object.isFrozen(snapshot.models));assert.ok(Object.isFrozen(snapshot.harness.enabledTools));assert.ok(Object.isFrozen(snapshot.attachments[0].asset));
});

test('execution receipt excludes guidance, attachment filenames and content',()=>{
 const snapshot=captureTurnExecutionSnapshot(input({attachments:[{id:'asset-2',kind:'text',status:'Read',name:'private-meeting.md'}],userGuidance:'private custom system instructions'}));
 const receipt=turnExecutionReceipt(snapshot);
 assert.equal(receipt.turnId,'turn-1');assert.equal(receipt.textModel,'text-4b');assert.equal(receipt.attachmentCount,1);
 assert.equal(receipt.modelSettingsRevision,4);assert.equal(receipt.harnessSettingsRevision,7);
 assert.doesNotMatch(JSON.stringify(receipt),/private|meeting\.md|guidance/i);
});
test('snapshot uses the selected model runtime before that model has loaded',()=>{
 const manifest={runtime:{revision:'previous-runtime'},models:[{id:'text-4b',revision:'model-r7',runtime:{revision:'selected-runtime'}}]};
 const snapshot=captureTurnExecutionSnapshot(input({textManifest:manifest}));assert.equal(snapshot.models.text.runtimeRevision,'selected-runtime');
});

test('execution snapshot rejects an invalid run identity or harness bounds',()=>{
 assert.throws(()=>captureTurnExecutionSnapshot(input({turnId:''})),/turn identity/);
 assert.throws(()=>captureTurnExecutionSnapshot(input({profile:{...input().profile,maxToolCalls:NaN}})),/harness profile/);
 assert.throws(()=>captureTurnExecutionSnapshot(input({settingsRevisions:{models:0,harness:1}})),/settings revision/);
});
