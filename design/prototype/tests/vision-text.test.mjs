import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOriginal,originalNote,originalKey} from '../src/original-assets.ts';
import {visionManifest} from '../src/vision-assets.ts';
import {makeVisionText,visionTextNote,validateVisionLinks} from '../src/vision-text.ts';
import {makeStateBackup,parseStateBackup} from '../src/backup-state.ts';
import {projectNote} from '../src/knowledge-store.ts';

const fixture=async()=>{const asset=await prepareOriginal(new File([new Uint8Array([137,80,78,71,1])],'field-note.png',{type:'image/png'}),'vision-source'),value=makeVisionText(asset,{model:visionManifest.id,revision:visionManifest.revision,runtime:visionManifest.runtime,prompt:'What is shown?',text:'A red marker beside a handwritten Japanese note.',width:1200,height:800}),note=visionTextNote('vision-note',asset,value);return {asset,value,note};};

test('reviewed image descriptions retain the raw image, exact model/runtime revision and become ordinary citable files',async()=>{
 const {asset,value,note}=await fixture(),state={notes:[originalNote(asset),note],settings:[],runs:[{key:originalKey(asset.id),value:asset}]};
 assert.equal(note.revisions[0].body,value.text);assert.equal(note.mediaSource.sha256,asset.sha256);assert.equal(note.visionText.prompt,'What is shown?');assert.equal(note.visionText.revision,visionManifest.revision);assert.deepEqual(projectNote(note).vision,{model:visionManifest.id,revision:visionManifest.revision,prompt:'What is shown?'});
 validateVisionLinks(state.notes,state.runs);const backup=await makeStateBackup(state),restored=await parseStateBackup(JSON.stringify(backup));assert.equal(restored.notes.find(n=>n.id===note.id).visionText.model,visionManifest.id);assert.equal(restored.runs[0].value.sha256,asset.sha256);
});

test('vision-derived files reject a detached or rewritten original and malformed model metadata',async()=>{
 const {asset,value,note}=await fixture();assert.throws(()=>validateVisionLinks([note],[]),/original unavailable/);assert.throws(()=>makeVisionText(asset,{...value,revision:'main'}),/metadata invalid/);
 const edited=structuredClone(note);edited.revisions[0].body='forged';assert.throws(()=>validateVisionLinks([edited],[{key:originalKey(asset.id),value:asset}]),/original text changed/);
});
