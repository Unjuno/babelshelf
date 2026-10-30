import test from 'node:test';
import assert from 'node:assert/strict';
import {createNote,latest,reviseNote} from '../../../dist/core.js';
import {initialPreferenceNotes,parsePreference,formatPreference} from '../src/preference-records.ts';
import {prepareToolLimitReview} from '../src/harness-profile-review.ts';
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
