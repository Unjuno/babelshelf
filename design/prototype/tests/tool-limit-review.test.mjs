import test from 'node:test';
import assert from 'node:assert/strict';
import {createNote,latest,reviseNote} from '../../../dist/core.js';
import {initialPreferenceNotes,parsePreference,formatPreference} from '../src/preference-records.ts';
import {hasLegacyStandardDefault,prepareLegacyStandardReview,prepareToolLimitReview} from '../src/harness-profile-review.ts';
import {applyCorrection,undoCorrection} from '../src/note-corrections.ts';

test('a legacy limit is changed only by an explicitly approved, version-checked proposal',async()=>{
 const seed=initialPreferenceNotes.find(note=>note.id==='settings-harness');
 const value=parsePreference('harness',seed.body);value.profiles.find(profile=>profile.id===value.activeProfileId).maxToolCalls=3;
 const note={...createNote({path:seed.path,body:formatPreference('harness',value)}),id:seed.id,ui:{managed:true,protected:false}};
 const before=structuredClone(note),proposal=await prepareToolLimitReview([note]);
 assert.deepEqual(note,before);
 const applied=applyCorrection([note],proposal),after=parsePreference('harness',latest(applied.note).body);
 assert.equal(after.profiles.find(profile=>profile.id===after.activeProfileId).maxToolCalls,null);
 assert.deepEqual(after.profiles.filter(profile=>profile.id!==after.activeProfileId),value.profiles.filter(profile=>profile.id!==value.activeProfileId));
 const restored=undoCorrection([applied.note],applied.receipt);
 assert.equal(parsePreference('harness',latest(restored.note).body).profiles.find(profile=>profile.id===after.activeProfileId).maxToolCalls,3);
 const changed=reviseNote(note,{body:proposal.after},1);
 assert.throws(()=>applyCorrection([changed],proposal),/Version conflict/);
 await assert.rejects(prepareToolLimitReview([applied.note]),/No three-call limit/);
});

test('only the untouched schema-1 Standard default gets an explicit profile migration proposal',async()=>{
 const seed=initialPreferenceNotes.find(note=>note.id==='settings-harness'),value=parsePreference('harness',seed.body);
 value.schemaVersion=1;
 value.profiles=value.profiles.map(profile=>profile.id==='standard'?{...profile,enabledTools:['memory.search','memory.read','math.calculate'],maxToolCalls:3}:profile.id==='source-first'?{...profile,enabledTools:['memory.search','memory.read'],maxToolCalls:2}:profile);
 const legacyBody='# Harness\n\n```json\n'+JSON.stringify(value,null,2)+'\n```\n';
 const note={...createNote({path:seed.path,body:legacyBody}),id:seed.id,ui:{managed:true,protected:false}};
 assert.equal(hasLegacyStandardDefault(note),true);
 const before=structuredClone(note),proposal=await prepareLegacyStandardReview([note]);
 assert.deepEqual(note,before);
 const proposed=parsePreference('harness',proposal.after),standard=proposed.profiles.find(profile=>profile.id==='standard');
 assert.deepEqual(standard.enabledTools,['memory.search','memory.list','memory.read','math.calculate','time.now']);
 assert.equal(standard.maxToolCalls,null);
 assert.deepEqual(proposed.profiles.find(profile=>profile.id==='source-first'),value.profiles.find(profile=>profile.id==='source-first'));
 assert.equal(proposed.profiles.find(profile=>profile.id==='conversation').maxToolCalls,0);
 const applied=applyCorrection([note],proposal),saved=parsePreference('harness',latest(applied.note).body);
 assert.deepEqual(saved.profiles.find(profile=>profile.id==='standard').enabledTools,standard.enabledTools);
 const undone=undoCorrection([applied.note],applied.receipt);
 assert.equal(latest(undone.note).body,legacyBody);

 const customized=structuredClone(note),custom=JSON.parse(latest(customized).body.match(/```json\n([\s\S]+)\n```/)[1]);
 custom.profiles.find(profile=>profile.id==='standard').enabledTools.push('time.now');
 const customizedNote=reviseNote(customized,{body:latest(customized).body.replace(/```json\n([\s\S]+)\n```/,()=> '```json\n'+JSON.stringify(custom,null,2)+'\n```')},1);
 assert.equal(hasLegacyStandardDefault(customizedNote),false);
 const currentSchema=structuredClone(note),current=JSON.parse(latest(currentSchema).body.match(/```json\n([\s\S]+)\n```/)[1]);current.schemaVersion=2;
 const currentSchemaNote=reviseNote(currentSchema,{body:latest(currentSchema).body.replace(/```json\n([\s\S]+)\n```/,()=> '```json\n'+JSON.stringify(current,null,2)+'\n```')},1);
 assert.equal(hasLegacyStandardDefault(currentSchemaNote),false);
});
