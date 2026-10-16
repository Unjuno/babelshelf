import test from 'node:test';
import assert from 'node:assert/strict';
import {initialPreferenceNotes,readPreference,updatePreference,parsePreference,formatPreference} from '../src/preference-records.ts';
import {deletionContents} from '../src/memory-trash.ts';

test('view edits produce a canonical settings revision retaining original bytes and ID',()=>{
 const original=structuredClone(initialPreferenceNotes),before=original.find(n=>n.id==='settings-appearance');
 const changed=updatePreference('appearance',original,p=>({...p,background:'sand'}));
 const after=changed.find(n=>n.id===before.id);
 assert.equal(readPreference('appearance',changed).background,'sand');
 assert.equal(after.path,before.path);assert.equal(after.version,2);assert.deepEqual(after.history,[before.body]);
 assert.equal(readPreference('appearance',original).background,'paper');
});
test('file edits reject malformed values and execution/readiness fields without changing active records',()=>{
 const original=structuredClone(initialPreferenceNotes);
 assert.throws(()=>updatePreference('appearance',original,p=>({...p,theme:'unknown'})),/appearance/);
 assert.equal(readPreference('appearance',original).theme,'system');
 assert.throws(()=>parsePreference('connection','# Connection\n\n```json\n{"downloads":true,"remoteInference":true}\n```'),/Unknown/);
 assert.throws(()=>parsePreference('models',formatPreference('models',{...readPreference('models',original),ready:true})),/Unknown/);
 const edited=formatPreference('connection',{downloads:true});assert.equal(parsePreference('connection',edited).downloads,true);
});
test('model selections reference the library and managed settings cannot be deleted',()=>{
 const original=structuredClone(initialPreferenceNotes);
 assert.throws(()=>updatePreference('models',original,m=>({...m,transcriptionModel:'whisper-tiny'})),/before selecting/);
 const registered=updatePreference('models',original,m=>({...m,transcriptionLibrary:['whisper-tiny'],transcriptionModel:'whisper-tiny'}));
 assert.equal(readPreference('models',registered).transcriptionModel,'whisper-tiny');
 assert.throws(()=>deletionContents({kind:'file',value:'settings-models'},original,['Settings']),/protected/);
});
