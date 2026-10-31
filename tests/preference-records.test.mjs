import test from 'node:test';
import assert from 'node:assert/strict';
import {
 initialPreferenceNotes,
 parsePreference,
 readPreferenceWithFallback,
 updatePreference,
 UnsupportedPreferenceSchemaError,
} from '../design/prototype/src/preference-records.ts';

const setting=(group,body,extra={})=>({
 id:'settings-'+group,
 path:'Settings/'+group+'.md',
 body,
 version:1,
 history:[],
 managed:true,
 ...extra,
});

test('legacy settings are projected in memory without rewriting retained source data',()=>{
 const body='# Appearance\n\n```json\n'+JSON.stringify({schemaVersion:0,theme:'system',background:'paper',glass:'clear'})+'\n```\n';
 const note=setting('appearance',body);
 const loaded=readPreferenceWithFallback('appearance',[note]);
 assert.equal(loaded.valid,true);
 assert.equal(loaded.value.fontFamily,'system');
 assert.deepEqual(loaded.value.fonts,[]);
 assert.equal(note.body,body);
 assert.deepEqual(note.history,[]);
 assert.equal(note.version,1);
});

test('explicit settings updates append the exact previous body and preserve existing history',()=>{
 const source=structuredClone(initialPreferenceNotes.find(note=>note.id==='settings-appearance'));
 source.history=['older compatible body'];
 source.paths=['Settings/appearance.md'];
 source.version=3;
 const previous=source.body;
 const next=updatePreference('appearance',[source],value=>({...value,theme:'dark'}))[0];
 assert.equal(next.version,4);
 assert.deepEqual(next.history,['older compatible body',previous]);
 assert.deepEqual(next.paths,['Settings/appearance.md','Settings/appearance.md']);
 assert.equal(parsePreference('appearance',next.body).theme,'dark');
 assert.equal(source.body,previous);
});

test('a future settings schema is not silently rewritten by current application updates',()=>{
 const current=initialPreferenceNotes.find(note=>note.id==='settings-harness');
 const value=JSON.parse(current.body.match(/```json\n([\s\S]+)\n```/)[1]);
 value.schemaVersion=2;
 const body='# Harness\n\n```json\n'+JSON.stringify(value,null,2)+'\n```\n';
 const note=setting('harness',body,{version:7,history:['prior body']});
 assert.throws(()=>updatePreference('harness',[note],value=>({...value,userGuidance:'new'})),UnsupportedPreferenceSchemaError);
 assert.equal(note.body,body);
 assert.equal(note.version,7);
 assert.deepEqual(note.history,['prior body']);
});

test('a present invalid setting is rejected instead of being replaced by a guessed default',()=>{
 const body='# Appearance\n\n```json\n'+JSON.stringify({schemaVersion:0,theme:'neon',background:'paper',glass:'clear'})+'\n```\n';
 const note=setting('appearance',body);
 assert.throws(()=>parsePreference('appearance',note.body),/Unsupported appearance value/);
 assert.equal(note.body,body);
});
