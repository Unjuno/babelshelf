import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFERRED_TOOL_READ_SKILL_CAPABILITY,DEFERRED_TOOL_SEARCH_CAPABILITY,deferredToolReferences,explicitDeferredToolIds,readDeferredToolSkill,searchDeferredTools} from '../src/deferred-tool-search.ts';

const enabled=[
 {id:'memory.search',effect:'read',network:'none',usage:'Search saved notes.'},
 {id:'user.weather',effect:'read',network:'none',usage:'Find weather observations saved in Memory.'},
 {id:'user.recipe',effect:'read',network:'none',usage:'Find local recipes and ingredient notes.'},
 {id:'user.calendar',effect:'read',network:'none',usage:'Memoryからカレンダーのエクスポートを検索する。'},
];

test('explicit guide preparation matches enabled IDs, not filenames, prefixes or unknown packages',()=>{
 assert.deepEqual(explicitDeferredToolIds('Explain `user.weather`; do not run it.',enabled),['user.weather']);
 assert.deepEqual(explicitDeferredToolIds('user.calendar と user.weather、user.calendar',enabled),['user.calendar','user.weather']);
 for(const query of ['user.weather-extra','other.user.weather','Notes/user.weather.md','user.missing','memory.search'])assert.deepEqual(explicitDeferredToolIds(query,enabled),[]);
 assert.deepEqual(explicitDeferredToolIds('user.weather',enabled.slice(0,1)),[]);
});

test('deferred search discovers matching enabled custom tools only',()=>{
 assert.equal(DEFERRED_TOOL_SEARCH_CAPABILITY.id,'tools.search');
 assert.deepEqual(searchDeferredTools('weather observations',enabled),[{id:'user.weather',usage:'Find weather observations saved in Memory.'}]);
 assert.deepEqual(searchDeferredTools('カレンダーの書き出し',enabled).map(item=>item.id),['user.calendar']);
 assert.deepEqual(searchDeferredTools('missing capability',enabled),[]);
});

test('discovery is bounded and never returns executable source or authority',()=>{
 const many=Array.from({length:10},(_,index)=>({id:`user.tool-${index}`,effect:'read',network:'none',usage:'weather tool'}));
 const result=searchDeferredTools('weather',many);
 assert.equal(result.length,3);
 assert.ok(result.every(item=>Object.keys(item).sort().join(',')==='id,usage'));
 for(const query of ['', 'x'.repeat(481), null, {query:'weather'}])assert.throws(()=>searchDeferredTools(query,enabled));
});

test('only exact IDs from the active custom registry can be revealed',()=>{
 assert.deepEqual(deferredToolReferences([{id:'user.weather'},{id:'memory.search'},{id:'user.weather'}],enabled),['user.weather']);
 assert.deepEqual(deferredToolReferences([{id:'user.weather'}],enabled.slice(0,1)),[]);
 assert.deepEqual(deferredToolReferences([{id:'user.weather'}],enabled),['user.weather']);
 assert.deepEqual(deferredToolReferences('user.weather',enabled),[]);
});

test('full skill guidance is available for an exact enabled tool without a prerequisite search and is byte bounded',()=>{
 assert.equal(DEFERRED_TOOL_READ_SKILL_CAPABILITY.id,'tools.read-skill');
 const skill={id:'user.weather',usage:'Use the weather lookup with a concise query.'};
 assert.deepEqual(readDeferredToolSkill('user.weather',[skill]),{id:'user.weather',title:'weather',instructions:skill.usage});
 assert.throws(()=>readDeferredToolSkill('user.recipe',[skill]),/unavailable/);
 assert.throws(()=>readDeferredToolSkill('user.weather',[]),/unavailable/);
 assert.throws(()=>readDeferredToolSkill('user.weather',[{...skill,usage:'あ'.repeat(3_000)}]),/context limit/);
});
