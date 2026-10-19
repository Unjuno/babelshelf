import test from 'node:test';
import assert from 'node:assert/strict';
import {visionManifest} from '../src/vision-assets.ts';
import {visionDescriptionInput} from '../src/asset-activity.ts';
import {activityTools,activityLabel,recordOperation} from '../src/harness-activity.ts';
import {processingUpdate,processingKey,validateProcessing} from '../src/processing-history.ts';

test('image understanding is a local, auditable processing action that keeps prompt content private in activity input',async()=>{
 const prompt='Describe the sign in Japanese',source={id:'image-id',revision:1,sha256:'a'.repeat(64),name:'photo.png'},input=visionDescriptionInput(visionManifest.id,source,prompt);
 assert.equal(input.allowNetwork,false);assert.equal(input.method,'local-only');assert.equal(input.promptCharacters,prompt.length);assert.equal(JSON.stringify(input).includes(prompt),false);
 assert.ok(activityTools.includes('image.describe'));assert.equal(activityLabel('image.describe'),'Describe image');
 const entries=[];await recordOperation('image.describe',input,async()=>({text:'看板',revision:visionManifest.revision}),async activity=>entries.push(activity));const started=processingUpdate(undefined,entries[0]),receipt=processingUpdate(started,entries[1]);validateProcessing(processingKey(receipt.activity.id),receipt);assert.equal(receipt.activity.status,'succeeded');
 assert.throws(()=>visionDescriptionInput('unregistered-model',source,prompt),/metadata invalid/);
});
