import test from 'node:test';
import assert from 'node:assert/strict';
import {settings,validateSettings,mediaStatus} from '../src/app-settings.ts';

test('settings cannot declare installed media or grant remote/destructive execution',()=>{
 assert.equal(mediaStatus('image.read'),'Not prepared');
 assert.equal(mediaStatus('unknown',{'unknown':true}),'Unsupported');
 for(const key of ['implicitDownloads','automaticOverwrite','automaticDelete']){
  const candidate=structuredClone(settings);candidate.harness[key]=true;
  assert.throws(()=>validateSettings(candidate),/Unsafe/);
 }
 const candidate=structuredClone(settings);candidate.media.capabilities[0].ready=true;
 assert.throws(()=>validateSettings(candidate),/Unknown/);
});
test('configuration rejects unsupported models, budgets and missing fields',()=>{
 const candidate=structuredClone(settings);candidate.models.text[0].value='remote-model';
 assert.throws(()=>validateSettings(candidate),/Unsupported/);
 candidate.models.text[0].value='4B';candidate.media.maxTextBytes=2**30;
 assert.throws(()=>validateSettings(candidate),/budget/);
 delete candidate.media;assert.throws(()=>validateSettings(candidate));
});
test('validated defaults are copied and immutable and preserve protected roots',()=>{
 const candidate=structuredClone(settings),validated=validateSettings(candidate);
 candidate.defaults.background='sand';assert.equal(validated.defaults.background,'paper');
 assert.throws(()=>validated.storage.protectedRoots.pop(),TypeError);
 candidate.storage.protectedRoots[0]='Other';assert.throws(()=>validateSettings(candidate));
});
